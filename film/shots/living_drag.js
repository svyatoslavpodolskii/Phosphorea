import {background,little,node,link,touch,smooth,themes} from '../engine.js';
const spring=t=>t<=0?0:1-Math.exp(-8*t)*Math.cos(12*t);
export default function(c,t){background(c,t);const a=spring((t-.3)/.45),b=spring((t-1.2)/.45);
 const nodes=little.slice(0,5).map((n,i)=>({...n,x:960+n.x+(i===2?-95*a:i===4?95*b:i===0?-12*a+9*b:0),y:510+n.y+(i===2?35*a:i===4?-35*b:i===0?8*a+12*b:0)}));
 for(let i=1;i<5;i++)link(c,nodes[0],nodes[i],themes[0],.6,1.7,.04+.015*(a+b)*Math.sin(i));
 nodes.forEach((n,i)=>node(c,n,{glow:i===0}));
 if(t>.08&&t<.85)touch(c,nodes[2].x,nodes[2].y,t,{alpha:smooth((t-.08)/.08)*(1-smooth((t-.65)/.2))});
 if(t>1.18&&t<2)touch(c,nodes[4].x,nodes[4].y,t,{alpha:smooth((t-1.18)/.08)*(1-smooth((t-1.8)/.2))});
}
