/** Keep the trimmed endpoints ordered even while atom bodies overlap. */
export function edgeCurve(a:{x:number;y:number;radius:number},b:{x:number;y:number;radius:number}){
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
 if(!Number.isFinite(d)||d<.001)return null;
 const ux=dx/d,uy=dy/d,trimA=Math.min(a.radius,d*.45),trimB=Math.min(b.radius,d*.45);
 const ax=a.x+ux*trimA,ay=a.y+uy*trimA,bx=b.x-ux*trimB,by=b.y-uy*trimB;
 const bend=Math.min(14,(d-trimA-trimB)*.045);
 return {ax,ay,bx,by,cx:(ax+bx)/2-uy*bend,cy:(ay+by)/2+ux*bend};
}

type End={id?:string;x:number;y:number;radius:number};
/** Camera movement changes no world geometry. Weak keys release removed links. */
export class EdgeCurves{
 private revision=0;private positions=new Map<string,End>();private cells=new Map<string,End[]>();
 private entries=new WeakMap<object,{revision:number;ax:number;ay:number;ar:number;bx:number;by:number;br:number;curve:ReturnType<typeof edgeCurve>}>();
 /** Build only when world geometry changes; camera frames reuse both index and curves. */
 prepare(nodes:readonly End[]){let count=0,changed=false;for(const n of nodes){if(!n.id)continue;count++;const old=this.positions.get(n.id);if(!old||old.x!==n.x||old.y!==n.y||old.radius!==n.radius)changed=true;}if(!changed&&count===this.positions.size)return;this.positions.clear();this.revision++;this.cells.clear();for(const source of nodes){if(!source.id)continue;const n={id:source.id,x:source.x,y:source.y,radius:source.radius};this.positions.set(n.id,n);const key=Math.floor(n.x/256)+':'+Math.floor(n.y/256),cell=this.cells.get(key);if(cell)cell.push(n);else this.cells.set(key,[n]);}}

 private route(a:End,b:End){const curve=edgeCurve(a,b);if(!curve||!this.cells.size)return curve;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),ux=dx/d,uy=dy/d,seen=new Set<End>();let positive=0,negative=0,blocked=false;const steps=Math.min(16,Math.max(1,Math.ceil(d/160)));
  for(let i=0;i<=steps&&seen.size<64;i++){const x=Math.floor((a.x+dx*i/steps)/256),y=Math.floor((a.y+dy*i/steps)/256);for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++)for(const n of this.cells.get((x+ox)+':'+(y+oy))||[]){if(seen.size>=64)break;if(seen.has(n)||n.id===a.id||n.id===b.id)continue;seen.add(n);const t=((n.x-a.x)*ux+(n.y-a.y)*uy)/d;if(t<.08||t>.92)continue;const normal=-(n.x-a.x)*uy+(n.y-a.y)*ux,r=n.radius+8;if(Math.abs(normal)<r){blocked=true;const weight=2*t*(1-t);positive=Math.max(positive,(normal+r)/weight);negative=Math.max(negative,(r-normal)/weight);}}}
  if(!blocked)return curve;const bend=Math.min(180,d*.42,Math.min(positive,negative))*(positive<=negative?1:-1);curve.cx=(a.x+b.x)/2-uy*bend;curve.cy=(a.y+b.y)/2+ux*bend;
  // Trim along the actual tangent, so neighbouring routes leave the body separately.
  const da=Math.hypot(curve.cx-a.x,curve.cy-a.y)||1,db=Math.hypot(curve.cx-b.x,curve.cy-b.y)||1,ra=Math.min(a.radius,d*.45),rb=Math.min(b.radius,d*.45);curve.ax=a.x+(curve.cx-a.x)/da*ra;curve.ay=a.y+(curve.cy-a.y)/da*ra;curve.bx=b.x+(curve.cx-b.x)/db*rb;curve.by=b.y+(curve.cy-b.y)/db*rb;return curve;
 }
 get(link:object,a:End,b:End){
  const known=this.entries.get(link);
  if(known&&known.revision===this.revision&&known.ax===a.x&&known.ay===a.y&&known.ar===a.radius&&known.bx===b.x&&known.by===b.y&&known.br===b.radius)return known.curve;
  const curve=this.route(a,b);this.entries.set(link,{revision:this.revision,ax:a.x,ay:a.y,ar:a.radius,bx:b.x,by:b.y,br:b.radius,curve});return curve;
 }
}
