/** Keep the trimmed endpoints ordered even while atom bodies overlap. */
export function edgeCurve(a:{x:number;y:number;radius:number},b:{x:number;y:number;radius:number}){
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
 if(!Number.isFinite(d)||d<.001)return null;
 const ux=dx/d,uy=dy/d,trimA=Math.min(a.radius,d*.45),trimB=Math.min(b.radius,d*.45);
 const ax=a.x+ux*trimA,ay=a.y+uy*trimA,bx=b.x-ux*trimB,by=b.y-uy*trimB;
 const bend=Math.min(14,(d-trimA-trimB)*.045);
 return {ax,ay,bx,by,cx:(ax+bx)/2-uy*bend,cy:(ay+by)/2+ux*bend};
}

type End={x:number;y:number;radius:number};
/** Camera movement changes no world geometry. Weak keys release removed links. */
export class EdgeCurves{
 private entries=new WeakMap<object,{ax:number;ay:number;ar:number;bx:number;by:number;br:number;curve:ReturnType<typeof edgeCurve>}>();
 get(link:object,a:End,b:End){
  const known=this.entries.get(link);
  if(known&&known.ax===a.x&&known.ay===a.y&&known.ar===a.radius&&known.bx===b.x&&known.by===b.y&&known.br===b.radius)return known.curve;
  const curve=edgeCurve(a,b);this.entries.set(link,{ax:a.x,ay:a.y,ar:a.radius,bx:b.x,by:b.y,br:b.radius,curve});return curve;
 }
}
