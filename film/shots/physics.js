import {background,round,text,touch,smooth,icon,mix} from '../engine.js';
export default function(c,t,s){
 background(c,t);round(c,520,-60,880,1100,36,'#151515','#454545');
 if(s.variant==='control'){
  text(c,'Настройки',576,30,46,'#eeeeee',600);text(c,'Подстройте под себя',576,105,28,'#aaaaaa');
  const items=[['idea','Физика','и поведение'],['media','Темы','и атмосфера'],['note','Типы','заметок'],['project','Канбан',''],['search','Жесты','и зум'],['link','Анимации','']];
  items.forEach(([id,a,b],i)=>{const x=576+i%2*400,y=195+Math.floor(i/2)*230;
   round(c,x,y,368,194,24,i===0&&t>.42?'#292929':'#1d1d1d','#393939');icon(c,id,x+38,y+40,30);
   text(c,a,x+28,y+103,30,'#eeeeee',500);if(b)text(c,b,x+28,y+146,27,'#b8b8b8');
  });
  text(c,'Включайте только нужное',576,960,27,'#aaaaaa');
  if(t>.25&&t<.82)touch(c,760,300,t,{alpha:1-smooth((t-.42)/.4)});
 }else{
  text(c,'Физика и поведение',576,30,42,'#eeeeee',600);text(c,'Ваш характер движения',576,105,28,'#aaaaaa');
  ['Упругость','Инерция','Живость карты','Длина связей'].forEach((label,i)=>{
   const y=240+i*195,p=i===0?mix(.35,.72,smooth((t-.12)/.65)):[.65,.3,.5][i-1];
   text(c,label,576,y,32,'#eeeeee');round(c,576,y+59,768,6,3,'#3b3b3b');round(c,576,y+59,768*p,6,3,'#dddddd');
   c.fillStyle='#eeeeee';c.beginPath();c.arc(576+768*p,y+62,15,0,Math.PI*2);c.fill();
   if(i===0&&t<.95)touch(c,576+768*p,y+62,t,{alpha:1-smooth((t-.78)/.17)});
  });
 }
}
