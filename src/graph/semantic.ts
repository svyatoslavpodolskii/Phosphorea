import type {Link} from '../core/model';
import type {GraphModel,GraphNode} from './model';

export function semanticLevel(zoom:number,collapsed:boolean){return collapsed?zoom<.56:zoom<.42;}
export interface PaintedNode extends GraphNode{opacity:number}
type Endpoint={x:number;y:number;radius:number};
export interface PaintedLink extends Link{opacity:number;start?:Endpoint;end?:Endpoint}

/** Retained visual state. The simulation and saved coordinates never see this layer. */
export class SemanticScene{
 private memo?:{model:GraphModel;collapse:number;value:{nodes:PaintedNode[];links:PaintedLink[];active:boolean}};
 private nodes=new Map<string,PaintedNode>();
 private links=new Map<string,PaintedLink>();
 private arrivals=new Map<string,number>();private arrivalsReady=false;
  advance(model:GraphModel,dt:number,reduced=false,dragging='',collapse=1){
   if(!dragging&&this.memo?.model===model&&this.memo.collapse===collapse)return this.memo.value;
   if(model.expanded){
    const initial=!this.arrivalsReady;this.arrivalsReady=true;const seen=new Set<string>();let arriving=false;
    const enter=(id:string)=>{seen.add(id);const previous=this.arrivals.get(id)??(initial?1:0);const opacity=reduced?1:previous+(1-previous)*(1-Math.exp(-Math.max(0,Math.min(64,dt))/65));const value=opacity>.997?1:opacity;this.arrivals.set(id,value);if(value<1)arriving=true;return value;};
    // Both representations are computed as one background transaction. Gesture frames
    // only interpolate a retained pair; zoom can never launch a new grouping job.
    const parents=new Map<string,GraphNode>();for(const n of model.nodes)for(const id of n.members||[])parents.set(id,n);
    const nodes:PaintedNode[]=model.nodes.filter(n=>n.members).map(n=>({...n,opacity:collapse*enter(n.id)}));
    for(const n of model.expanded.nodes){const p=parents.get(n.id);const reveal=p?1-collapse:1;nodes.push({...n,x:p?p.x+(n.x-p.x)*(1-collapse*.22):n.x,y:p?p.y+(n.y-p.y)*(1-collapse*.22):n.y,opacity:reveal*enter(n.id)});}
    const byId=new Map(nodes.map(n=>[n.id,n]));const links:PaintedLink[]=[];
    for(const [kind,source] of [['cluster',model],['detail',model.expanded]] as const)for(const l of source.links){const a=byId.get(l.from),b=byId.get(l.to);if(!a||!b)continue;const opacity=(kind==='cluster'?collapse:1-collapse)*Math.min(this.arrivals.get(a.id)??1,this.arrivals.get(b.id)??1);if(opacity>.001)links.push({...l,id:kind+':'+l.id,opacity,start:a,end:b});}
    for(const id of this.arrivals.keys())if(!seen.has(id))this.arrivals.delete(id);
    const value={nodes:nodes.filter(n=>n.opacity>.001),links,active:arriving};this.memo=!arriving&&!dragging?{model,collapse,value}:undefined;return value;
   }
   const initial=!this.nodes.size,blend=reduced?1:1-Math.exp(-Math.max(0,Math.min(64,dt))/65),targets=new Map(model.nodes.map(n=>[n.id,n]));
   const parents=new Map<string,GraphNode>();for(const n of model.nodes)for(const id of n.members||[])parents.set(id,n);
   const previousParents=new Map<string,PaintedNode>();for(const n of this.nodes.values())for(const id of n.members||[])previousParents.set(id,n);
   // New children inherit the currently painted parent, including interrupted transitions.
   for(const target of model.nodes)if(!this.nodes.has(target.id)){
    const parent=previousParents.get(target.id),members=(target.members||[]).map(id=>this.nodes.get(id)).filter((n):n is PaintedNode=>Boolean(n));
    const origin=parent||(members.length?{x:members.reduce((s,n)=>s+n.x,0)/members.length,y:members.reduce((s,n)=>s+n.y,0)/members.length,radius:target.radius}:target);
    this.nodes.set(target.id,{...target,x:origin.x,y:origin.y,radius:parent?target.radius*(.4+.6*collapse):target.radius,opacity:initial?1:0});
   }
  let active=false;
  for(const [id,old] of this.nodes){const target=targets.get(id),parent=parents.get(id),goal=target||parent||old;
   const opacity=target?1:0,radius=target?.radius??(parent?Math.min(old.radius,parent.radius*.3):old.radius),k=id===dragging?1:blend;
   const n:PaintedNode={...old,...(target||{}),x:old.x+(goal.x-old.x)*k,y:old.y+(goal.y-old.y)*k,radius:old.radius+(radius-old.radius)*k,opacity:old.opacity+(opacity-old.opacity)*blend,attention:(old.attention??1)+((target?.attention??old.attention??1)-(old.attention??1))*blend};
   if(!target&&n.opacity<.003){this.nodes.delete(id);continue;}
   if(Math.abs(n.x-goal.x)>.03||Math.abs(n.y-goal.y)>.03||Math.abs(n.radius-radius)>.03||Math.abs(n.opacity-opacity)>.003||Math.abs((n.attention??1)-(target?.attention??n.attention??1))>.003)active=true;
   this.nodes.set(id,n);
  }
  const linkTargets=new Map(model.links.map(l=>[l.id,l]));for(const l of model.links)if(!this.links.has(l.id))this.links.set(l.id,{...l,opacity:0});
  for(const [id,old] of this.links){const target=linkTargets.get(id),opacity=old.opacity+((target?1:0)-old.opacity)*blend;if(!target&&opacity<.003){this.links.delete(id);continue;}if(Math.abs(opacity-(target?1:0))>.003)active=true;
   const next={...old,...target,opacity};for(const [key,id] of [['start',next.from],['end',next.to]] as const){const n=this.nodes.get(id);if(!n)continue;next[key]={x:n.x,y:n.y,radius:n.radius};}this.links.set(id,next);
  }
  const value={nodes:[...this.nodes.values()],links:[...this.links.values()],active};this.memo=!active&&!dragging?{model,collapse,value}:undefined;return value;
 }
}
