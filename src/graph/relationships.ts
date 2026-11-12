import {type EdgeCurves,edgeCurve} from './edge-curve';
import type {Link} from '../core/model';
import type {Camera,GraphNode} from './model';
export function linkCurve(a:Pick<GraphNode,'x'|'y'|'radius'>,b:Pick<GraphNode,'x'|'y'|'radius'>){
 return edgeCurve(a,b)??{ax:a.x,ay:a.y,bx:a.x,by:a.y,cx:a.x,cy:a.y};
}
/** Screen-space hit slop stays usable on a phone at any map zoom. */
export function pickLink(links:Link[],nodes:Pick<GraphNode,'id'|'x'|'y'|'radius'>[],camera:Camera,view:{width:number;height:number},point:{x:number;y:number},curves?:EdgeCurves){
 const byId=new Map(nodes.map(n=>[n.id,n]));let best='',distance=12;
 for(const link of links){const a=byId.get(link.from),b=byId.get(link.to);if(!a||!b)continue;const c=curves?.get(link,a,b)??linkCurve(a,b);if(c.ax===c.bx&&c.ay===c.by)continue;
  let previous={x:c.ax*camera.zoom+view.width/2+camera.x,y:c.ay*camera.zoom+view.height/2+camera.y};
  for(let i=1;i<=24;i++){const t=i/24,u=1-t,x=(u*u*c.ax+2*u*t*c.cx+t*t*c.bx)*camera.zoom+view.width/2+camera.x,y=(u*u*c.ay+2*u*t*c.cy+t*t*c.by)*camera.zoom+view.height/2+camera.y;
   const dx=x-previous.x,dy=y-previous.y,along=Math.max(0,Math.min(1,((point.x-previous.x)*dx+(point.y-previous.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(previous.x+along*dx-point.x,previous.y+along*dy-point.y);
   if(d<distance){distance=d;best=link.id;}previous={x,y};
  }
 }return best;
}
