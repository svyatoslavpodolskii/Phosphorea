import {MIN_ZOOM,MAX_ZOOM,type Camera} from './model';

export interface Point{x:number;y:number}
export interface Viewport{width:number;height:number}
/** A world point pinned to a screen point. Zoom is expressed relative to it. */
export interface Anchor{world:Point;screen:Point}

const TAU=.05,MAX_STEP=64;
const ZOOM_EPS=.0004,PAN_EPS=.12;
/** Smoothing is decided by how continuous the input is, not by a fixed constant.
 *  A wheel notch arrives alone and eases in over a few frames; a trackpad pinch
 *  arrives frequently and retains a short elastic follow. Nothing here depends on
 *  the device, only on the interval the hand actually produced. */
const NOTCH_SHARE=.2,STREAM_SHARE=.85,CONTINUOUS_MS=45,DISCRETE_MS=15,REFERENCE_FRAME=1000/60;
/** Hard perceptual ceiling: the world may not expand or slide faster than this per
 *  frame, whatever the input asked for. Ordinary gestures never reach it, so it
 *  adds no lag, but it guarantees no single frame can ever be a visible jump. */
const MAX_ZOOM_RATE=.13,MAX_PAN_RATE=80,COAST=70;

export const clampZoom=(zoom:number)=>Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,zoom));

export const fromAnchor=(anchor:Anchor,zoom:number,view:Viewport):Camera=>({
  x:anchor.screen.x-view.width/2-anchor.world.x*zoom,
  y:anchor.screen.y-view.height/2-anchor.world.y*zoom,
  zoom});

export function screenToWorld(point:Point,camera:Camera,view:Viewport):Point{
  return {x:(point.x-view.width/2-camera.x)/camera.zoom,y:(point.y-view.height/2-camera.y)/camera.zoom};
}

/** Normalises mouse wheel, precision trackpad scroll, trackpad pinch and Safari
 *  gesture events into a single multiplicative zoom factor. */
export function wheelZoomFactor(event:{deltaY:number;deltaMode:number;ctrlKey:boolean},viewportHeight:number){
  const unit=event.deltaMode===1?16:event.deltaMode===2?Math.max(1,viewportHeight):1;
  const delta=event.deltaY*unit;
  // Browsers report a trackpad pinch as a ctrl-modified wheel with small pixel deltas.
  if(event.ctrlKey)return Math.exp(-Math.max(-1,Math.min(1,delta*.01)));
  return Math.exp(-Math.max(-400,Math.min(400,delta))*.0016);
}

/** Safari dispatches gesture events rather than ctrl-wheel for trackpad pinch. */
export function gestureZoomFactor(scale:number,previous:number){
  if(!(scale>0)||!(previous>0))return 1;
  return Math.exp(-Math.max(-.5,Math.min(.5,Math.log(scale/previous))*.9));
}

/** Owns intended camera and its presentation. Zoom uses a bounded, critically
 * damped spring; one-finger panning remains directly attached to the hand. */
export class CameraRig{
  camera:Camera={x:0,y:0,zoom:1};
  private target:Camera={x:0,y:0,zoom:1};
  private pending={x:0,y:0,z:0};
  /** Smoothed interval between input events, in milliseconds. */
  private interval=Infinity;
  private lastEvent=0;
  private anchor:Anchor|null=null;
  /** True while two fingers are down: the focal point they hold must survive. */
  private pinching=false;
  /** True while a finger is on the glass: the camera is the hand, one to one. */
  private direct=false;private zoomVelocity=0;
  private view:Viewport={width:1,height:1};
  private reduced=false;
  moving=false;
  private settled=true;private retargeting=false;
  private clock:()=>number;

  constructor(clock?:()=>number){this.clock=clock||(()=>performance.now());}

  resize(view:Viewport){this.view=view;}
  setReduced(reduced:boolean){this.reduced=reduced;}

  /** Immediate placement, used for restore, resize and reduced motion only. */
  set(camera:Camera){this.zoomVelocity=0;this.direct=false;this.retargeting=false;this.camera={...camera};this.target={...camera};this.pending.x=this.pending.y=this.pending.z=0;this.anchor=null;this.pinching=false;this.lastEvent=0;this.interval=Infinity;this.settled=true;this.moving=false;}

  get value(){return this.camera;}
  get anchored(){return this.anchor!==null;}
  get gesturing(){return this.direct;}
  get intended(){return this.target;}

  /** Keep the original world anchor under the moving finger midpoint while
   * scale follows the gesture with the same spring as wheel and zoom controls. */
  pinchTo(screen:Point,zoom:number){
   if(this.anchor)this.anchor={...this.anchor,screen};
   else this.anchor={world:screenToWorld(screen,this.camera,this.view),screen};
   this.pinching=true;this.direct=true;this.settled=false;this.moving=true;
   this.target=fromAnchor(this.anchor,clampZoom(zoom),this.view);
   this.pending.z=Math.log(this.target.zoom/this.camera.zoom);this.event();if(this.reduced)this.camera={...this.target};
  }
  /** Single finger drag: the canvas is held in the hand, so it tracks it exactly. */
  trackTo(camera:Camera){
   this.zoomVelocity=0;this.pending.z=0;
   this.anchor=null;this.pinching=false;this.direct=true;this.settled=false;this.moving=true;
   this.target={...camera,zoom:clampZoom(camera.zoom)};this.camera={...this.target};
  }
  /** Release the fingers, retaining their final target and anchor until settled. */
  endPinch(){this.pinching=false;this.direct=false;this.interval=Infinity;this.pending.z=Math.log(this.target.zoom/this.camera.zoom);this.wake();}

  /** Establishes or reuses the anchor, then records the requested zoom. The world
   *  point under the pointer stays under the pointer for the whole gesture. */
  zoomAt(screen:Point,factor:number){
   this.pinching=false;
   if(this.retargeting){this.target={...this.camera};this.pending.z=0;this.retargeting=false;}
   this.anchor={world:screenToWorld(screen,this.camera,this.view),screen};
   this.pending.x=this.pending.y=0;
   const zoom=clampZoom(this.target.zoom*factor);
   this.event();this.pending.z+=Math.log(zoom)-Math.log(this.target.zoom);
   this.target=fromAnchor(this.anchor,zoom,this.view);
   this.wake();
  }
  zoomStep(factor:number){
   const zoom=clampZoom(this.target.zoom*factor);
   this.retarget({...this.target,zoom});
  }
  /** Absolute control zoom always keeps the presented viewport center fixed.
   * It does not blend in the overview's translation while crossing low ticks. */
  zoomTo(screen:Point,zoom:number){
   this.direct=false;this.pinching=false;this.retargeting=false;
   this.anchor={world:screenToWorld(screen,this.camera,this.view),screen};
   this.target=fromAnchor(this.anchor,clampZoom(zoom),this.view);
   this.pending.x=this.pending.y=0;this.pending.z=Math.log(this.target.zoom/this.camera.zoom);this.event();this.wake();
  }
  panBy(dx:number,dy:number){this.retargeting=false;this.anchor=null;this.pinching=false;this.event();this.pending.x+=dx;this.pending.y+=dy;this.target={...this.target,x:this.target.x+dx,y:this.target.y+dy};this.wake();}
  /** Keeps an active zoom anchor while the gesture's midpoint travels. */
  moveAnchor(dx:number,dy:number){
   if(!this.anchor)return;
   this.anchor={world:this.anchor.world,screen:{x:this.anchor.screen.x+dx,y:this.anchor.screen.y+dy}};
   this.event();this.pending.x+=dx;this.pending.y+=dy;
   this.target=fromAnchor(this.anchor,this.target.zoom,this.view);
   this.wake();
  }
  /** Sets an absolute destination. Used for focus corrections and fit views. */
  retarget(camera:Camera){
   this.retargeting=true;this.anchor=null;this.pinching=false;this.event();
   this.pending.x+=camera.x-this.target.x;this.pending.y+=camera.y-this.target.y;this.pending.z+=Math.log(camera.zoom)-Math.log(this.target.zoom);
   this.target={...camera};this.wake();
  }
  /** Hands the remaining pan momentum to the camera so it coasts to rest. The
   *  distance is one smoothing window of travel, so a flick is delivered over the
   *  same few frames as the drag was, never as a single lurch. */
  release(velocity:Point){
   this.retargeting=false;this.interval=Infinity;this.direct=false;
   if(this.anchor)return;
   const x=Math.max(-MAX_PAN_RATE*8,Math.min(MAX_PAN_RATE*8,velocity.x*COAST)),y=Math.max(-MAX_PAN_RATE*8,Math.min(MAX_PAN_RATE*8,velocity.y*COAST));
   this.pending.x+=x;this.pending.y+=y;
   this.target={...this.target,x:this.target.x+x,y:this.target.y+y};
   this.wake();
  }
  /** Stops all motion where it stands. Used when the user grabs the canvas. */
  halt(){this.zoomVelocity=0;this.retargeting=false;this.direct=false;this.target={...this.camera};this.pending.x=this.pending.y=this.pending.z=0;this.anchor=null;this.pinching=false;this.settled=true;this.moving=false;}

  /** Records that the hand produced another event, and how long since the last one. */
  private event(){
   const now=this.clock(),gap=this.lastEvent?now-this.lastEvent:Infinity;
   this.lastEvent=now;
   this.interval=Number.isFinite(this.interval)?Math.min(gap,this.interval*.6+gap*.4):gap;
  }
    private wake(){if(this.reduced){this.camera=this.anchor?fromAnchor(this.anchor,this.target.zoom,this.view):{...this.target};this.settled=true;this.moving=false;return;}this.settled=false;this.moving=true;}

  /** Critically damped spring in log scale: a short elastic follow, no bounce
   * beyond the requested scale. Analytical integration is frame-rate independent. */
  private springZoom(dt:number,cap:number){
   const t=Math.max(0,Math.min(MAX_STEP,dt))/1000;if(!t)return 0;
   const current=Math.log(this.camera.zoom),target=Math.log(this.target.zoom),error=current-target,omega=45,c=this.zoomVelocity+omega*error,decay=Math.exp(-omega*t);
   const wanted=target+(error+c*t)*decay,delta=Math.max(-cap,Math.min(cap,wanted-current));
   this.zoomVelocity=(this.zoomVelocity-omega*c*t)*decay;
   const next=clampZoom(Math.exp(current+delta));return Math.log(next)-current;
  }

  step(dt:number):Camera{
   if(this.direct&&!this.pinching)return this.camera;
   if(this.settled)return this.camera;
   // Pan follows input cadence; zoom has the same spring for fingers and controls.
   const span=Number.isFinite(this.interval)?this.interval:Infinity;
   const continuity=Math.max(0,Math.min(1,(CONTINUOUS_MS-span)/(CONTINUOUS_MS-DISCRETE_MS)));
   const share=NOTCH_SHARE+(STREAM_SHARE-NOTCH_SHARE)*continuity;
   const frames=Math.max(.25,Math.max(0,Math.min(MAX_STEP,dt))/REFERENCE_FRAME);
   const alpha=1-Math.pow(1-share,frames),zoomCap=Math.min(.16,MAX_ZOOM_RATE*frames),panCap=Math.min(MAX_PAN_RATE,MAX_PAN_RATE*frames);
   // Movement is a share of what is outstanding, capped by what the eye can follow.
   const move=(wanted:number,remaining:number,cap:number)=>{
    const bounded=Math.abs(wanted)<=Math.abs(remaining)?wanted:Math.sign(wanted)*Math.abs(remaining);
    return Math.abs(bounded)<=cap?bounded:Math.sign(bounded)*cap;
   };
   if(this.anchor){
    const gap=Math.log(this.target.zoom)-Math.log(this.camera.zoom);
    const take=this.springZoom(dt,zoomCap);
    this.pending.z-=take;
    this.camera=fromAnchor(this.anchor,Math.exp(Math.log(this.camera.zoom)+take),this.view);
    if(Math.abs(gap)<ZOOM_EPS&&Math.abs(this.pending.z)<ZOOM_EPS&&Math.abs(this.zoomVelocity)<.02){
     this.camera=fromAnchor(this.anchor,this.target.zoom,this.view);this.zoomVelocity=0;this.pending.z=0;this.settled=true;this.moving=false;if(!this.pinching)this.anchor=null;
    }
    return this.camera;
   }
   const gapX=this.target.x-this.camera.x,gapY=this.target.y-this.camera.y,gapZ=Math.log(this.target.zoom)-Math.log(this.camera.zoom);
   const stepZ=this.springZoom(dt,zoomCap),zoom=Math.exp(Math.log(this.camera.zoom)+stepZ),ratio=zoom/this.camera.zoom;
   // Scale around the presented viewport center, then approach the target center.
   // Raw translation interpolation would make distant zoom flights orbit off screen.
   const baseX=this.camera.x*ratio,baseY=this.camera.y*ratio,targetX=this.target.x*zoom/this.target.zoom,targetY=this.target.y*zoom/this.target.zoom;
   const stepX=move(alpha*(targetX-baseX),targetX-baseX,panCap),stepY=move(alpha*(targetY-baseY),targetY-baseY,panCap);
   this.pending.z-=stepZ;this.camera={x:baseX+stepX,y:baseY+stepY,zoom};
   this.pending.x=this.target.x-this.camera.x;this.pending.y=this.target.y-this.camera.y;
   if(Math.hypot(gapX,gapY)<PAN_EPS&&Math.abs(gapZ)<ZOOM_EPS&&Math.abs(this.pending.z)<ZOOM_EPS&&Math.abs(this.zoomVelocity)<.02){
    this.camera={...this.target};this.zoomVelocity=0;this.pending.x=this.pending.y=this.pending.z=0;this.settled=true;this.moving=false;
   }
   return this.camera;
  }
}
