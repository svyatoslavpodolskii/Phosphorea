import type {Snapshot} from '../core/model';
import {structure} from './structure';
import {footprint} from './footprint';
type Point={x:number;y:number};
export interface PlacementInput {data:Snapshot;parent?:string;atom?:Partial<Snapshot['atoms'][number]>;targets?:string[]}
export function segmentsCross(a:Point,b:Point,c:Point,d:Point){const side=(p:Point,q:Point,r:Point)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);return side(a,b,c)*side(a,b,d)<0&&side(c,d,a)*side(c,d,b)<0;}
function segmentDistance(p:Point,a:Point,b:Point){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}

const RADIUS=[200,265,345,440,560];
const SPACING=26,MIN_GAP=118;

/** A new atom must arrive somewhere the eye reads as belonging, not somewhere a
 *  generator happened to land. Placement therefore follows the knowledge: it grows
 *  out of its parent along the branch, respects the siblings and the labels already
 *  painted there, prefers a sector that adds no edge crossing, and never disturbs
 *  a position the user chose. */
export function placeAtom({data,parent,atom,targets=[]}:PlacementInput){
  const byId=new Map(data.atoms.map(a=>[a.id,a]));
  const anchor=byId.get(parent||targets[0]);
  if(!data.atoms.length)return{x:0,y:0};
  return anchor?grow(data,byId,anchor,atom,targets):newIsland(data);
}

/** Grows a child out of its parent, in the widest free sector ahead of it. */
function grow(data:Snapshot,byId:Map<string,Snapshot['atoms'][number]>,anchor:Atom,atom:PlacementInput['atom'],targets:string[]){
  const tree=structure(data),treeAnchor=byId.get(anchor.id)!;
  const foot=footprint(atom?.title??anchor.title,atom?.appearance?.size_override||35,Boolean(atom?.content));
  const destinations=[...new Set([anchor.id,...targets])].map(id=>byId.get(id)).filter((a):a is Atom=>Boolean(a));
  const upstreamId=tree.parent.get(anchor.id),upstream=upstreamId?byId.get(upstreamId):undefined;
  const back=upstream?Math.atan2(treeAnchor.y-upstream.y,treeAnchor.x-upstream.x):undefined;

  // Everything already occupying an angle around the anchor, with the half width
  // its painted label needs. A label is as much an obstacle as a node.
  const blocked:{from:number;to:number;weight:number}[]=[];
  for(const other of data.atoms){
   if(other.id===anchor.id)continue;
   const dx=other.x-anchor.x,dy=other.y-anchor.y,distance=Math.hypot(dx,dy);
   if(distance>700||distance<1)continue;
   const otherFoot=footprint(other.title,other.appearance.size_override||35,Boolean(other.content));
   const half=Math.atan2(Math.max(otherFoot.halfWidth,otherFoot.top)+otherFoot.bottom,distance)+.1;
   const angle=Math.atan2(dy,dx);
   blocked.push({from:angle-half,to:angle+half,weight:otherFoot.halfWidth/Math.max(60,distance)});
  }
  // The edge back to the ancestor stays clear so a branch keeps growing outward.
  if(back!==undefined)blocked.push({from:back+Math.PI-.55,to:back+Math.PI+.55,weight:2});

  const links=data.links.map(l=>({a:byId.get(l.from),b:byId.get(l.to)})).filter((l):l is{a:Snapshot['atoms'][number];b:Snapshot['atoms'][number]}=>Boolean(l.a&&l.b));
  let best={x:anchor.x+200,y:anchor.y},bestScore=Infinity;
  for(let ring=0;ring<RADIUS.length;ring++)for(let i=0;i<48;i++){
   const angle=back===undefined?-Math.PI/2+i*Math.PI/24:back+.62+i*Math.PI/24;
   const radius=RADIUS[ring];
   const point={x:anchor.x+Math.cos(angle)*radius,y:anchor.y+Math.sin(angle)*radius};
   let crowding=0;
   for(const b of blocked){const middle=(b.from+b.to)/2;crowding+=Math.abs(Math.atan2(Math.sin(angle-middle),Math.cos(angle-middle)))<(b.to-b.from)/2?b.weight*(ring+1):0;}
   // Angular separation from the nearest painted neighbour.
   let separation=Math.PI;
   for(const other of data.atoms){
    if(other.id===anchor.id)continue;
    const gap=Math.abs(Math.atan2(Math.sin(Math.atan2(other.y-anchor.y,other.x-anchor.x)-angle),Math.cos(Math.atan2(other.y-anchor.y,other.x-anchor.x)-angle)));
    const distance=Math.hypot(other.x-anchor.x,other.y-anchor.y);
    if(distance<radius*1.6)separation=Math.min(separation,gap*Math.min(1,distance/260));
   }
   // A candidate that crosses an existing edge is a worse place to read the graph.
   let crossings=0;
   for(const target of destinations){
    for(const {a,b} of links){
     if(a.id===target.id||b.id===target.id){
      const other=a.id===target.id?b:a;
      // Incident edges may share an endpoint, but must not share a ray.
      const cosine=((point.x-target.x)*(other.x-target.x)+(point.y-target.y)*(other.y-target.y))/(Math.hypot(point.x-target.x,point.y-target.y)*Math.hypot(other.x-target.x,other.y-target.y)||1);
      if(cosine>.985)crossings++;
     }else if(segmentsCross(target,point,a,b))crossings++;
    }
    for(const other of data.atoms)if(other.id!==target.id&&segmentDistance(other,target,point)<45)crossings++;
   }
   // Do not land on top of anything, and leave room for this atom's own label.
   let collision=0;
   for(const other of data.atoms){
    if(other.id===anchor.id)continue;
    const otherFoot=footprint(other.title,other.appearance.size_override||35,Boolean(other.content));
    const ox=otherFoot.halfWidth+foot.halfWidth+MIN_GAP-Math.abs(other.x-point.x);
    const oy=Math.min(other.y+otherFoot.bottom,point.y+foot.bottom)-Math.max(other.y-otherFoot.top,point.y-foot.top)+MIN_GAP;
    if(ox>0&&oy>0)collision+=ox*oy;
   }
   const length=destinations.reduce((sum,a)=>sum+Math.hypot(point.x-a.x,point.y-a.y),0);
   const forward=back===undefined?0:1-Math.cos(angle-back);const score=forward*180+crowding*90-separation*260+crossings*100000+collision*20+ring*70+length*.1;
   if(score<bestScore){bestScore=score;best=point;}
  }
  return best;
}

/** A disconnected atom becomes a small island beside the ones already placed,
 *  never at the far edge of the world. */
function newIsland(data:Snapshot){
  if(data.atoms.length===1)return{x:data.atoms[0].x+190,y:data.atoms[0].y};
  const boxes=data.atoms.map(a=>({a,foot:footprint(a.title,a.appearance.size_override||35,Boolean(a.content))}));
  const left=Math.min(...boxes.map(b=>b.a.x-b.foot.halfWidth)),right=Math.max(...boxes.map(b=>b.a.x+b.foot.halfWidth));
  const top=Math.min(...boxes.map(b=>b.a.y-b.foot.top)),bottom=Math.max(...boxes.map(b=>b.a.y+b.foot.bottom));
  const spread=Math.max(right-left,bottom-top);
  // Alternate the side, so a growing set of loose notes forms a composition
  // instead of a single line running off the map.
  const east=Math.abs(right-left)<=Math.abs(bottom-top);
  const gap=Math.max(200,spread*.12);
  return east?{x:right+gap+80,y:top+((bottom-top)*.25)}:{x:left-gap-80,y:top+((bottom-top)*.7)};
}
type Atom=Snapshot['atoms'][number];
