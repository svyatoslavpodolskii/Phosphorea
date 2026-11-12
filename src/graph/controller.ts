import {dragWeights} from './drag-response';
import {activeNeighborhood} from './activity';
import {semanticLevel} from './semantic';
import {collapseAmount,topologyKey} from './lod';
import {structure} from './structure';
import {footprint} from './footprint';
import type {Snapshot,PositionUpdate} from '../core/model';
import type {Preferences} from '../core/preferences';
import type {GraphProviders,StructuralProvider,PhysicsProvider} from './providers';
import type {GraphModel,Camera} from './model';
import type {Body,PhysicsInput} from './physics';
export class GraphController {
 private manualRest=false;
 private motionProvider?:PhysicsProvider;
 private settling?:Set<string>;
 private responseWeights=new Map<string,number>();
 private dragPaint:{node:{id:string;x:number;y:number;members?:string[]};x:number;y:number;weight:number}[]=[];
 private reflow?:{started:number|null;origins:Map<string,{x:number;y:number}>;targets:Map<string,{x:number;y:number}>};
 private layoutVersion=0;private arranging=false;private structuralProvider?:StructuralProvider;
 private membership=new Map<string,{component:string;branch:string}>();private restLengths=new Map<string,number>();private topology='';private skeleton=new Set<string>();private motionVersion=0;private dragOrigins=new Map<string,{x:number;y:number;resistance:number}>();private dragCenter={x:0,y:0};
 private bodies=new Map<string,Body>();private snapshot:Snapshot={atoms:[],links:[]};private model:GraphModel={nodes:[],links:[],hidden:0};private signature='';private projectId=0;private timer:ReturnType<typeof setTimeout>|undefined;private disposed=false;private active=false;private busy=false;private quiet=0;private paused=false;private dirty=new Set<string>();private persistBusy=false;private persistedAt=0;private edited=new Set<string>();private dragged?:{id:string;x:number;y:number;resistance:number};
  private prefs!:Preferences;private camera:Camera={x:0,y:0,zoom:1};private width=1200;private height=800;private lens='all';private selected='';private reduced=false;private collapsed=false;private cloned?:Snapshot;private clonedFor='';private branch:string[]=[];private branchKey='';private interacting=false;
 private shown?:import('./model').GraphModel;private projectPending=false;
 constructor(private providers:GraphProviders,private render:(model:GraphModel)=>void,private persist:(positions:PositionUpdate[],manual:boolean)=>Promise<void>,private error:(e:Error)=>void){}
 sync(data:Snapshot,prefs:Preferences,providerVersion:number,preservePositions=false){const firstSnapshot=!this.signature;const provider=this.providers.structural(prefs.graphModel),motionProvider=this.providers.motion(prefs.graphModel);const providerChanged=Boolean(this.motionProvider&&this.motionProvider!==motionProvider);this.motionProvider=motionProvider;const modeChanged=Boolean(this.prefs&&(this.prefs.preset!==prefs.preset||this.prefs.graphModel!==prefs.graphModel||this.prefs.physics.distance!==prefs.physics.distance||this.structuralProvider!==provider));this.structuralProvider=provider;const previous=new Map(this.snapshot.atoms.map(a=>[a.id,a]));const oldLinks=new Map(this.snapshot.links.map(l=>[l.id,l]));const newLinks=new Map(data.links.map(l=>[l.id,l]));for(const l of [...this.snapshot.links,...data.links]){const old=oldLinks.get(l.id),next=newLinks.get(l.id);if(!old||!next||old.relation!==next.relation||old.from!==next.from||old.to!==next.to){this.edited.add(l.from);this.edited.add(l.to);this.restLengths.delete(l.id);}}preservePositions=preservePositions||data.atoms.length<previous.size&&data.atoms.every(a=>previous.get(a.id)?.revision===a.revision);const motionChanged=providerChanged||modeChanged||data.atoms.length!==previous.size||data.atoms.some(a=>previous.get(a.id)?.revision!==a.revision||previous.get(a.id)?.pinned!==a.pinned)||data.links.length!==oldLinks.size||data.links.some(l=>{const old=oldLinks.get(l.id);return !old||old.from!==l.from||old.to!==l.to||old.relation!==l.relation;});if(motionChanged){this.motionVersion++;if(this.dragged)this.cancelDrag();this.settling=undefined;}if(preservePositions){this.active=false;this.motionVersion++;clearTimeout(this.timer);this.timer=undefined;for(const body of this.bodies.values()){body.vx=body.vy=0;body.target=undefined;}}this.snapshot=data;this.prefs=prefs;const signature=JSON.stringify([data.atoms.map(a=>[a.id,a.revision,a.pinned,a.appearance,a.importance]),data.links.map(l=>[l.id,l.from,l.to,l.relation]),[prefs.physics,prefs.preset,prefs.pinning,prefs.graphModel],providerVersion]);const changed=signature!==this.signature||providerChanged;this.signature=signature;const ids=new Set(data.atoms.map(a=>a.id));for(const id of this.bodies.keys())if(!ids.has(id)){this.bodies.delete(id);this.dirty.delete(id);}
 for(const a of data.atoms){const b=this.bodies.get(a.id);if(!b){this.bodies.set(a.id,{id:a.id,x:a.x,y:a.y,vx:0,vy:0,radius:a.appearance.size_override||30,mass:1+a.importance*.3,pinned:a.pinned,resistance:a.spatial.resistance});if(previous.size&&this.edited.size<100)this.edited.add(a.id);}else if(b.pinned!==a.pinned){b.pinned=a.pinned;b.resistance=0;b.vx=b.vy=0;this.edited.add(a.id);}if(b){b.mass=1+a.importance*.3;const prior=previous.get(a.id);if(prior&&prior.revision!==a.revision)this.edited.add(a.id);if(prior&&prior.revision!==a.revision&&(prior.x!==a.x||prior.y!==a.y)){b.x=a.x;b.y=a.y;b.vx=b.vy=0;b.resistance=a.spatial.resistance;this.dirty.delete(a.id);}}}
 const inserted=data.atoms.filter(a=>!previous.has(a.id)).map(a=>a.id);if(previous.size&&inserted.length&&!preservePositions){for(const id of activeNeighborhood(data,this.bodies,inserted)){const body=this.bodies.get(id);if(body&&!body.pinned)body.resistance=Math.min(body.resistance,prefs.physics.friction*1.5);}}
 for(const l of data.links)if(!this.restLengths.has(l.id)){const a=this.bodies.get(l.from),b=this.bodies.get(l.to);if(a&&b)this.restLengths.set(l.id,Math.hypot(a.x-b.x,a.y-b.y));}
 if(motionChanged){this.reflow=undefined;this.manualRest=firstSnapshot||preservePositions;}
 const topology=JSON.stringify([data.atoms.map(a=>a.id).sort(),data.links.map(l=>[l.id,l.from,l.to].join('|')).sort()]);if(topology!==this.topology||modeChanged){const first=!this.topology,significant=!first&&Math.abs(data.atoms.length-previous.size)>5&&Math.abs(data.atoms.length-previous.size)>previous.size*.15;this.topology=topology;const tree=structure(data);this.membership.clear();for(const root of tree.roots){this.membership.set(root,{component:root,branch:root});for(const branch of tree.children.get(root)||[])for(const id of tree.descendants(branch))this.membership.set(id,{component:root,branch});}for(const l of data.links){if(!oldLinks.has(l.id)&&previous.has(l.from)&&previous.has(l.to))for(const id of [l.from,l.to]){const b=this.bodies.get(id);if(b&&!b.pinned)b.resistance=Math.min(b.resistance,prefs.physics.friction*2);}}if(!preservePositions&&(first||significant||modeChanged))void this.arrange(data,previous,first,significant,modeChanged,signature);else{this.layoutVersion++;this.arranging=false;this.skeleton=structure(data).edges;} }

 if(changed){this.signature=signature;this.project();if(motionChanged)this.wake();}}
 private async arrange(data:Snapshot,previous:Map<string,Snapshot['atoms'][number]>,first:boolean,significant:boolean,modeChanged:boolean,signature:string){const version=++this.layoutVersion,motion=this.motionVersion;this.arranging=true;this.paint();try{const locked=new Set(data.atoms.filter(a=>a.pinned||(!modeChanged&&Boolean((a.properties.obsidian as Record<string,unknown>|undefined)?.phosphored_position))).map(a=>a.id));const provider=this.structuralProvider;const live={...data,atoms:data.atoms.map(a=>{const b=this.bodies.get(a.id);return b?{...a,x:b.x,y:b.y}:a;})};const livePoints=new Map(live.atoms.map(a=>[a.id,a]));const result=provider?await provider.arrange({data:structuredClone(live),settings:{...this.prefs.physics},intent:first?'resume':'reflow',locked:[...locked]}):{positions:live.atoms.map(a=>({id:a.id,x:a.x,y:a.y})),skeleton:[...structure(data).edges]};if(version!==this.layoutVersion||motion!==this.motionVersion||this.disposed)return;if(signature!==this.signature){void this.arrange(this.snapshot,previous,first,significant,modeChanged,this.signature);return;}
 const ids=new Set(data.atoms.map(a=>a.id)),linkIds=new Set(data.links.map(l=>l.id));if(!result||!Array.isArray(result.positions)||result.positions.length!==ids.size||new Set(result.positions.map(p=>p.id)).size!==ids.size||result.positions.some(p=>!ids.has(p.id)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e7||Math.abs(p.y)>1e7)||!Array.isArray(result.skeleton)||result.skeleton.some(id=>!linkIds.has(id)))throw Error('Invalid structural provider result');const points=new Map(result.positions.map(p=>[p.id,p]));for(const a of data.atoms)if(locked.has(a.id)&&(points.get(a.id)!.x!==livePoints.get(a.id)!.x||points.get(a.id)!.y!==livePoints.get(a.id)!.y))throw Error('Structural provider moved a locked atom');this.skeleton=new Set(result.skeleton);
 const targets=new Map<string,{x:number;y:number}>(),origins=new Map<string,{x:number;y:number}>();
 for(const a of data.atoms){const b=this.bodies.get(a.id);if(!b||a.pinned)continue;const importedPosition=Boolean((a.properties.obsidian as Record<string,unknown>|undefined)?.phosphored_position);b.target=undefined;b.vx=b.vy=0;if(significant&&!importedPosition||modeChanged){const target=points.get(a.id)!;targets.set(a.id,{x:target.x,y:target.y});origins.set(a.id,{x:b.x,y:b.y});}}
 if(targets.size){this.reflow={started:null,targets,origins};this.manualRest=false;}this.project();
 }catch(e){if(version===this.layoutVersion&&!this.disposed)this.error(e as Error);}finally{if(version===this.layoutVersion){this.arranging=false;this.paint();this.wake();}}}
 /** A requested structure is a bounded transition, not an endless force target. */
 private advanceReflow(){const motion=this.reflow;if(!motion)return;motion.started??=Date.now();const t=this.reduced?1:Math.min(1,(Date.now()-motion.started)/380),k=1-(1-t)**3;
  for(const [id,target] of motion.targets){const body=this.bodies.get(id),origin=motion.origins.get(id);if(!body||!origin||body.pinned)continue;body.x=origin.x+(target.x-origin.x)*k;body.y=origin.y+(target.y-origin.y)*k;body.vx=body.vy=0;body.target=undefined;body.resistance=0;this.dirty.add(id);}
  if(t===1){this.captureRestLengths();this.reflow=undefined;this.manualRest=true;this.active=false;this.edited.clear();void this.flush();}this.paint();
 }
 view(camera:Camera,width:number,height:number,lens:string,selected:string,paused:boolean,reduced:boolean){const collapsed=semanticLevel(camera.zoom,this.collapsed);const project=lens!==this.lens||selected!==this.selected;this.collapsed=collapsed;const resumed=this.paused&&!paused;this.camera={...camera};this.width=width;this.height=height;this.lens=lens;this.selected=selected;this.paused=paused;this.reduced=reduced;if(project)this.project();if(resumed&&this.active||this.reflow&&!paused&&!document.hidden)this.wake();if(paused)this.flush();}
  private async project(){if(this.interacting||this.dragged){this.projectPending=true;return;}const id=++this.projectId;try{
  // The projection inputs only change with the snapshot. Crossing a level boundary
  // reuses the last stable copy rather than rebuilding the world.
  if(this.clonedFor!==this.signature){this.cloned=structuredClone(this.snapshot);this.clonedFor=this.signature;this.branchKey='';}
  const original=this.cloned!;const reduced=await this.providers.active(this.providers.reduction).reduce({data:original,selected:this.selected});const known=new Map(original.links.map(l=>[l.id,l]));if(!Array.isArray(reduced)||reduced.some(l=>!known.has(l.id)))throw Error('Провайдер связей вернул неизвестные данные.');const data={...original,links:reduced.map(l=>known.get(l.id)!)};const [model,expanded,weights]=await Promise.all([this.providers.active(this.providers.clustering).project({data:original,lens:this.providers.hasTool('ambient-lens')?'ambient':this.lens,zoom:.3,selected:this.selected}),this.providers.active(this.providers.clustering).project({data:original,lens:this.providers.hasTool('ambient-lens')?'ambient':this.lens,zoom:1,selected:this.selected}),this.providers.active(this.providers.weight).weigh(original)]);if(id!==this.projectId||this.disposed)return;if(this.interacting||this.dragged){this.projectPending=true;return;}if(!model||!Array.isArray(model.nodes)||!Array.isArray(model.links))throw Error('Некорректная проекция карты.');for(const a of original.atoms){const b=this.bodies.get(a.id),weight=weights[a.id];if(b&&weight!==undefined){if(!Number.isFinite(weight))throw Error("Invalid node weight");const shape=a.appearance.shape||(a.type==="task"?"square":"circle");const radius=Math.max(18,Math.min(64,weight))*(shape==="diamond"?1.2:shape==="square"?Math.SQRT2:1);if(b.radius!==radius)this.edited.add(a.id);b.radius=radius;Object.assign(b,footprint(a.title,radius,Boolean(a.content)));}}for(const n of [...model.nodes,...expanded.nodes]){if(!Number.isFinite(n.x)||!Number.isFinite(n.y))throw Error('Некорректная позиция кластера.');const radius=weights[n.id];if(radius!==undefined){if(!Number.isFinite(radius))throw Error('Некорректный вес атома.');n.radius=Math.max(18,Math.min(64,radius));const b=this.bodies.get(n.id);if(b)b.radius=n.radius*(n.shape==='diamond'?1.2:n.shape==='square'?Math.SQRT2:1);}}
  const branch=this.branchFor(original);const reducedIds=new Set(reduced.map(l=>l.id));const shownLinks=model.links.filter(l=>reducedIds.has(l.id));this.model={...model,expanded:{...expanded,links:expanded.links.filter(l=>reducedIds.has(l.id))},links:shownLinks,branch,hidden:original.links.length-shownLinks.length};this.paint();}catch(e){if(!this.disposed)this.error(e as Error);}}
  /** Members of the focused branch, so the map can light its skeleton without a frame. */
  private branchFor(data:Snapshot):string[]{if(!this.selected)return[];const key=this.selected+':'+topologyKey(data);if(this.branchKey===key)return this.branch;this.branchKey=key;this.branch=structure(data).descendants(this.selected);return this.branch;}
 private paint(){const position=(n:import('./model').GraphNode)=>{const b=this.bodies.get(n.id);if(b)return{...n,x:b.x,y:b.y};if(n.members){const members=n.members.map(id=>this.bodies.get(id)).filter((b):b is Body=>Boolean(b));if(members.length)return{...n,x:members.reduce((s,b)=>s+b.x,0)/members.length,y:members.reduce((s,b)=>s+b.y,0)/members.length};}return n;};const nodes=this.model.nodes.map(position);const expanded=this.model.expanded?{...this.model.expanded,nodes:this.model.expanded.nodes.map(position)}:undefined;const grouped=new Set(this.model.nodes.flatMap(n=>n.members||[]));const satellites=this.snapshot.atoms.filter(a=>grouped.has(a.id)).map(a=>({id:a.id,x:this.bodies.get(a.id)?.x??a.x,y:this.bodies.get(a.id)?.y??a.y,color:a.appearance.color||'#b4ecc1'}));this.shown={...this.model,expanded,nodes,satellites,arranging:this.arranging||Boolean(this.reflow)};this.render(this.shown);}
 /** A drag moves a few bodies, but a hand sends pointer events far faster than
  *  frames arrive. Rebuilding the whole projection per event is what made a drag
  *  feel like it was fighting the pointer, so during one only the coordinates that
  *  actually changed are written, in place, into the projection the renderer is
  *  already showing, with nothing reallocated and no reactive rebuild. */
 private captureRestLengths(){for(const l of this.snapshot.links){const a=this.bodies.get(l.from),b=this.bodies.get(l.to);if(a&&b)this.restLengths.set(l.id,Math.hypot(a.x-b.x,a.y-b.y));}}
 private prepareDragPaint(){
  this.dragPaint=[];const shown=this.shown||this.model;
  const add=(node:{id:string;x:number;y:number;members?:string[]})=>{
   const body=this.bodies.get(node.id),weight=this.responseWeights.get(node.id);
   if(body){if(weight!==undefined)this.dragPaint.push({node,x:body.x,y:body.y,weight});return;}
   if(!node.members)return;
   let x=0,y=0,total=0,count=0;
   for(const id of node.members){const b=this.bodies.get(id);if(b){x+=b.x;y+=b.y;count++;total+=this.responseWeights.get(id)||0;}}
   if(count&&total)this.dragPaint.push({node,x:x/count,y:y/count,weight:total/count});
  };
  for(const node of shown.nodes)add(node);
  for(const node of shown.expanded?.nodes||[])add(node);
  for(const node of shown.satellites||[])add(node);
 }
 private input():PhysicsInput {const activeIds=activeNeighborhood(this.snapshot,this.bodies,[...this.dragOrigins.keys(),...this.edited]);const core=new Set([...(this.settling||[]),...activeIds]);const all=new Set(core);for(const l of this.snapshot.links){if(core.has(l.from))all.add(l.to);if(core.has(l.to))all.add(l.from);}const allowed=new Set([...all].slice(0,800));const nodes=[...allowed].map(id=>this.bodies.get(id)).filter((b):b is Body=>Boolean(b)).map(b=>({...b,...this.membership.get(b.id),boundary:this.settling?!this.settling.has(b.id):!activeIds.has(b.id),dragged:this.dragOrigins.has(b.id)}));return{nodes,links:this.snapshot.links.filter(l=>allowed.has(l.from)&&allowed.has(l.to)).map(l=>({from:l.from,to:l.to,strength:this.skeleton.has(l.id)?1:.04,distance:this.restLengths.get(l.id)??Math.max(this.prefs.physics.distance,(this.bodies.get(l.from)?.halfWidth||35)+(this.bodies.get(l.to)?.halfWidth||35)+35)*(this.membership.get(l.from)?.branch!==this.membership.get(l.to)?.branch?1.35:1)})),settings:this.prefs.physics,mode:this.prefs.preset,dt:1,reducedMotion:this.reduced};}
 private motionEnabled=true;
 setMotionEnabled(enabled:boolean){if(this.motionEnabled===enabled)return;this.motionEnabled=enabled;this.motionVersion++;if(!enabled){this.active=false;clearTimeout(this.timer);this.timer=undefined;}else this.wake();}
 private wake(){if(!this.motionEnabled||this.disposed||!this.prefs||this.manualRest)return;this.active=true;this.quiet=0;if(this.interacting||this.paused||document.hidden)return;if(!this.timer)this.timer=setTimeout(()=>this.tick(),16);}
 private async tick(){this.timer=undefined;if(this.disposed||this.busy||this.arranging)return;if(this.paused||document.hidden){this.active=false;this.flush();return;}
  // Pointer, wheel, camera, hit testing and drag always outrank the simulation.
  // A gesture in flight stops the background step outright, and the last stable
  // world state stays on screen rather than a half computed one.
  if(this.interacting)return;
  this.busy=true;const version=this.motionVersion,signature=this.signature,provider=this.providers.motion(this.prefs.graphModel);try{if(this.reflow){this.advanceReflow();return;}const input=this.input();if(!input.nodes.length){this.active=false;return;}const result=await provider.step(input);if(this.disposed||version!==this.motionVersion||signature!==this.signature||provider!==this.providers.motion(this.prefs.graphModel))return;if(!result||!Array.isArray(result.nodes))throw Error('Physics provider вернул некорректный кадр.');let energy=0;const originals=new Map(input.nodes.map(n=>[n.id,n]));for(const n of result.nodes){const old=originals.get(n.id),b=this.bodies.get(n.id);if(!old||!b||b.pinned||old.boundary||this.dragOrigins.has(b.id))continue;if(![n.x,n.y,n.vx,n.vy,n.resistance].every(Number.isFinite))throw Error('Physics provider вернул нечисловое значение.');const dx=n.x-b.x,dy=n.y-b.y;const d=Math.hypot(dx,dy);const limit=12;const ratio=d>limit?limit/d:1;b.x+=dx*ratio;b.y+=dy*ratio;b.vx=n.vx;b.vy=n.vy;b.resistance=Math.max(0,Math.min(10000,n.resistance));if(d>.000001)this.dirty.add(b.id);energy+=d;}
 this.paint();if(energy<.001)this.quiet++;else this.quiet=0;if(Date.now()-this.persistedAt>180)this.flush();if(this.quiet>12&&!this.dragged){this.active=false;this.settling=undefined;this.edited.clear();this.flush();}
 }catch(e){if(!this.disposed&&version===this.motionVersion&&signature===this.signature&&provider===this.providers.motion(this.prefs.graphModel)){this.active=false;this.error(e as Error);}}finally{this.busy=false;if(this.active&&!this.disposed)this.timer=setTimeout(()=>this.tick(),this.reflow?16:32);}}
  private heldIds=new Set<string>();
 private dragVersion=0;
  beginDrag(id:string,members?:string[]){
  if(this.dragged)this.cancelDrag();
  this.dragVersion++;if(this.reflow)this.captureRestLengths();this.reflow=undefined;this.layoutVersion++;this.arranging=false;this.motionVersion++;
  this.dragOrigins.clear();this.responseWeights.clear();this.dragBonds.clear();this.dragEnergy=0;this.dragPaint=[];this.settling=undefined;
  const ids=[...new Set(members||[id])].filter(key=>{const b=this.bodies.get(key);return b&&!b.pinned;});
  if(!ids.length)return;
  this.heldIds=new Set(ids);this.responseWeights=this.motionEnabled?dragWeights(this.snapshot,ids,this.bodies,this.prefs.physics.distance):new Map();
  for(const key of ids)this.responseWeights.set(key,1);
  this.dragBonds.clear();for(const link of this.snapshot.links){const a=this.bodies.get(link.from),b=this.bodies.get(link.to);if(!a||!b)continue;const length=Math.hypot(a.x-b.x,a.y-b.y);for(const [from,to] of [[a,b],[b,a]]){const list=this.dragBonds.get(from.id)||[];list.push({id:to.id,length});this.dragBonds.set(from.id,list);}}
  this.edited.clear();
  for(const [key] of this.responseWeights){const b=this.bodies.get(key)!;this.dragOrigins.set(key,{x:b.x,y:b.y,resistance:b.resistance});b.vx=b.vy=0;b.target=undefined;this.edited.add(key);}
  this.dragCenter={x:ids.reduce((sum,key)=>sum+this.bodies.get(key)!.x,0)/ids.length,y:ids.reduce((sum,key)=>sum+this.bodies.get(key)!.y,0)/ids.length};
  this.dragged={id,...this.dragCenter,resistance:0};this.active=false;clearTimeout(this.timer);this.timer=undefined;
  this.prepareDragPaint();return {...this.dragCenter};
 }
 private dragBonds=new Map<string,{id:string;length:number}[]>();
 private dragEnergy=0;
 advanceDrag(dt=16){if(!this.dragged||this.dragEnergy<.01)return false;if(dt===0)return true;const held=[...this.heldIds].map(id=>this.bodies.get(id)!).filter(Boolean);if(!held.length)return false;this.drag(this.dragged.id,held.reduce((s,b)=>s+b.x,0)/held.length,held.reduce((s,b)=>s+b.y,0)/held.length,dt);return this.dragEnergy>=.01;}
 drag(id:string,x:number,y:number,dt=16){
  if(this.dragged?.id!==id||!Number.isFinite(x)||!Number.isFinite(y))return;
  const dx=x-this.dragCenter.x,dy=y-this.dragCenter.y;
  const step=Math.max(.25,Math.min(2,dt/16));this.dragEnergy=0;
  // Held bodies follow the hand; links transmit tension, never its translation.
  // Slack leaves the neighbour free while the held atom moves around it.
  for(const key of this.heldIds){const b=this.bodies.get(key),o=this.dragOrigins.get(key);if(b&&o){b.x=o.x+dx;b.y=o.y+dy;b.vx=b.vy=0;}}
  for(const [key,origin] of this.dragOrigins){const b=this.bodies.get(key);if(!b||b.pinned||this.heldIds.has(key))continue;
   let fx=(origin.x-b.x)*.006,fy=(origin.y-b.y)*.006;
   for(const bond of this.dragBonds.get(key)||[]){const a=this.bodies.get(bond.id);if(!a)continue;const x=a.x-b.x,y=a.y-b.y,d=Math.max(.01,Math.hypot(x,y)),tension=Math.max(0,d-bond.length)*.035;fx+=x/d*tension;fy+=y/d*tension;}
   b.vx=(b.vx+fx*step)*Math.pow(.72,step);b.vy=(b.vy+fy*step)*Math.pow(.72,step);const speed=Math.hypot(b.vx,b.vy);if(speed>24){b.vx*=24/speed;b.vy*=24/speed;}b.x+=b.vx*step;b.y+=b.vy*step;this.dragEnergy+=Math.hypot(b.vx,b.vy)+Math.hypot(fx,fy);
  }
  for(const entry of this.dragPaint){const body=this.bodies.get(entry.node.id);if(body){entry.node.x=body.x;entry.node.y=body.y;}else if(entry.node.members){const members=entry.node.members.map(id=>this.bodies.get(id)).filter((b):b is Body=>Boolean(b));if(members.length){entry.node.x=members.reduce((v,b)=>v+b.x,0)/members.length;entry.node.y=members.reduce((v,b)=>v+b.y,0)/members.length;}}}
 }
 async endDrag(stateDrop:boolean){
  this.motionVersion++;const version=this.dragVersion,signature=this.signature,provider=this.providers.motion(this.prefs.graphModel);if(!this.dragged)return;
  const origins=new Map(this.dragOrigins),positions:PositionUpdate[]=[],wasDirty=new Set([...origins.keys()].filter(id=>this.dirty.has(id)));
  for(const [id,origin] of origins){const b=this.bodies.get(id);if(!b||b.pinned)continue;if(stateDrop)Object.assign(b,origin);else b.resistance=0;b.vx=b.vy=0;this.dirty.delete(id);positions.push({id,x:b.x,y:b.y,resistance:b.resistance});}
  this.dragged=undefined;this.dragOrigins.clear();this.responseWeights.clear();this.dragBonds.clear();this.dragEnergy=0;this.dragPaint=[];this.manualRest=true;this.active=false;clearTimeout(this.timer);this.timer=undefined;
  try{await this.persist(positions,true);}catch(error){
   if(!this.disposed&&version===this.dragVersion&&signature===this.signature&&provider===this.providers.motion(this.prefs.graphModel)){for(const [id,origin] of origins){const body=this.bodies.get(id);if(body&&!body.pinned){Object.assign(body,origin,{vx:0,vy:0});if(wasDirty.has(id))this.dirty.add(id);}}this.paint();}
   throw error;
  }
  if(this.disposed||version!==this.dragVersion||signature!==this.signature||provider!==this.providers.motion(this.prefs.graphModel))return;
  this.paint();if(!stateDrop){this.settling=new Set(origins.keys());this.manualRest=false;this.wake();}
 }
 cancelDrag(){
  this.dragVersion++;this.motionVersion++;
  for(const [id,origin] of this.dragOrigins){const b=this.bodies.get(id);if(b&&!b.pinned)Object.assign(b,origin,{vx:0,vy:0});}
  this.dragOrigins.clear();this.responseWeights.clear();this.dragBonds.clear();this.dragEnergy=0;this.dragPaint=[];this.dragged=undefined;this.paint();
 }
 async flush(){if(this.interacting||this.persistBusy||!this.dirty.size||this.disposed)return;const ids=[...this.dirty].filter(id=>!this.dragOrigins.has(id));if(!ids.length)return;const positions=ids.map(id=>this.bodies.get(id)).filter((b):b is Body=>Boolean(b)).map(b=>({id:b.id,x:b.x,y:b.y,resistance:b.resistance}));ids.forEach(id=>this.dirty.delete(id));this.persistBusy=true;try{await this.persist(positions,false);this.persistedAt=Date.now();}catch(e){ids.forEach(id=>this.dirty.add(id));this.active=false;this.error(e as Error);}finally{this.persistBusy=false;}}
 close(){this.disposed=true;clearTimeout(this.timer);this.projectId++;this.layoutVersion++;}
  setInteracting(active:boolean){if(active===this.interacting)return;this.interacting=active;if(active){if(this.reflow){this.captureRestLengths();this.reflow=undefined;this.manualRest=true;this.active=false;this.paint();}this.motionVersion++;clearTimeout(this.timer);this.timer=undefined;}else{if(this.projectPending){this.projectPending=false;void this.project();}if(this.active)this.wake();else void this.flush();}}
}
