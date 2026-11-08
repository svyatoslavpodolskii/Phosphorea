import {background,node,link,touch,ease,smooth,icon,mix} from '../engine.js';
export default function(c,t){
 background(c,t);
 const drag=ease(t/.3),released=Math.max(0,t-.6);
 const spring=1-Math.exp(-10*released)*Math.cos(16*released);
 const recoil=Math.sin(released*13)*Math.exp(-5*released);
 const a={x:960+Math.sin(drag*Math.PI)*120-22*recoil,y:mix(230,690,drag)-390*spring,r:78,title:'Идея',icon:'idea'};
 const b={x:960+16*recoil,y:760+32*recoil,r:95,title:'Проект',icon:'project'};
 if(t>.6)link(c,a,b,undefined,ease((t-.6)/.14),3,.08+recoil*.05);
 node(c,a,{glow:true});node(c,b);
 if(t>.38&&t<.86)icon(c,'link',1110,640,40);
 if(t<.75)touch(c,a.x,a.y,t,{alpha:1-smooth((t-.6)/.15)});
}
