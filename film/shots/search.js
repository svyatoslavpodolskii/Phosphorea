import {background,graph,round,text,icon,smooth,mix,world,edges,touch,node,link,themes} from '../engine.js';
const target=world[1],related=new Set([1]);
for(const [a,b] of edges)if(a===1||b===1){related.add(a);related.add(b);}
export default function(c,t,s){
 const theme=themes[0];background(c,t,theme,false);
 const query='альбом',typed=Math.min(query.length,Math.floor(t/s.events.typing)),p=smooth((t-s.events.select)/.6),z=mix(.68,1.55,p);
 const cx=960-target.x*z*p,cy=mix(540,610,p)-target.y*z*p;
 // One camera and one immutable graph: search changes emphasis, not topology.
 graph(c,t,{zoom:z,cx,cy,theme,labels:false,nodeAlpha:1-p*.77,edgeAlpha:1-p*.58});
 const screen=n=>({...n,x:cx+n.x*z,y:cy+n.y*z,r:n.r*z,color:theme.accent});
 c.save();c.globalAlpha=p;
 for(const [a,b] of edges)if(related.has(a)&&related.has(b))link(c,screen(world[a]),screen(world[b]),theme,.75,2,.025);
 for(const id of related)node(c,screen(world[id]),{theme,label:false,selected:id===1,glow:id===1});
 if(p>.7){const n=screen(target),y=n.y-n.r-72;round(c,n.x-175,y,350,56,18,theme.bg);text(c,n.title,n.x,y+28,32,theme.ink,500,'center');}
 c.restore();
 const ui=1-smooth((t-2.45)/.4);c.save();c.globalAlpha=ui;
 round(c,565,140,790,104,30,'#171717','#666666');icon(c,'search',620,192,32);text(c,query.slice(0,typed),665,192,37,'#f7f7f7');
 if(t<1.2){c.fillStyle='#cccccc';c.fillRect(665+typed*22,172,2,38);}
 if(typed===query.length){round(c,565,340,790,140,25,'#222222','#555555');icon(c,'note',620,410,30);text(c,'Новый альбом',665,393,35);text(c,'Музыка · заметка',665,444,25,'#aaaaaa');}
 if(t>=s.events.select&&t<s.events.select+.18)touch(c,960,410,t,{alpha:1-smooth((t-s.events.select)/.18)});c.restore();
}
