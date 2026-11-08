import {background,little,node,link,spring,smooth,themes} from '../engine.js';
export default function(c,t){background(c,t);c.save();c.translate(960,510);
 for(let i=1;i<5;i++){const p=Math.min(1,spring((t-(.2+i*.45))/.5));if(p>0)link(c,little[0],little[i],themes[0],p*.6,1.7,.04);}
 for(let i=0;i<5;i++){const p=i?Math.min(1,spring((t-(.2+i*.45))/.5)):smooth(t/.4);node(c,little[i],{scale:p,glow:i===0,label:t>.4});}
 c.restore();}
