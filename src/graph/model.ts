import {nodeWeight} from './geometry';
import {typeIcon} from '../core/icons';
export const MIN_ZOOM=.035,MAX_ZOOM=3;
import {neighborhood} from './neighborhood';
import {structure} from './structure';
import type {Atom,Link,Snapshot} from '../core/model';
export interface Camera{x:number;y:number;zoom:number}
export interface GraphNode{ id:string;x:number;y:number;radius:number;label:string;color:string;icon:string;shape:string;style:string;state:string;members?:string[];content?:string;pinned?:boolean;attention?:number;landmark?:boolean }
export interface GraphModel{expanded?:GraphModel;arranging?:boolean;branch?:string[];satellites?:{id:string;x:number;y:number;color:string}[];nodes:GraphNode[];links:Link[];hidden:number}
export function reduceLinks(atoms:Atom[],links:Link[],selected=''):Link[]{
 if(links.length<=600){const ids=new Set(atoms.map(a=>a.id));return links.filter(l=>ids.has(l.from)&&ids.has(l.to));}
 const parent=new Map(atoms.map(a=>[a.id,a.id]));const degree=new Map<string,number>();
 const find=(id:string):string=>{let root=id;while(parent.get(root)!==root&&parent.has(root))root=parent.get(root)!;while(parent.get(id)!==root&&parent.has(id)){const p=parent.get(id)!;parent.set(id,root);id=p;}return root;};
 for(const l of links){degree.set(l.from,(degree.get(l.from)||0)+1);degree.set(l.to,(degree.get(l.to)||0)+1);}
 return [...links].sort((a,b)=>((degree.get(b.from)||0)+(degree.get(b.to)||0))-((degree.get(a.from)||0)+(degree.get(a.to)||0))).filter(l=>{if(!parent.has(l.from)||!parent.has(l.to))return false;const a=find(l.from),b=find(l.to);if(a!==b)parent.set(a,b);return a!==b||l.relation!=='related'||l.from===selected||l.to===selected;});
}
export function graphModel(data:Snapshot,lens:string,zoom:number,selected:string,alreadyReduced=false):GraphModel{
 const attention=neighborhood(data,selected,zoom);
 const byId=new Map(data.atoms.map(a=>[a.id,a]));const context=new Set<string>();
 if(lens==='now')for(const l of data.links){if(byId.get(l.from)?.state==='now'&&!byId.get(l.from)?.paused)context.add(l.to);if(byId.get(l.to)?.state==='now'&&!byId.get(l.to)?.paused)context.add(l.from);}
 const archiveContext=new Set<string>();if(lens==='archived')for(const l of data.links){if(byId.get(l.from)?.state==='archived')archiveContext.add(l.to);if(byId.get(l.to)?.state==='archived')archiveContext.add(l.from);}
 const atoms=data.atoms.filter(a=>lens==='ambient'?true:lens==='archived'?a.state==='archived'||archiveContext.has(a.id):lens==='now'?((a.state==='now'&&!a.paused)||context.has(a.id))&&a.state!=='archived':a.state!=='archived');
 const ids=new Set(atoms.map(a=>a.id));const links=data.links.filter(l=>ids.has(l.from)&&ids.has(l.to));const degree=new Map<string,number>();for(const l of links){degree.set(l.from,(degree.get(l.from)||0)+1);degree.set(l.to,(degree.get(l.to)||0)+1);}
 let nodes:GraphNode[]=atoms.map(a=>({id:a.id,x:a.x,y:a.y,attention:1,landmark:a.importance>0||['project','area'].includes(a.type)||(degree.get(a.id)||0)>2,radius:nodeWeight(a,degree.get(a.id)||0),label:a.title,color:a.appearance.color||'#b4ecc1',icon:a.appearance.icon||typeIcon(a.type),shape:a.appearance.shape||(a.type==='task'?'square':'circle'),style:a.appearance.style||'solid',state:a.paused?'paused':a.state,content:a.content,pinned:a.pinned}));
 if(zoom<.48){
 const tree=structure({atoms,links});const nodeById=new Map(nodes.map(n=>[n.id,n]));const groups:GraphNode[]=[];
  const pending=[...tree.roots].reverse();while(pending.length){const id=pending.pop()!;const branches=tree.children.get(id)!.filter(k=>tree.children.get(k)!.length>0);const branchSet=new Set(branches),members=[id,...tree.children.get(id)!.filter(k=>!branchSet.has(k))];const node=nodeById.get(id)!;const holds=false;
   // Grouping depends on topology and zoom only. The focused branch stays unfolded
   // so the same thing remains selected across the whole level of detail.
   if(members.length>1&&!holds){groups.push({...node,attention:Math.max(...members.map(id=>attention.size?(attention.get(id)??.12):1)),id:'cluster:'+id,members,x:members.reduce((sum,k)=>sum+byId.get(k)!.x,0)/members.length,y:members.reduce((sum,k)=>sum+byId.get(k)!.y,0)/members.length,radius:Math.min(75,36+Math.sqrt(members.length)*4),icon:String(members.length)});for(let i=branches.length-1;i>=0;i--)pending.push(branches[i]);}else{groups.push(node);const kids=tree.children.get(id)!;for(let i=kids.length-1;i>=0;i--)pending.push(kids[i]);}}
 const mapping=new Map<string,string>();for(const n of groups)for(const id of n.members||[n.id])mapping.set(id,n.id);
 const seen=new Set<string>();const reduced=(alreadyReduced?links:reduceLinks(atoms,links,selected)).flatMap(l=>{const from=mapping.get(l.from)!,to=mapping.get(l.to)!;const key=[from,to].sort().join('|');if(from===to||seen.has(key))return[];seen.add(key);return[{...l,from,to}];});
 nodes=groups;return{nodes,links:reduced,hidden:links.length-reduced.length};
 }
 const reduced=(alreadyReduced?links:reduceLinks(atoms,links,selected));return{nodes,links:reduced,hidden:links.length-reduced.length};
}
