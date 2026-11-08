import {background,node,touch,TAU} from '../engine.js';
export default function(c,t){background(c,t);node(c,{x:960,y:500,r:62,color:'#f2f2f2'},{glow:true});touch(c,960,500,t*.6,{hold:true});for(let k=0;k<3;k++){const p=Math.max(0,t-k*.22);c.strokeStyle=`rgba(180,236,193,${Math.max(0,.3-p*.25)})`;c.lineWidth=2;c.beginPath();c.arc(960,500,80+p*220,0,TAU);c.stroke();}}
