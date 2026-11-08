import type {Atom, Link, Snapshot} from '../core/model';
import type {Camera} from './model';

export const FOLDER_DEFINITIONS = 'builtin.folders.definitions';
export const FOLDER_MEMBERSHIP = 'builtin.folders.membership';
export const DEFAULT_FOLDER_COLOR = '#eeeeee';
/** Neutral folders follow contrast; explicitly chosen colours stay literal. */
export const folderDisplayColor=(color:string)=>color.toLowerCase()===DEFAULT_FOLDER_COLOR?'var(--theme-text)':color;
export const MAX_FOLDERS = 64;
export const MAX_FOLDER_ROOTS = 4096;
export const TERRITORY_DIRECTIONS = 24;
export interface FolderDefinition {id:string;name:string;color:string;roots:string[];excluded?:string[]}
export interface Folder extends FolderDefinition {ownerId:string}
export interface FolderBounds {minX:number;minY:number;maxX:number;maxY:number}
export interface FolderFocus {folderId:string|null;center:{x:number;y:number};bounds:FolderBounds}
export interface FolderSummary extends Folder {count:number;weight:number;focus:FolderFocus|null}
export interface FolderProjection {folders:FolderSummary[];memberships:Map<string,Record<string,number>>;all:FolderFocus|null}
export interface FolderPosition {id:string;x:number;y:number;radius?:number}
export interface FolderTerritory {id:string;color:string;path:string;bounds:FolderBounds}
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);

/** Unknown or malformed imported properties are ignored; work is capped per atom. */
export function folderDefinitions(atom:Pick<Atom,'properties'>):FolderDefinition[]{
 const raw=atom.properties[FOLDER_DEFINITIONS];
 if(!Array.isArray(raw))return [];
 return raw.slice(0,MAX_FOLDERS).flatMap(value=>{
  if(!record(value)||!validId(value.id)||typeof value.name!=='string'||!value.name.trim()||value.name.length>80||typeof value.color!=='string'||!/^#[0-9a-f]{6}$/i.test(value.color)||!Array.isArray(value.roots))return [];
  const roots=[...new Set(value.roots.slice(0,MAX_FOLDER_ROOTS).filter((id):id is string=>typeof id==='string'&&id.length>0&&id.length<=100))];
  const excluded=Array.isArray(value.excluded)?[...new Set(value.excluded.slice(0,MAX_FOLDER_ROOTS).filter((id):id is string=>typeof id==='string'&&id.length>0&&id.length<=100))]:[];
  return roots.length?[{id:value.id,name:value.name.trim(),color:value.color,roots,...(excluded.length?{excluded}:{})}]:[];
 });
}

export function normalizeFolderWeights(weights:Record<string,number>):Record<string,number>{
 const entries=Object.entries(weights).filter(([id,w])=>validId(id)&&Number.isFinite(w)&&w>0).slice(0,MAX_FOLDERS);
 const total=entries.reduce((sum,[,w])=>sum+Math.min(1,w),0);
 return Object.fromEntries(entries.map(([id,w])=>[id,Math.min(1,w)/Math.max(1,total)]));
}

/** Only directed creation/grouping edges convey strong membership. A cross-link
 * or a layout provider's inferred tree must never absorb a neighboring branch. */
export const folderBranchLink=(link:Link)=>link.relation==='grouped'||link.source==='context';

export function folderFocus(points:Iterable<FolderPosition>,folderId:string|null):FolderFocus|null{
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const p of points){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;const radius=Number.isFinite(p.radius)?Math.max(0,Math.min(256,p.radius!)):32;
  minX=Math.min(minX,p.x-radius);minY=Math.min(minY,p.y-radius);maxX=Math.max(maxX,p.x+radius);maxY=Math.max(maxY,p.y+radius);
 }
 return minX===Infinity?null:{folderId,center:{x:(minX+maxX)/2,y:(minY+maxY)/2},bounds:{minX,minY,maxX,maxY}};
}

/** O(F*(V+E) + F*V log V), F <= 64; durable weighted seeds are sorted.
 * Iterative traversal is safe for deep branches and cycles.
 * Raw strengths propagate first, then overlaps normalize once per atom. */
export function projectFolders(data:Snapshot):FolderProjection{
 const atoms=new Map(data.atoms.map(a=>[a.id,a]));const definitions=new Map<string,Folder>();
 for(const atom of data.atoms)for(const definition of folderDefinitions(atom)){
  if(!definitions.has(definition.id)&&definitions.size<MAX_FOLDERS)definitions.set(definition.id,{...definition,ownerId:atom.id});
 }
 const owners=new Map<string,Set<string>>();for(const folder of definitions.values())for(const id of folder.roots){const set=owners.get(id)||new Set<string>();set.add(folder.id);owners.set(id,set);}
 const exclusions=new Map([...definitions].map(([id,folder])=>[id,new Set(folder.excluded||[])]));
 const mayEnter=(id:string,folder:string)=>!exclusions.get(folder)?.has(id)&&(!owners.has(id)||owners.get(id)!.has(folder));
 const children=new Map<string,string[]>(),parented=new Set<string>();
 for(const link of [...data.links].sort((a,b)=>a.created_at.localeCompare(b.created_at)))if(folderBranchLink(link)&&atoms.has(link.from)&&atoms.has(link.to)&&!parented.has(link.to)){
  parented.add(link.to);const list=children.get(link.from)||[];list.push(link.to);children.set(link.from,list);
 }
 const raw=new Map<string,Record<string,number>>();
 const put=(id:string,folder:string,weight:number)=>{if(exclusions.get(folder)?.has(id))return;const entry=raw.get(id)||Object.create(null) as Record<string,number>;entry[folder]=Math.max(entry[folder]||0,weight);raw.set(id,entry);};
 for(const atom of data.atoms){const weights=atom.properties[FOLDER_MEMBERSHIP];if(!record(weights))continue;
  for(const [id,w] of Object.entries(weights).slice(0,MAX_FOLDERS))if(definitions.has(id)&&typeof w==='number'&&Number.isFinite(w)&&w>0)put(atom.id,id,Math.min(1,w));
 }
 for(const folder of definitions.values()){
  // Descendants of explicit roots get full strength regardless of branch depth.
  const seen=new Set<string>(),queue=folder.roots.filter(id=>atoms.has(id));
  for(let i=0;i<queue.length;i++){const id=queue[i];if(seen.has(id)||!mayEnter(id,folder.id))continue;seen.add(id);put(id,folder.id,1);for(const child of children.get(id)||[])if(!seen.has(child))queue.push(child);}
 }
 // Persisted memberships also seed branches, including children born via a draft policy.
 // Process high strengths first so each edge is visited at most once per folder.
 for(const folder of definitions.values()){
  const seeds=[...raw].filter(([,w])=>w[folder.id]>0).map(([id,w])=>({id,w:w[folder.id]})).sort((a,b)=>b.w-a.w);
  const seen=new Set<string>();
  for(const seed of seeds){const queue=[seed.id];for(let i=0;i<queue.length;i++){
   const id=queue[i];if(seen.has(id)||!mayEnter(id,folder.id))continue;seen.add(id);put(id,folder.id,seed.w);for(const child of children.get(id)||[])if(!seen.has(child))queue.push(child);
  }}
 }
 const memberships=new Map([...raw].map(([id,weights])=>[id,normalizeFolderWeights(weights)]));
 const members=new Map<string,Atom[]>(),totals=new Map<string,number>();
 for(const [id,weights] of memberships)for(const [folder,w] of Object.entries(weights)){
  const list=members.get(folder)||[];list.push(atoms.get(id)!);members.set(folder,list);totals.set(folder,(totals.get(folder)||0)+w);
 }
 const folders=[...definitions.values()].map(folder=>({...folder,count:members.get(folder.id)?.length||0,weight:totals.get(folder.id)||0,focus:folderFocus(members.get(folder.id)||[],folder.id)}));
 return {folders,memberships,all:folderFocus(data.atoms,null)};
}

/** A bounded support hull: 24 directions, no pairwise hull work, no SVG blur.
 * Padding and quadratic corners give even one/two-point territories soft outlines. */
export function folderTerritories(projection:FolderProjection,positions:Iterable<FolderPosition>):FolderTerritory[]{
 const byFolder=new Map(projection.folders.map(folder=>[folder.id,[] as FolderPosition[]]));
 for(const p of positions){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
  for(const [id,w] of Object.entries(projection.memberships.get(p.id)||{}))if(w>0)byFolder.get(id)?.push(p);
 }
 return projection.folders.flatMap(folder=>{
  const points=byFolder.get(folder.id)!;if(!points.length)return [];
  const hull:Array<{x:number;y:number}>=[];
  for(let i=0;i<TERRITORY_DIRECTIONS;i++){
   const angle=i*Math.PI*2/TERRITORY_DIRECTIONS,dx=Math.cos(angle),dy=Math.sin(angle);let best=points[0],support=-Infinity;
   for(const p of points){const score=p.x*dx+p.y*dy;if(score>support){support=score;best=p;}}
   const w=projection.memberships.get(best.id)![folder.id],pad=48+24*Math.sqrt(w)+(Number.isFinite(best.radius)?Math.max(0,Math.min(256,best.radius!)):32);
   hull.push({x:best.x+dx*pad,y:best.y+dy*pad});
  }
  // Support points are angle ordered around the convex boundary. Smooth the corners.
  const mid=(a:{x:number;y:number},b:{x:number;y:number})=>`${((a.x+b.x)/2).toFixed(2)} ${((a.y+b.y)/2).toFixed(2)}`;
  let path=`M ${mid(hull[hull.length-1],hull[0])}`;
  for(let i=0;i<hull.length;i++)path+=` Q ${hull[i].x.toFixed(2)} ${hull[i].y.toFixed(2)} ${mid(hull[i],hull[(i+1)%hull.length])}`;
  const bounds=folderFocus(hull.map((p,i)=>({...p,id:String(i),radius:0})),folder.id)!.bounds;
  return [{id:folder.id,color:folder.color,path:path+' Z',bounds}];
 });
}

/** Same screen convention as graph/camera.ts: viewport center + camera offset. */
export function folderCameraTransform(camera:Camera,width:number,height:number){
 return `translate(${width/2+camera.x} ${height/2+camera.y}) scale(${camera.zoom})`;
}
