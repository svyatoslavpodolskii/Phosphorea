import {background,node,text,icons,themes} from '../engine.js';
const variants=[['note','Заметка','#f2f2f2',50,'circle'],['person','Человек','#d9bca0',50,'circle'],['project','Проект','#a6c5e9',65,'square'],['idea','Идея','#c7b1e0',58,'diamond'],['media','Медиа','#dfaeb9',50,'circle'],['note','Твоя мысль','#f2f2f2',75,'circle']];
export default function(c,t){const v=variants[Math.min(5,Math.floor(t/.6))];background(c,t);node(c,{x:960,y:490,r:v[3]*2,icon:v[0],color:v[2],shape:v[4]},{glow:true,label:false});text(c,v[1],960,760,52,themes[0].ink,500,'center');}
