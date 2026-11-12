import {composeIslands} from './composition';
import {graphFootprints} from './geometry';
import type {Snapshot} from '../core/model';
export function structure(data:Snapshot){
 const atoms=new Map(data.atoms.map(a=>[a.id,a]));const parent=new Map<string,string>(),children=new Map(data.atoms.map(a=>[a.id,[] as string[]]));const edges=new Set<string>();
 const adjacency=new Map(data.atoms.map(a=>[a.id,[] as typeof data.links]));for(const l of data.links)if(atoms.has(l.from)&&atoms.has(l.to)){adjacency.get(l.from)!.push(l);adjacency.get(l.to)!.push(l);}
 const rank=(id:string)=>(adjacency.get(id)?.length||0)+ (atoms.get(id)?.importance||0)*2;
 const roots:string[]=[];const seen=new Set<string>();
   // Ordered by a stable key, never by the generated link id: the hierarchy must
  // be the same every time the same knowledge is loaded, or the map stops being
  // a place the user can rely on.
  for(const atom of [...data.atoms].sort((a,b)=>rank(b.id)-rank(a.id)||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id))){if(seen.has(atom.id))continue;roots.push(atom.id);seen.add(atom.id);const queue=[atom.id];for(let i=0;i<queue.length;i++){const id=queue[i];const links=[...adjacency.get(id)!].sort((a,b)=>Number(b.source==='context')-Number(a.source==='context')||a.from.localeCompare(b.from)||a.to.localeCompare(b.to)||a.relation.localeCompare(b.relation));for(const l of links){const other=l.from===id?l.to:l.from;if(seen.has(other))continue;seen.add(other);edges.add(l.id);parent.set(other,id);children.get(id)!.push(other);queue.push(other);}}}
 // Explicit user grouping outranks the inferred tree. Other relationships remain
 // in the graph as cross-links. Break only inferred edges when they form a cycle.
 const explicit=new Set<string>();
 const detach=(child:string)=>{const from=parent.get(child);if(!from)return;children.set(from,children.get(from)!.filter(id=>id!==child));parent.delete(child);for(const l of adjacency.get(child)||[])if((l.from===from&&l.to===child)||(l.to===from&&l.from===child))edges.delete(l.id);};
 for(const l of data.links.filter(l=>l.relation==='grouped'&&atoms.has(l.from)&&atoms.has(l.to)).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id))){
  const path:string[]=[];let cursor:string|undefined=l.from;
  while(cursor&&cursor!==l.to){path.push(cursor);cursor=parent.get(cursor);}
  if(cursor===l.to){const inferred=path.find(id=>!explicit.has(id));if(!inferred)continue;detach(inferred);}
  detach(l.to);parent.set(l.to,l.from);children.get(l.from)!.push(l.to);edges.add(l.id);explicit.add(l.to);
 }
 if(explicit.size)roots.splice(0,roots.length,...data.atoms.filter(a=>!parent.has(a.id)).map(a=>a.id));
 const order:string[]=[],stack=[...roots].reverse();while(stack.length){const id=stack.pop()!;order.push(id);const kids=children.get(id)!;for(let i=kids.length-1;i>=0;i--)stack.push(kids[i]);}
 const size=new Map<string,number>();for(let i=order.length-1;i>=0;i--){const id=order[i];size.set(id,1+children.get(id)!.reduce((sum,key)=>sum+size.get(key)!,0));}
 // Iterative traversal keeps long imported chains off the JavaScript call stack.
 const descendants=(id:string):string[]=>{if(!atoms.has(id))return [];const result:string[]=[],pending=[id];while(pending.length){const key=pending.pop()!;result.push(key);const kids=children.get(key)||[];for(let i=kids.length-1;i>=0;i--)pending.push(kids[i]);}return result;};

 return {roots,parent,children,size,edges,descendants};
}
export function branchingLayout(data:Snapshot,mode='calm',distance=175){
 const footprints=graphFootprints(data),tree=structure(data),points=new Map<string,{x:number;y:number}>();const islands:{ids:string[];width:number;height:number}[]=[];const area=new Map<string,number>();const measure=(id:string):number=>{const f=footprints.get(id)!;const value=f.halfWidth*2*(f.top+f.bottom)+tree.children.get(id)!.reduce((sum,k)=>sum+measure(k),0);area.set(id,value);return value;};tree.roots.forEach(measure);
 for(const root of tree.roots){points.set(root,{x:0,y:0});const grow=(id:string,angle:number,sector:number,depth=0)=>{const kids=tree.children.get(id)!;let cursor=angle-sector/2;const total=kids.reduce((s,k)=>s+Math.sqrt(area.get(k)!),0);for(const child of kids){const share=sector*Math.sqrt(area.get(child)!)/total,baseAngle=cursor+share/2,theta=baseAngle+(mode==='living'?Math.sin((depth+1)*1.618+cursor)*.28:0);cursor+=share;const p=points.get(id)!;const radius=Math.max(footprints.get(id)!.halfWidth+footprints.get(child)!.halfWidth+42,Math.sqrt(area.get(child)!)*.38,kids.length*58/Math.max(1,sector))*distance/175;const orbit=(depth+1)*250*distance/175;if(mode==='elastic')points.set(child,{x:Math.cos(theta)*orbit,y:Math.sin(theta)*orbit});else points.set(child,{x:p.x+Math.cos(theta)*radius,y:p.y+Math.sin(theta)*radius});grow(child,theta,mode==='free'?Math.PI*1.3:Math.min(Math.PI*.9,Math.max(.5,share)),depth+1);}};grow(root,-Math.PI/2,Math.PI*2);const ids=tree.descendants(root);const boxes=new Map(ids.map(id=>[id,footprints.get(id)!]));for(let pass=0;pass<400;pass++){let overlaps=0;for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const a=points.get(ids[i])!,b=points.get(ids[j])!,fa=boxes.get(ids[i])!,fb=boxes.get(ids[j])!,dx=b.x-a.x,dy=b.y-a.y;const ox=fa.halfWidth+fb.halfWidth+16-Math.abs(dx),oy=Math.min(a.y+fa.bottom,b.y+fb.bottom)-Math.max(a.y-fa.top,b.y-fb.top)+16;if(ox<=0||oy<=0)continue;overlaps++;if(ox<oy){const push=Math.min(30,ox/2+.1)*(dx>=0?1:-1);a.x-=push;b.x+=push;}else{const push=Math.min(30,oy/2+.1)*(dy>=0?1:-1);a.y-=push;b.y+=push;}}if(!overlaps)break;}const xs=ids.map(id=>points.get(id)!.x),ys=ids.map(id=>points.get(id)!.y);const minX=Math.min(...xs)-110,minY=Math.min(...ys)-90;for(const id of ids){const p=points.get(id)!;p.x-=minX;p.y-=minY;}islands.push({ids,width:Math.max(...xs)-minX+110,height:Math.max(...ys)-minY+110});}
 composeIslands(points,islands,data.atoms,footprints);
 return {points,tree};
}

