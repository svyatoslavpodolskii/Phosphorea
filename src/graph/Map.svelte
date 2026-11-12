<script lang="ts">
 import {playSound,motionSound,stopMotionSound} from '../ui/sound';
 import TouchFeedback from '../ui/TouchFeedback.svelte';
 import ZoomControl from '../ui/ZoomControl.svelte';
 import type {ZoomControls} from '../plugins/interface';
 import {RasterCache} from './raster-cache';
 const rasterCache=new RasterCache();
 import {LabelCollisions} from './label-collision';
 import {EdgeCurves} from './edge-curve';
 const edgeCurves=new EdgeCurves();
 import RelationshipLayer from '../ui/RelationshipLayer.svelte';
 import {pickLink} from './relationships';
 import {dragLinkTarget,dwellLink,linkReady,linkedPair,LINK_DWELL_MS,type LinkDwell} from './drag-link';
 import {makeLink} from '../core/model';
 import type {Link} from '../core/model';
 let activeLink=$state('');let linkInteracting=$state(false);let gestureActive=$state(false);let lassoing=$state(false);let connectFrom=$state('');
 let relationships:{apply:(before:Link|null,after:Link|null)=>Promise<void>}|undefined;
 let linkDwell:LinkDwell|null=null,linkTimer:ReturnType<typeof setTimeout>|undefined;
 let proposal=$state<{source:string;target:string;from:Point;ready:boolean;duplicate:boolean}|null>(null);
 const screenPoint=(p:Point)=>({x:width/2+camera.x+p.x*camera.zoom,y:height/2+camera.y+p.y*camera.zoom});
 function clearProposal(){clearTimeout(linkTimer);linkTimer=undefined;linkDwell=null;proposal=null;}
 function proposeLink(p:Point){
  if(!moving||moving.members||pointers.size!==1||!start?.dragOrigin){clearProposal();return;}
  const target=dragLinkTarget(painted,moving.id,p,camera,{width,height});
  const next=dwellLink(linkDwell,target,p,performance.now());
  if(next!==linkDwell){clearTimeout(linkTimer);linkTimer=undefined;linkDwell=next;
   if(next)linkTimer=setTimeout(()=>{linkTimer=undefined;if(moving&&pointers.size===1){const point=[...pointers.values()][0];proposeLink(point);}},LINK_DWELL_MS+1);
  }
  proposal=next?{source:moving.id,target:next.target,from:{...start.dragOrigin},ready:linkReady(next,performance.now()),duplicate:linkedPair(data.links,moving.id,next.target)}:null;
 }
 $effect(()=>{if(linkInteracting)rig.halt();controller?.setInteracting(linkInteracting);});
 import type {GpuMapRenderer,GpuNode,GpuEdge,GpuLabel,GpuRing,GpuDot,GpuEdgeLabel} from './gpu-renderer';
 import {visualAttention} from './attention';
 import {fromAnchor,clampZoom,type Anchor} from './camera';
 import {CameraRig,wheelZoomFactor,gestureZoomFactor,screenToWorld,type Point} from './camera';
 import {revealCamera,fitCamera} from './navigation';
 import {hitRegions,pickTarget,resolveSelection} from './intent';
 import {collapseAmount} from './lod';
 const loadPreview=()=>import('../ui/ContentPreview.svelte');
 import {contentPreviews,type Preview} from "./previews";
 let previews=$state<Preview[]>([]);const previewHeights=new Map<string,number>();function previewHeight(id:string,height:number){if(previewHeights.get(id)!==height){if(previewHeights.size>200)previewHeights.clear();previewHeights.set(id,height);schedule();}}
  import {SemanticScene,type PaintedNode} from './semantic';
  import {nodeShape,bodyGradient,iconLegible,iconBudget,iconSprite,softHighlightVisible,SOFT_BUDGET,clearSprites} from './sprites';
 import {labelGeometry,measureText} from './footprint';
 import {onMount,untrack} from 'svelte';
 import {readable,mix} from '../core/themes';
 import type {Snapshot,AtomState} from '../core/model';
 import {MIN_ZOOM,MAX_ZOOM,type Camera,type GraphNode,type GraphModel} from './model';
 import {GraphController} from './controller';
 import type {GraphProviders} from './providers';
 import type {Preferences} from '../core/preferences';
 import type {PositionUpdate} from '../core/model';
 let {physicsEnabled=true,zoomOptions=null,data,selected='',lens='all',camera=$bindable({x:0,y:0,zoom:1}),providers,prefs,providerVersion,paused=false,onselect,onselection=()=>{},onfolderdrag=()=>{},onfolderdrop=async()=>{},onopen,oncontext,onbranch,oncreate,onpositions,onstate,onstates,onlinkchange,oncamera,onhover=()=>{},onviewport=()=>{},revealRequest=null,connectRequest=null,preservePositions=false,oninteraction=()=>{},onerror}: {physicsEnabled?:boolean;zoomOptions?:ZoomControls|null;data:Snapshot;selected:string;lens:string;camera:Camera;providers:GraphProviders;prefs:Preferences;providerVersion:number;paused:boolean;onselect:(id:string)=>void;onselection?:(ids:string[])=>void;onfolderdrop?:(folder:string,ids:string[])=>Promise<void>;onfolderdrag?:(value:{ids:string[];target:string|null}|null)=>void;onopen:(id:string,section?:string)=>void;oncontext:(id:string)=>void;onbranch:(ids:string[])=>void;oncreate:(x:number,y:number)=>void;onpositions:(positions:PositionUpdate[],manual:boolean)=>Promise<void>;onstate:(id:string,state:AtomState)=>void;onstates:(ids:string[],state:AtomState|'delete'|'pin'|'unpin')=>Promise<unknown>;onlinkchange:(before:Link|null,after:Link|null)=>Promise<void>;oncamera:()=>void;onhover?:(id:string)=>void;onviewport?:(size:{width:number;height:number})=>void;revealRequest?:{id:string;nonce:number;point?:Point;zoom?:number}|null;preservePositions?:boolean;connectRequest?:{id:string;nonce:number}|null;oninteraction?:(active:boolean)=>void;onerror:(e:Error)=>void}=$props();
 $effect(()=>{if(connectRequest)connectFrom=connectRequest.id;});
 $effect(()=>oninteraction(dragging||lassoing));
 let touchFeedback=$state<{x:number;y:number;id:number;held:boolean}|null>(null);let feedbackTimer:ReturnType<typeof setTimeout>;let feedbackId=0;let scopeCamera:Camera|null=null;let folderCamera:Camera|null=null;let lastEmptyTap={x:0,y:0,time:-Infinity};
 let structureSeen=false,currentStructure:string|undefined,frameStructure=false;
 $effect(()=>{const mode=prefs.graphModel;if(structureSeen&&mode!==currentStructure)frameStructure=true;currentStructure=mode;structureSeen=true;});
 let fitCache:{nodes:GraphNode[];width:number;height:number;camera:Camera}|undefined;
 function fitted(ids?:string[]){const source=model.expanded?.nodes||model.nodes;if(!ids&&!moving&&fitCache?.nodes===source&&fitCache.width===width&&fitCache.height===height)return fitCache.camera;const allowed=ids?new Set(ids):null;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const node of source){if(allowed&&!allowed.has(node.id))continue;minX=Math.min(minX,node.x-node.radius-20);maxX=Math.max(maxX,node.x+node.radius+20);minY=Math.min(minY,node.y-node.radius-15);maxY=Math.max(maxY,node.y+node.radius+55);}const value=Number.isFinite(minX)?fitCamera({minX,maxX,minY,maxY},{width,height}):{x:0,y:0,zoom:1};if(!ids&&!moving)fitCache={nodes:source,width,height,camera:value};return value;}

 function frameMap(onlyOutside=false){const target=fitted();if(onlyOutside&&target.zoom>=camera.zoom)return;scopeCamera=null;rig.retarget(target);schedule();}
 function zoomSlider(value:number){adopt();const all=fitted(),min=all.zoom,zoom=Math.exp(Math.log(min)+(Math.log(MAX_ZOOM)-Math.log(min))*value/100);if(value===0)rig.retarget(all);else rig.zoomTo({x:width/2,y:height/2},zoom);schedule();}
 const sliderValue=()=>Math.max(0,Math.min(100,100*Math.log(camera.zoom/fitted().zoom)/Math.log(MAX_ZOOM/fitted().zoom)));
 // A focus request arrives from outside, but the camera is still ours to animate.
 $effect(()=>{const request=revealRequest;if(!request)return;untrack(()=>{if(request.point){const target={x:-request.point.x*(request.zoom??1),y:-request.point.y*(request.zoom??1),zoom:request.zoom??1};scopeCamera=target;folderCamera=target;rig.retarget(target);schedule();return;}const atom=data.atoms.find(a=>a.id===request.id);if(atom)reveal({x:atom.x,y:atom.y},request.zoom??1);});});
 let transitioning=$state(false);let canvas!:HTMLCanvasElement;let width=$state(1200),height=$state(700);let dragging=$state(false);let model=$state.raw<GraphModel>({nodes:[],links:[],hidden:0});let controller=$state<GraphController|null>(null);let reduced=$state(false);let hover=$state('');
 $effect(()=>controller?.setMotionEnabled(physicsEnabled));
 $effect(()=>controller?.sync($state.snapshot(data),$state.snapshot(prefs),providerVersion,preservePositions));
 $effect(()=>controller?.view($state.snapshot(camera),width,height,lens,selected,paused,reduced));
 let visualFocus=$state('');let recent='';let recentAt=0;let focal:Point|undefined;let previewCamera=$state({x:0,y:0,zoom:1});
 $effect(()=>{model;selected;paused;physicsEnabled;(physicsEnabled?prefs.liveliness:0);schedule();});
 $effect(()=>{if(paused)untrack(cancel);});
 const rig=new CameraRig();let publishedCamera:Camera|undefined;
 const sameCamera=(a:Camera,b:Camera)=>a.x===b.x&&a.y===b.y&&a.zoom===b.zoom;
 // A camera assigned from outside (restore, editor return, reduced motion) replaces rig state outright.
 $effect(()=>{const external=$state.snapshot(camera);if(publishedCamera&&sameCamera(external,publishedCamera))return;if(!sameCamera(external,rig.value))rig.set(external);});
  const inkCache=new Map<string,string>();function inkFor(color:string,background:string){const key=color+background;let ink=inkCache.get(key);if(!ink){ink=readable(color,[background,mix(background,color,.19)]);if(inkCache.size>256)inkCache.clear();inkCache.set(key,ink);}return ink;}
  // Reading computed style forces a style recalculation, which is one of the most
  // expensive things a frame can ask for on a phone. The theme only changes rarely.
  let paletteCache:{background:string;text:string;muted:string;accent:string;edge:string;strong:boolean}|null=null;
  function readPalette(){if(paletteCache)return paletteCache;const style=getComputedStyle(canvas);return paletteCache={strong:style.getPropertyValue('--theme-strong').trim()==='1',background:style.getPropertyValue('--theme-background').trim(),text:style.getPropertyValue('--theme-text').trim(),muted:style.getPropertyValue('--theme-muted').trim(),accent:style.getPropertyValue('--theme-accent').trim(),edge:style.getPropertyValue('--theme-edge').trim()};}
  const invalidatePalette=()=>{rasterCache.clear();gpu?.invalidate();paletteCache=null;inkCache.clear();clearSprites();schedule();};
 let visualSource:PaintedNode[]|undefined;let priorityNodes:PaintedNode[]=[];
 const atomStates=$derived(new Map(data.atoms.map(a=>[a.id,a.paused?'paused':a.state])));
 const scene=new SemanticScene();const satelliteCache=new Map<string,{id:string;x:number;y:number;color:string}>();const displayed=new Map<string,PaintedNode>();
 let gpuHost:HTMLDivElement;let gpu=$state.raw<GpuMapRenderer|null>(null);let gpuFailed=$state(false);let renderBackend=$state('canvas');let rendererSettled=true;let pendingGpu=$state.raw<GpuMapRenderer|null>(null);let gpuStarting=$state(true);let firstMap=false;let driftTime=0;
 let overlayDirty=false;let drawingContext:CanvasRenderingContext2D|null=null;
 let hitCache:ReturnType<typeof hitRegions>|null=null;
 const targets=()=>hitCache??(hitCache=hitRegions(painted,camera,{width,height},selected));
 let painted=$state.raw<PaintedNode[]>([]);let frame=0;let lastFrame=0;let candidate='';let cameraMoving=false;
 const proposalTarget=$derived(painted.find(n=>n.id===proposal?.target));
 const DRAG_THRESHOLD=6;
 let lasso:Point[]|null=null;let lassoSelection=$state.raw<string[]>([]);
 $effect(()=>{const ids=[...lassoSelection];untrack(()=>onselection(ids));});
 $effect(()=>{providerVersion;if(!providers.hasTool('lasso')){lasso=null;lassoing=false;lassoSelection=[];schedule();}});
 function inside(point:Point,polygon:Point[]){let found=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)found=!found;}return found;}
 function finishLasso(){const path=lasso;lasso=null;lassoing=false;if(!path||path.length<3){schedule();return;}lassoSelection=[...new Set(painted.filter(n=>n.opacity>.5&&inside({x:width/2+camera.x+n.x*camera.zoom,y:height/2+camera.y+n.y*camera.zoom},path)).flatMap(n=>n.members||[n.id]))];if(lassoSelection.length)playSound('drop');schedule();}

 const pointers=new Map<number,Point>();let start:{x:number;y:number;worldX?:number;worldY?:number;dragOrigin?:Point;section?:string;node?:GraphNode;target?:GraphNode;panX:number;panY:number;moved?:boolean}|null=null;let moving:GraphNode|null=null;let pinch=0;let pinchStart:{distance:number;zoom:number}|null=null;let fromPinch=false;let longTimer:ReturnType<typeof setTimeout>;let holdStarted=0;let pendingDrag=false;let holdReady=false;let touchStart=false;let suppressReleaseClick=false;let panSample={x:0,y:0,time:0},panVelocity={x:0,y:0};
 function adopt(){rig.resize({width,height});}
 function schedule(){if(frame)return;frame=requestAnimationFrame(tick);}
 const profileFrames=new URLSearchParams(location.search).get('profile')==='1';
 function tick(now=performance.now()){frame=0;if(!canvas)return;const started=profileFrames?performance.now():0;draw(now);if(profileFrames)canvas.dataset.renderMs=String(performance.now()-started);}
   function draw(now:number){if(!rendererSettled)return;if(pendingGpu&&!pointers.size&&!rig.moving&&!paused){gpuHost.appendChild(pendingGpu.canvas);gpu=pendingGpu;pendingGpu=null;}const dt=Math.min(64,Math.max(1,now-lastFrame||16));lastFrame=now;const inputDrag=pendingDrag;if(pendingDrag&&moving){pendingDrag=false;controller?.drag(moving.id,moving.x,moving.y,dt);}if(moving&&controller?.advanceDrag(inputDrag?0:dt))schedule();
   const next=rig.moving?rig.step(dt):rig.value;
   if(frameStructure&&!model.arranging&&!paused&&!pointers.size){frameStructure=false;frameMap(true);}
   if(!sameCamera(camera,next)){const dz=Math.log(next.zoom/camera.zoom);if(Math.abs(dz)>.0001)motionSound('zoom',Math.min(1,Math.abs(dz)*1000/dt/2.5),Math.sign(dz));publishedCamera={x:next.x,y:next.y,zoom:next.zoom};camera=publishedCamera;cameraMoving=true;}
   controller?.setInteracting(pointers.size>0||rig.moving||linkInteracting);
  const visual=scene.advance(model,dt,reduced,moving?.id,collapseAmount(camera.zoom));
  const unsettled=visual.active;transitioning=unsettled;if((physicsEnabled?prefs.liveliness:0)&&!reduced&&!paused&&!pointers.size&&!rig.moving&&!document.hidden)driftTime+=dt;
 const amplitude=physicsEnabled&&!reduced?prefs.liveliness*5:0;
 if(visualSource!==visual.nodes||amplitude){visualSource=visual.nodes;painted=visual.nodes.map(n=>{if(!amplitude||n.pinned)return {...n};const phase=[...n.id].reduce((v,c)=>v+c.charCodeAt(0),0);return {...n,x:n.x+Math.sin(driftTime/3800+phase)*amplitude,y:n.y+Math.cos(driftTime/4700+phase)*amplitude};});priorityNodes=[...painted].sort((a,b)=>Number(Boolean(b.members||b.landmark))-Number(Boolean(a.members||a.landmark))||b.radius-a.radius||a.id.localeCompare(b.id));}
 hitCache=null;if(displayed.size!==painted.length||painted.some(n=>displayed.get(n.id)!==n)){displayed.clear();for(const n of painted)displayed.set(n.id,n);}
  const ctx=drawingContext??(drawingContext=canvas.getContext('2d')!);const palette=readPalette();/* Software fallback quality follows scene size, never pointer state. */const dpr=Math.min(devicePixelRatio,2)*(data.atoms.length>250&&(!gpu?.available||gpuFailed)?.75:1);if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
  const nodes=displayed;const visible=(n:{x:number;y:number})=>{const x=width/2+camera.x+n.x*camera.zoom,y=height/2+camera.y+n.y*camera.zoom;return x>-200&&x<width+200&&y>-100&&y<height+100;};
  const ordered=priorityNodes.filter(visible),attention=visualAttention(ordered,camera,{width,height},selected,now-recentAt<3000?recent:'',focal);visualFocus=attention.focus;for(const node of ordered)node.attention=attention.scores.get(node.id)??.4;
  const ambient=providers.hasTool('ambient-lens')&&lens!=='all',states=atomStates,selectedIds=new Set(lassoSelection);const branch=model.branch||[],inBranch=new Set(branch);
  const groups=visual.nodes.filter(n=>n.members&&n.opacity>.003),grouped=new Map(groups.flatMap(n=>n.members!.map(id=>[id,n] as const)));if(groups.length){for(const p of model.satellites||[])satelliteCache.set(p.id,p);}else satelliteCache.clear();for(const id of satelliteCache.keys())if(!grouped.has(id))satelliteCache.delete(id);
  // Stable curve geometry and opacity buckets reduce draw calls without a
  // separate gesture appearance. A press must never change the whole scene.
   const icons=iconBudget(camera.zoom,{width,height});
   // Decoration and label priority is stable: hover only adds a local highlight,
   // never displaces another atom's icon, finish or title.
   const dense=data.atoms.length>250&&(!gpu?.available||gpuFailed),iconIds=new Set(ordered.slice(0,dense?Math.min(icons,8):icons).map(n=>n.id));
   const softIds=new Set(ordered.filter(n=>softHighlightVisible(n.radius,camera.zoom)||inBranch.has(n.id)).slice(0,dense?0:SOFT_BUDGET).map(n=>n.id));
  const accelerated=Boolean(gpu?.available&&!gpuFailed);
  const edgeBatches=new Map<string,{path:Path2D;alpha:number;skeleton:boolean}>();
  const edgeLabels:{id:string;text:string;x:number;y:number}[]=[];const gpuDots:GpuDot[]=[];const gpuEdges:GpuEdge[]=[];const gpuNodes:GpuNode[]=[];renderBackend=accelerated?'webgl':'canvas';
  // A lens changes emphasis, while local relationships between visible atoms
  // remain readable even when the structural provider reduces its skeleton.
  const shownEdges=ambient?new Set(visual.links.flatMap(l=>[l.id,l.id.replace(/^(detail|cluster):/,'')])):null;
  const localEdges=ambient?data.links.flatMap(l=>{const a=nodes.get(l.from),b=nodes.get(l.to);return !shownEdges!.has(l.id)&&a&&b&&visible(a)&&visible(b)?[{...l,opacity:.55*Math.min(a.opacity,b.opacity)}]:[];}):[];
  for(const l of [...visual.links,...localEdges]){
   const na=nodes.get(l.from),nb=nodes.get(l.to);const a=na,b=nb;
   if(!a||!b||(!visible(a)&&!visible(b)))continue;
   const skeleton=inBranch.has(l.from)&&inBranch.has(l.to),alpha=Math.round(l.opacity*Math.max(ambient?.4:0,a.attention??1,b.attention??1)*(skeleton?1:.5)*16)/16;
   if(alpha<=0)continue;const key=Number(skeleton)+':'+alpha;let batch=edgeBatches.get(key);
   if(!accelerated&&!batch){batch={path:new Path2D(),alpha,skeleton};edgeBatches.set(key,batch);}
   const curve=edgeCurves.get(l,a,b);if(!curve)continue;
   const {ax,ay,bx,by,cx,cy}=curve;
   if(batch){batch.path.moveTo(ax,ay);batch.path.quadraticCurveTo(cx,cy,bx,by);}if(accelerated)gpuEdges.push({id:l.id,...curve,width:(skeleton?1.9:1.2)/camera.zoom,color:skeleton?palette.accent:palette.edge,alpha});

   if(activeLink&&(l.id===activeLink||l.id==='detail:'+activeLink)&&camera.zoom>.55&&l.relation!=='related')edgeLabels.push({id:l.id,text:l.relation,x:(a.x+b.x)/2,y:(a.y+b.y)/2-8});
  }
  canvas.dataset.edgeLabels=String(edgeLabels.length);
  const labelLayout=new Map<string,{text:ReturnType<typeof labelGeometry>;show:boolean}>(),labelRects=new LabelCollisions();
  for(const original of ordered){const n=original;
   const text=labelGeometry(n.label,n.radius,camera.zoom,width,n.id===selected?n.state:'normal');
   const box={x:(n.x-text.halfWidth)*camera.zoom,y:(n.y+text.top)*camera.zoom,width:text.halfWidth*2*camera.zoom,height:(text.bottom-text.top)*camera.zoom};
   const eligible=camera.zoom>.55||!grouped.has(n.id)||n.members||n.landmark||n.radius>36||n.id===selected;
   const show=Boolean(eligible&&(n.id===selected||!labelRects.overlaps(box)));
   labelLayout.set(n.id,{text,show});if(show)labelRects.add(box);
  }
  if(accelerated&&groups.length){const cloud=new Map([...(model.expanded?.nodes||model.nodes),...satelliteCache.values()].map(p=>[p.id,p]));for(const l of model.expanded?.links||model.links){if(!grouped.has(l.from)&&!grouped.has(l.to))continue;const a=cloud.get(l.from),b=cloud.get(l.to),group=grouped.get(l.from)||grouped.get(l.to)!;if(a&&b&&(visible(a)||visible(b)))gpuEdges.push({id:'cloud:'+l.id,ax:a.x,ay:a.y,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,bx:b.x,by:b.y,width:.65/camera.zoom,color:palette.edge,alpha:.22*group.opacity*(group.attention??1)});}for(const [id,group] of grouped){const p=satelliteCache.get(id);if(p&&visible(p))gpuDots.push({id,x:p.x,y:p.y,radius:Math.max(3,1.15/camera.zoom),color:p.color==='#b4ecc1'?palette.accent:inkFor(p.color,palette.background),alpha:.55*group.opacity*(group.attention??1)});}}
  const gpuEdgeLabels:GpuEdgeLabel[]=accelerated?edgeLabels.filter(label=>{const x=width/2+camera.x+label.x*camera.zoom,y=height/2+camera.y+label.y*camera.zoom,half=measureText(label.text,13)*11/26*camera.zoom+8;return x+half>0&&x-half<width&&y>-40&&y<height+40;}).map(label=>({...label,y:label.y-11,size:11,color:palette.muted,alpha:1})):[];
  const worldOverlay=!accelerated;
  const screenOverlay=Boolean(lasso?.length||start&&pointers.size===1&&!dragging&&!lasso&&(holdReady||now-holdStarted>100));
  if(worldOverlay||screenOverlay||overlayDirty){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);overlayDirty=worldOverlay||screenOverlay;}
  if(worldOverlay){ctx.save();ctx.translate(width/2+camera.x,height/2+camera.y);ctx.scale(camera.zoom,camera.zoom);
  if(groups.length){ctx.save();const cloud=new Map([...(model.expanded?.nodes||model.nodes),...satelliteCache.values()].map(p=>[p.id,p]));ctx.strokeStyle=palette.edge;ctx.lineWidth=.65/camera.zoom;for(const l of model.expanded?.links||model.links){if(!grouped.has(l.from)&&!grouped.has(l.to))continue;const a=cloud.get(l.from),b=cloud.get(l.to),group=grouped.get(l.from)||grouped.get(l.to)!;if(!a||!b)continue;ctx.globalAlpha=.22*group.opacity*(group.attention??1);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}for(const [id,group] of grouped){const p=satelliteCache.get(id);if(!p||!visible(p))continue;ctx.globalAlpha=.55*group.opacity*(group.attention??1);ctx.beginPath();ctx.arc(p.x,p.y,Math.max(3,1.15/camera.zoom),0,Math.PI*2);ctx.fillStyle=p.color==='#b4ecc1'?palette.accent:inkFor(p.color,palette.background);ctx.fill();}ctx.restore();}
  if(!accelerated)for(const {path,alpha,skeleton} of edgeBatches.values()){ctx.globalAlpha=alpha;ctx.strokeStyle=skeleton?palette.accent:palette.edge;ctx.lineWidth=(skeleton?1.9:1.2)/camera.zoom;ctx.stroke(path);}
  ctx.globalAlpha=1;ctx.fillStyle=palette.muted;ctx.font='11px system-ui';ctx.textAlign='center';for(const label of edgeLabels)ctx.fillText(label.text,label.x,label.y);
   ctx.globalAlpha=1;ctx.textAlign='center';}
   // The order below is also the priority order, so spending a decoration budget
   // in this order spends it on what the reader is actually looking at.
   for(const original of ordered){const n=original;if(!visible(n))continue;const muted=ambient&&!(n.members||[n.id]).some(id=>states.get(id)===(lens==='now'?'now':'archived'));const opacity=(original.opacity??1)*(n.attention??1);const paintNode=(ctx:CanvasRenderingContext2D,raster=false)=>{ctx.save();ctx.textAlign='center';ctx.translate(n.x,n.y);ctx.globalAlpha=(raster?1:opacity)*(ambient&&lens==='archived'&&n.state==='archived'?1:n.state==='archived'?.35:n.state==='paused'?.6:1)*(muted?.25:1);
  // Hover is the only thing the pointer may add. It never implies selection.
  if(!raster&&n.id===hover&&n.id!==selected){ctx.beginPath();ctx.arc(0,0,n.radius+5,0,Math.PI*2);ctx.strokeStyle=palette.text;ctx.lineWidth=1.2/camera.zoom;ctx.globalAlpha*=.45;ctx.stroke();ctx.globalAlpha/=.45;}
  if(!raster&&(n.state==='now'||n.id===selected||(n.members||[n.id]).some(id=>selectedIds.has(id))||holdReady&&start?.node?.id===n.id)){ctx.beginPath();ctx.arc(0,0,n.radius+8,0,Math.PI*2);ctx.strokeStyle=n.id===selected?palette.text:palette.accent;ctx.lineWidth=1.5/camera.zoom;ctx.setLineDash(n.state==='now'?[4,5]:[]);ctx.stroke();ctx.setLineDash([]);}
  if(!raster){
   const half=Math.ceil(n.radius*1.25+24),soft=n.id===selected||n.id===hover||moving?.id===n.id||softIds.has(n.id);
   const key=['body',n.radius,n.shape,n.style,n.color,n.icon,Boolean(n.members),n.state,muted,lens,soft,palette.strong,inBranch.has(n.id),Boolean(n.pinned&&prefs.pinning&&camera.zoom>.55),palette.background,palette.accent,palette.text,palette.muted].join('|');
   const image=rasterCache.get(key,half*2,half*2,p=>{p.translate(half-n.x,half-n.y);paintNode(p,true);});ctx.globalAlpha=opacity;ctx.drawImage(image,-half,-half,half*2,half*2);
  }else{
  const color=muted?palette.muted:n.color==='#b4ecc1'?palette.accent:n.color;const ink=inkFor(color,palette.background);
  // The outline and its highlight are rebuilt per frame otherwise: a new Path2D,
  // a new gradient and a fresh colour parse for every node, on every frame.
  const body=nodeShape(n.shape,n.radius);
  // The sheen is reserved for the nodes it is for; the rest of the field is
  // washed. What the hand holds and what the reader has chosen always keeps it.
  const mustHave=n.id===selected||n.id===hover||moving?.id===n.id;
  let fill=null;
  if(mustHave||softIds.has(n.id))fill=bodyGradient(color,n.radius);
  if(fill)ctx.fillStyle=fill;else ctx.fillStyle=color+'18';
  ctx.fill(body.path);
  ctx.strokeStyle=ink;ctx.lineWidth=palette.strong?2.6:inBranch.has(n.id)&&n.id!==selected?2.1:1.35;ctx.setLineDash(n.style==='dashed'?[5,4]:[]);ctx.stroke(body.path);ctx.setLineDash([]);
  // What the hand is holding, and what the reader is looking at, always keep
  // their glyph even once the budget is spent.
  if(mustHave||iconIds.has(n.id)&&iconLegible(n.radius,camera.zoom)){const size=n.members?24:22;ctx.drawImage(iconSprite(n.icon,ink,size),-size,-size,size*2,size*2);}    if(n.pinned&&prefs.pinning&&camera.zoom>.55){ctx.save();ctx.translate(n.radius-2,-n.radius-3);ctx.scale(.65,.65);ctx.rotate(.55);ctx.strokeStyle=palette.text;ctx.fillStyle=palette.background;ctx.lineWidth=1.8;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-5,-8);ctx.lineTo(5,-8);ctx.lineTo(3,-1);ctx.quadraticCurveTo(7,1,7,4);ctx.lineTo(-7,4);ctx.quadraticCurveTo(-7,1,-3,-1);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(0,4);ctx.lineTo(0,12);ctx.stroke();ctx.restore();}
   ctx.restore();return;
  }
  ctx.globalAlpha=opacity*(muted?.28:1);
   if(!raster&&(camera.zoom>.55||!grouped.has(n.id)||n.members||n.landmark||n.radius>36||n.id===selected)){
   const {text,show}=labelLayout.get(n.id)!;
   ctx.font=text.size+'px system-ui';ctx.textBaseline='top';
   if(show){
    for(const [i,title] of text.lines.entries()){
     const tileWidth=measureText(title,13)+6,scale=text.size/13,y=text.top+i*text.lineHeight;const tile=rasterCache.get('text:'+title+palette.background+palette.text,tileWidth,17,p=>{p.fillStyle=palette.background;p.fillRect(0,0,tileWidth,17);p.font='13px system-ui';p.textAlign='center';p.textBaseline='top';p.fillStyle=palette.text;p.fillText(title,tileWidth/2,0);});ctx.drawImage(tile,-tileWidth*scale/2,y,tileWidth*scale,17*scale);
    }
    if(text.caption){ctx.font=text.captionSize+'px system-ui';ctx.fillStyle=palette.muted;ctx.fillText(text.caption,0,text.captionTop);}
   }
  }
  ctx.restore();};
  if(accelerated){const {text,show}=labelLayout.get(n.id)!;const labels:GpuLabel[]=[],rings:GpuRing[]=[];
   if(show){for(const [i,title] of text.lines.entries())labels.push({text:title,x:0,y:text.top+i*text.lineHeight,size:text.size,color:palette.text,background:palette.background,alpha:muted?.28:1});if(text.caption)labels.push({text:text.caption,x:0,y:text.captionTop,size:text.captionSize,color:palette.muted,alpha:muted?.28:1});}
   const stateAlpha=(ambient&&lens==='archived'&&n.state==='archived'?1:n.state==='archived'?.35:n.state==='paused'?.6:1)*(muted?.25:1);
   if(n.id===hover&&n.id!==selected)rings.push({radius:n.radius+10,color:palette.text,width:1.6/camera.zoom,alpha:stateAlpha*.45,dashed:false});
   if(n.state==='now'||n.id===selected||(n.members||[n.id]).some(id=>selectedIds.has(id))||holdReady&&start?.node?.id===n.id)rings.push({radius:n.radius+8,color:n.id===selected?palette.text:palette.accent,width:1.5/camera.zoom,alpha:stateAlpha,dashed:n.state==='now'});
   const color=muted?palette.muted:n.color==='#b4ecc1'?palette.accent:n.color,ink=inkFor(color,palette.background),mustHave=n.id===selected||n.id===hover||moving?.id===n.id;
   gpuNodes.push({id:n.id,x:n.x,y:n.y,radius:n.radius,shape:n.shape,style:n.style,color,ink,strokeWidth:palette.strong?2.6:inBranch.has(n.id)&&n.id!==selected?2.1:1.35,soft:mustHave||softIds.has(n.id),icon:n.icon,iconSize:n.members?24:22,iconVisible:mustHave||iconIds.has(n.id)&&iconLegible(n.radius,camera.zoom),pinned:Boolean(n.pinned&&prefs.pinning),pinVisible:Boolean(n.pinned&&prefs.pinning&&camera.zoom>.55),pinColor:palette.text,pinFill:palette.background,bodyAlpha:stateAlpha,alpha:opacity,labels,rings});
  }else paintNode(ctx);
  }if(worldOverlay)ctx.restore();if(accelerated){try{if(!gpu!.paint(width,height,dpr,camera,gpuEdges,gpuNodes,gpuDots,gpuEdgeLabels))schedule();}catch(error){gpuFailed=true;console.warn('GPU renderer unavailable; using Canvas',error);schedule();}}
  if(lasso?.length){ctx.save();ctx.beginPath();ctx.moveTo(lasso[0].x,lasso[0].y);for(const p of lasso.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();ctx.fillStyle=palette.accent+'18';ctx.strokeStyle=palette.text;ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.fill();ctx.stroke();ctx.restore();}if(!pointers.size&&!rig.moving&&!model.arranging){previews=contentPreviews(ambient?painted.filter(n=>n.state===(lens==='now'?'now':'archived')):painted,camera,width,height,selected,previewHeights,previews);previewCamera={...camera};}
  if(!firstMap&&(!data.atoms.length||painted.length)){firstMap=true;performance.mark('phosphora:first-map');canvas.dataset.startupMs=String(Math.round(performance.now()));}
  // The camera is recorded once it comes to rest, independently of any level of
  // detail crossfade happening at the same moment.
  if(cameraMoving&&!rig.moving&&!pointers.size){cameraMoving=false;oncamera();}
  if((physicsEnabled?prefs.liveliness:0)&&painted.some(n=>!n.pinned)&&!reduced&&!paused&&!document.hidden&&!pointers.size||rig.moving&&!rig.gesturing||unsettled)schedule();
 }
 function position(e:{clientX:number;clientY:number}){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
 function world(p:Point){return screenToWorld(p,camera,{width,height});}
 function targetAt(p:Point,touch=false){if(camera.zoom>1.35&&!model.arranging){const scale=camera.zoom/previewCamera.zoom,x=(p.x-(width/2+camera.x-(width/2+previewCamera.x)*scale))/scale,y=(p.y-(height/2+camera.y-(height/2+previewCamera.y)*scale))/scale,preview=previews.find(box=>x>=box.x&&x<=box.x+box.width&&y>=box.y&&y<=box.y+box.height);if(preview)return{id:preview.id,part:'preview' as const};}return pickTarget(targets(),p,'',touch);}
 function nodeAt(p:Point,touch=false){const id=targetAt(p,touch).id;return id?(displayed.get(id)??model.nodes.find(n=>n.id===id)??null):null;}
 /** Pointer motion only proposes a candidate. It can never change what is selected. */
 function aim(p:Point,touch=false){const id=pickTarget(targets(),p,candidate,touch).id;if(id!==candidate){candidate=id;hover=id;onhover(id);}}
 /** Focus helps the camera only when the target is genuinely poorly placed. */
 function reveal(point:Point,desired:number){const next=revealCamera(camera,point,{width,height},desired);if(next)rig.retarget(next);}
 function down(e:PointerEvent){if(paused||!rendererSettled||data.atoms.length&&!painted.length||e.button!==0)return;frameStructure=false;connectFrom='';activeLink='';gestureActive=true;rig.halt();e.preventDefault();canvas.focus();adopt();controller?.setInteracting(true);const p=position(e);panSample={...p,time:performance.now()};panVelocity={x:0,y:0};pointers.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);
  if(pointers.size===2){stateTray=false;stateHover='';reportFolderDrag();touchFeedback=null;clearProposal();clearTimeout(longTimer);lasso=null;lassoing=false;holdReady=false;start=null;moving=null;pendingDrag=false;dragging=false;controller?.cancelDrag();fromPinch=true;const [a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);const screen={x:(a.x+b.x)/2,y:(a.y+b.y)/2};pinchStart={distance:pinch,zoom:camera.zoom};focal=screen;rig.pinchTo(screen,camera.zoom);schedule();return;}
  if(pointers.size>2)return;
  if(e.shiftKey&&providers.hasTool('lasso')){onselect('');lassoSelection=[];lassoing=true;lasso=[p];start=null;schedule();return;}
  const w=world(p),hit=targetAt(p,e.pointerType==='touch'),node=hit.id?(displayed.get(hit.id)??model.nodes.find(n=>n.id===hit.id)??null):null;candidate=node?.id||'';hover=candidate;recent=candidate;recentAt=performance.now();fromPinch=false;
  // A finger is big and imprecise, so only the body of an object is a handle.
  // Touching a label opens it; dragging from there pans the map, which is what
  // someone near a label was almost certainly trying to do.
  clearTimeout(feedbackTimer);touchFeedback={x:p.x,y:p.y,id:++feedbackId,held:false};holdStarted=performance.now();holdReady=false;touchStart=e.pointerType==='touch';const grabbable=Boolean(node)&&hit.part!=='preview'&&(hit.part==='body'||!touchStart);
  start={...p,worldX:w.x,worldY:w.y,section:hit.part==='preview'?'text':'',node:grabbable?node??undefined:undefined,target:node??undefined,panX:camera.x,panY:camera.y};
  if(node&&(node.members||[node.id]).some(id=>lassoSelection.includes(id))){const members=data.atoms.filter(a=>lassoSelection.includes(a.id));if(members.length&&start)start.node={...node,id:'selection',members:members.map(a=>a.id),x:members.reduce((s,a)=>s+a.x,0)/members.length,y:members.reduce((s,a)=>s+a.y,0)/members.length};}
  longTimer=setTimeout(()=>{if(!start||dragging)return;holdReady=true;playSound('hold');stateTray=Boolean(start.target||start.node);if(touchFeedback)touchFeedback={...touchFeedback,held:true};if(start.target&&!start.node)start.node=start.target;navigator.vibrate?.(15);schedule();},550);schedule();}
 function move(e:PointerEvent){if(touchFeedback){const q=position(e);if(Math.hypot(q.x-touchFeedback.x,q.y-touchFeedback.y)>8)touchFeedback=null;}adopt();
  // A pointer that was never pressed still has to produce a hover candidate:
  // what the user is looking at is not the same question as what they are holding.
  if(!pointers.has(e.pointerId)){if(pointers.size)return;aim(position(e),e.pointerType==='touch');schedule();return;}
  if(!pointers.has(e.pointerId))return;
  const p=position(e);pointers.set(e.pointerId,p);
  if(lasso){if(pointers.size===1&&Math.hypot(p.x-lasso.at(-1)!.x,p.y-lasso.at(-1)!.y)>3)lasso.push(p);schedule();return;}
  // Every path below can change the target camera, and the render loop is idle
  // whenever the camera is at rest, so each one has to ask for a frame.
  if(pointers.size>=2){const ids=[...pointers.keys()],a=pointers.get(ids[0])!,b=pointers.get(ids[1])!;
   const distance=Math.hypot(a.x-b.x,a.y-b.y),midpoint={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   // The gesture only ever states what the fingers ask for. The camera is still
   // reached through the rig, anchored to the point between them.
   if(pinchStart&&distance>0){focal=midpoint;rig.pinchTo(midpoint,pinchStart.zoom*distance/Math.max(1,pinchStart.distance));}
   pinch=distance;schedule();return;}
  if(!start){aim(p,e.pointerType==='touch');schedule();return;}
   if(start.moved||Math.hypot(p.x-start.x,p.y-start.y)>DRAG_THRESHOLD){start.moved=true;clearTimeout(longTimer);
    if(holdReady&&!start.target&&!fromPinch&&providers.hasTool('lasso')){onselect('');lassoSelection=[];lassoing=true;lasso=[{x:start.x,y:start.y},p];start=null;candidate='';hover='';schedule();return;}
    if(touchStart&&!holdReady)start.node=undefined;
    if(start.node){if(!dragging)start.dragOrigin=controller?.beginDrag(start.node.id,start.node.members);dragging=true;candidate='';hover='';const w=world(p);moving={...start.node,x:(start.dragOrigin?.x??start.node.x)+w.x-(start.worldX??w.x),y:(start.dragOrigin?.y??start.node.y)+w.y-(start.worldY??w.y)};pendingDrag=true;proposeLink(p);reportFolderDrag(e);stateHover=(document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-atom-state]') as HTMLElement|null)?.dataset.atomState as AtomState||'';}
   else{holdReady=false;holdStarted=Infinity;const now=performance.now(),dt=Math.max(1,now-panSample.time);panVelocity={x:Math.max(-3,Math.min(3,(p.x-panSample.x)/dt)),y:Math.max(-3,Math.min(3,(p.y-panSample.y)/dt))};panSample={...p,time:now};rig.trackTo({x:start.panX+(p.x-start.x),y:start.panY+(p.y-start.y),zoom:camera.zoom});}}
   else aim(p,e.pointerType==='touch');
   schedule();}
 let stateTray=$state(false),stateHover=$state<AtomState|'delete'|'pin'|'unpin'|''>('');
 let folderDragging=false,folderHover:string|null=null;
 function trayIds(){const n=moving||start?.node||start?.target;return n?(n.members||[n.id]).some(id=>lassoSelection.includes(id))?lassoSelection:n.members||[n.id]:[];}
 function draggedIds(){if(!moving)return [];return (moving.members||[moving.id]).some(id=>lassoSelection.includes(id))?lassoSelection:moving.members||[moving.id];}
 function reportFolderDrag(e?:PointerEvent){if(!e||!moving){if(folderDragging)onfolderdrag(null);folderDragging=false;folderHover=null;return;}const target=(document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-folder-id]') as HTMLElement|null)?.dataset.folderId||null;if(!folderDragging||target!==folderHover){folderDragging=true;folderHover=target;onfolderdrag({ids:draggedIds(),target});}}
 function up(e:PointerEvent){if(!pointers.has(e.pointerId))return;const droppedState=stateTray?(document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-atom-state]') as HTMLElement|null)?.dataset.atomState:undefined;const droppedFolder=(document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-folder-id]') as HTMLElement|null)?.dataset.folderId;stateTray=false;stateHover='';reportFolderDrag();clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>touchFeedback=null,160);if(moving)proposeLink(position(e));const drop=proposal?.ready?proposal:null;clearProposal();clearTimeout(longTimer);pointers.delete(e.pointerId);gestureActive=pointers.size>0;
  if(lasso){if(!pointers.size){finishLasso();start=null;holdReady=false;fromPinch=false;suppressReleaseClick=true;controller?.setInteracting(false);}return;}
  // A drag or a pinch ends: hand the camera back to the rig at its rest, then let
  // the spring carry whatever momentum is left over into a short settle.
  const gesture=rig.gesturing;
   if(gesture&&pinchStart){pinchStart=null;pinch=0;rig.endPinch();
    // The surviving finger must keep panning, otherwise pinch strands the gesture.
    if(pointers.size===1){const [remaining]=[...pointers.values()];start={...remaining,panX:rig.value.x,panY:rig.value.y};panSample={...remaining,time:performance.now()};panVelocity={x:0,y:0};}
    else start=null;
    schedule();return;}
  if(start){const p=position(e),travel=Math.hypot(p.x-start.x,p.y-start.y);
   const folderTarget=droppedFolder;
   if(moving&&droppedState&&['normal','now','archived','delete','pin','unpin'].includes(droppedState)){pendingDrag=false;controller?.cancelDrag();suppressReleaseClick=true;void onstates(draggedIds(),droppedState as AtomState|'delete'|'pin'|'unpin').catch(onerror);schedule();}
   else if(moving&&folderTarget){pendingDrag=false;controller?.cancelDrag();void onfolderdrop(folderTarget,draggedIds()).catch(onerror);schedule();}
   else if(moving){if(drop){pendingDrag=false;controller?.cancelDrag();suppressReleaseClick=true;const existing=data.links.find(l=>l.from===drop.source&&l.to===drop.target||l.from===drop.target&&l.to===drop.source);void relationships?.apply(existing||null,existing?null:makeLink(drop.source,drop.target));}else{if(pendingDrag){pendingDrag=false;controller?.drag(moving.id,moving.x,moving.y);}controller?.endDrag(false).catch(onerror);}schedule();}
    else if(travel<=DRAG_THRESHOLD&&!start.moved&&!fromPinch&&Number.isFinite(holdStarted)){
     const tapped=start.target;
     if(tapped&&lassoSelection.length>1&&(tapped.members||[tapped.id]).some(id=>lassoSelection.includes(id))){if(holdReady)onbranch(lassoSelection);else onselect(tapped.members?.[0]||tapped.id);}
     else if(holdReady&&tapped){tapped.members?onbranch(tapped.members):oncontext(tapped.id);}
     else
     if(tapped?.members){const root=resolveSelection(tapped.id,painted)||tapped.members[0];onselect(root);const target=fitted(tapped.members);scopeCamera=target;rig.retarget(target);schedule();}
     else if(tapped){lassoSelection=[];onselect(tapped.id);onopen(tapped.id,start.section);}
     else{if(!holdReady&&performance.now()-lastEmptyTap.time<320&&Math.hypot(p.x-lastEmptyTap.x,p.y-lastEmptyTap.y)<30){lastEmptyTap.time=-Infinity;if(camera.zoom>=MAX_ZOOM*.94)frameMap();else{rig.zoomAt(p,Math.min(2,MAX_ZOOM/camera.zoom));schedule();}start=null;holdReady=false;controller?.setInteracting(false);return;}lastEmptyTap={...p,time:performance.now()};candidate='';hover='';onselect('');activeLink=holdReady?'':pickLink([...(model.expanded?.links||[]),...model.links,...(providers.hasTool('ambient-lens')&&lens!=='all'?data.links:[])].filter(l=>data.links.some(original=>original.id===l.id)),painted.filter(n=>n.opacity>.3),camera,{width,height},p);if(holdReady){suppressReleaseClick=true;oncreate(start.worldX??world(start).x,start.worldY??world(start).y);}else lassoSelection=[];}}
    else if(!start.node&&!reduced&&performance.now()-panSample.time<90){rig.endPinch();rig.release(panVelocity);}}
  if(rig.gesturing)rig.endPinch();start=null;holdReady=false;moving=null;pendingDrag=false;dragging=false;candidate='';hover='';fromPinch=false;focal=undefined;controller?.setInteracting(false);schedule();}
 function cancel(){stateTray=false;stateHover='';reportFolderDrag();clearTimeout(feedbackTimer);touchFeedback=null;clearProposal();rig.halt();clearTimeout(longTimer);holdReady=false;holdStarted=Infinity;pinchStart=null;fromPinch=false;gestureActive=false;lassoing=false;lasso=null;pointers.clear();controller?.setInteracting(false);start=null;moving=null;pendingDrag=false;dragging=false;pinch=0;controller?.cancelDrag();schedule();}
 function leave(){candidate='';hover='';schedule();}
 onMount(()=>{let disposed=false;void import('./gpu-renderer').then(m=>m.GpuMapRenderer.create(schedule)).then(value=>{if(disposed)value.destroy();else{pendingGpu=value;schedule();}}).catch(error=>{console.warn('WebGL unavailable; using Canvas',error);}).finally(()=>{gpuStarting=false;rendererSettled=true;if(!disposed)schedule();});return()=>{disposed=true;gpu?.destroy();pendingGpu?.destroy();pendingGpu=null;};});
 onMount(()=>{window.addEventListener('phosphora-theme-change',invalidatePalette);const resetClick=()=>{suppressReleaseClick=false;rig.halt();};const releaseClick=(e:MouseEvent)=>{if(suppressReleaseClick){suppressReleaseClick=false;e.preventDefault();e.stopImmediatePropagation();}};window.addEventListener('pointerdown',resetClick,true);window.addEventListener('click',releaseClick,true);adopt();onviewport({width,height});rig.set(camera);controller=new GraphController(providers,m=>model=m,onpositions,onerror);const media=matchMedia('(prefers-reduced-motion: reduce)');reduced=media.matches;rig.setReduced(reduced);const motion=()=>{reduced=media.matches;rig.setReduced(reduced);};media.addEventListener('change',motion);const visibility=()=>{controller?.view($state.snapshot(camera),width,height,lens,selected,paused,reduced);if(document.hidden)controller?.flush();else schedule();};document.addEventListener('visibilitychange',visibility);const observer=new ResizeObserver(([entry])=>{width=entry.contentRect.width;height=entry.contentRect.height;onviewport({width,height});adopt();schedule();});observer.observe(canvas);
  const wheel=(e:WheelEvent)=>{e.preventDefault();adopt();const r=canvas.getBoundingClientRect();rig.zoomAt({x:e.clientX-r.left,y:e.clientY-r.top},wheelZoomFactor(e,height));schedule();};canvas.addEventListener('wheel',wheel,{passive:false});
  // Safari reports trackpad pinch as gesture events instead of a ctrl-modified wheel.
  let lastGesture=1;const gestureStart=(e:any)=>{lastGesture=e.scale;},gestureMove=(e:any)=>{e.preventDefault();adopt();const r=canvas.getBoundingClientRect();rig.zoomAt({x:e.clientX-r.left,y:e.clientY-r.top},gestureZoomFactor(e.scale,lastGesture));lastGesture=e.scale;schedule();};
  canvas.addEventListener('gesturestart',gestureStart);canvas.addEventListener('gesturechange',gestureMove);
  return()=>{clearTimeout(linkTimer);window.removeEventListener('phosphora-theme-change',invalidatePalette);window.removeEventListener('pointerdown',resetClick,true);window.removeEventListener('click',releaseClick,true);rig.halt();stopMotionSound();controller?.close();rasterCache.clear();observer.disconnect();media.removeEventListener('change',motion);document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('gesturestart',gestureStart);canvas.removeEventListener('gesturechange',gestureMove);clearTimeout(longTimer);cancelAnimationFrame(frame);};});
</script>
<!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role (Canvas implements a keyboard-operated graph application; search supplies an accessible list.) -->
<canvas data-renderer-loading={gpuStarting} data-renderer-pending={gpuStarting||Boolean(pendingGpu)} data-selection-count={lassoSelection.length} data-gesture={lassoing?'lasso':dragging?'drag':gestureActive?'touch':'idle'} data-renderer={renderBackend} data-camera-x={camera.x} data-camera-y={camera.y} data-zoom={camera.zoom} data-layout={model.arranging?'running':'idle'} data-transition={transitioning?'running':'idle'} data-visual-focus={visualFocus} data-focus={selected} data-hover={hover} data-context={painted.filter(n=>(n.attention??1)>.4).length} data-nodes={painted.filter(n=>n.opacity>.5).length} bind:this={canvas} class="map" class:gpu-active={renderBackend==='webgl'} role="application" aria-label="Карта атомов. Долгое нажатие или N для создания. Поиск для выбора, Enter для открытия, клавиши 1–4 для состояния." tabindex="0" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={cancel} onpointerleave={leave} oncontextmenu={e=>{e.preventDefault();if(pointers.size||dragging||'pointerType' in e&&e.pointerType==='touch')return;const n=nodeAt(position(e),true);if(n){if(lassoSelection.length>1&&(n.members||[n.id]).some(id=>lassoSelection.includes(id)))onbranch(lassoSelection);else n.members?onbranch(n.members):oncontext(n.id);}}} onkeydown={e=>{adopt();if(e.key.toLowerCase()==='n'){e.preventDefault();const point=world({x:width/2,y:height/2});onselect('');oncreate(point.x,point.y);}if(selected&&e.key==='Enter'){e.preventDefault();onopen(selected);}if(selected&&['1','2','3','4'].includes(e.key)){const state=(['normal','now','paused','archived'] as AtomState[])[Number(e.key)-1];if(lassoSelection.length>1&&lassoSelection.includes(selected))onstates(lassoSelection,state);else onstate(selected,state);}if(e.key==='Escape'){cancel();activeLink='';connectFrom='';lassoSelection=[];onselect('');}if(e.key==='+'||e.key==='=')rig.zoomStep(1.2);if(e.key==='-')rig.zoomStep(1/1.2);if(e.key.startsWith('Arrow')){e.preventDefault();rig.panBy(e.key==='ArrowLeft'?60:e.key==='ArrowRight'?-60:0,e.key==='ArrowUp'?60:e.key==='ArrowDown'?-60:0);}schedule();}}></canvas>
<div bind:this={gpuHost} class="gpu-map-host" hidden={renderBackend!=='webgl'} aria-hidden="true"></div>
<div class="content-previews" style:opacity={gestureActive||model.arranging?0:1} style:position="fixed" style:inset="0" style:pointer-events="none" style:transform-origin="0 0" style:transform={`translate(${width/2+camera.x-(width/2+previewCamera.x)*camera.zoom/previewCamera.zoom}px,${height/2+camera.y-(height/2+previewCamera.y)*camera.zoom/previewCamera.zoom}px) scale(${camera.zoom/previewCamera.zoom})`}>{#each previews as preview (preview.id)}{#await loadPreview() then m}<m.default {preview} onheight={previewHeight}/>{:catch}{/await}{/each}</div>

{#if proposal&&proposalTarget&&!paused}
 {@const a=screenPoint(proposal.from)}{@const b=screenPoint(proposalTarget)}
 <div class="drag-link-proposal" data-ready={proposal.ready} data-target={proposal.target}>
  <svg width={width} height={height} aria-hidden="true"><path d={`M ${a.x} ${a.y} Q ${(a.x+b.x)/2-12} ${(a.y+b.y)/2-20} ${b.x} ${b.y}`}/><circle cx={b.x} cy={b.y} r={proposalTarget.radius*camera.zoom+8}/></svg>
  <div class="drag-link-hint" role="status" style:left={`${Math.max(90,Math.min(width-90,b.x))}px`} style:top={`${Math.max(60,b.y-proposalTarget.radius*camera.zoom-48)}px`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2"/></svg><span>{proposal.duplicate?(proposal.ready?'Отпустите, чтобы убрать связь':'Задержите, чтобы убрать связь'):proposal.ready?'Отпустите для связи':'Задержите для связи'}</span></div>
 </div>
{/if}
<RelationshipLayer bind:this={relationships} {data} nodes={painted} {camera} {width} {height} selected={connectFrom} paused={paused||gestureActive} bind:activeLink bind:interacting={linkInteracting} onchange={onlinkchange}/>
<style>
 .drag-link-proposal{position:absolute;inset:0;pointer-events:none;z-index:4;color:var(--theme-text)}.drag-link-proposal>svg{position:absolute;inset:0;fill:none;stroke:currentColor;stroke-width:1.5;stroke-dasharray:5 5;opacity:.6}.drag-link-proposal[data-ready=true]>svg{stroke-dasharray:none;opacity:1}.drag-link-hint{position:absolute;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:16px;background:var(--theme-surface);box-shadow:0 3px 14px #0003;white-space:nowrap;font-size:13px}.drag-link-hint svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round}

 .state-drop-tray{position:absolute;z-index:6;bottom:calc(110px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);display:flex;gap:4px;padding:5px;border-radius:28px;background:var(--theme-surface);box-shadow:0 6px 26px #0003;width:min(360px,calc(100vw - 24px));max-width:calc(100vw - 24px);animation:tray-in 150ms var(--ease)}.state-drop-tray>div{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-width:0;flex:1;min-height:64px;padding:8px 10px;border-radius:22px;font-size:11px;color:var(--theme-muted)}.state-drop-tray>div.chosen{background:color-mix(in srgb,var(--theme-accent),transparent 80%);color:var(--theme-text)}.state-drop-tray svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}.state-drop-tray span{pointer-events:none}@keyframes tray-in{from{opacity:0;translate:0 4px}to{opacity:1;translate:0 0}}@media(prefers-reduced-motion:reduce){.state-drop-tray{animation:none}}

 .state-drop-tray>div[data-atom-state=delete]{color:var(--theme-danger)}.state-drop-tray>div[data-atom-state=delete].chosen{background:color-mix(in srgb,var(--theme-danger),transparent 85%);color:var(--theme-danger)}
</style>

<TouchFeedback point={paused?null:touchFeedback} {reduced}/>
{#if zoomOptions}<ZoomControl options={zoomOptions} value={sliderValue()} percent={Math.round(camera.zoom*100)} onvalue={zoomSlider}/>{/if}

{#if stateTray&&!paused}
 <div class="state-drop-tray" role="list" aria-label="Перенести заметки">
 {#each [['now','Сейчас'],['normal','Обычные'],['archived','Архив'],[trayIds().every(id=>data.atoms.find(a=>a.id===id)?.pinned)?'unpin':'pin',trayIds().every(id=>data.atoms.find(a=>a.id===id)?.pinned)?'Открепить':'Закрепить'],['delete','Удалить']] as [state,label]}<div role="listitem" class:chosen={stateHover===state} data-atom-state={state}><svg viewBox="0 0 24 24" aria-hidden="true">{#if state==='now'}<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>{:else if state==='archived'}<path d="M4 4h16v4H4zM6 8v12h12V8M10 12h4"/>{:else if state==='pin'||state==='unpin'}<path d="m9 3 6 0-1 6 4 4v2H6v-2l4-4-1-6M12 15v6"/>{#if state==='unpin'}<path d="m4 3 16 18"/>{/if}{:else if state==='delete'}<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>{:else}<circle cx="12" cy="12" r="7"/>{/if}</svg><span>{label}</span></div>{/each}
 </div>
{/if}
