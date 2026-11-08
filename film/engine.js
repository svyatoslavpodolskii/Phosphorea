export const W=1920,H=1080,TAU=Math.PI*2;
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const ease=v=>1-(1-clamp(v))**3;
export const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
export const mix=(a,b,t)=>a+(b-a)*t;
export const spring=v=>v<=0?0:1-Math.exp(-8*v)*Math.cos(12*v);
export const folderColors=['#8ebcf2','#e0ba7d','#b8a0e8','#89caa5','#e59aa8','#7dc9cb'];
export const color=['#f5f5f5','#d3d3d3','#eeeeee','#bcbcbc','#e4e4e4','#ffffff'];
export const themes=[{bg:'#070707',surface:'#171717',ink:'#f7f7f7',muted:'#b8b8b8',edge:'#888888',accent:'#f2f2f2'},{bg:'#f1eee6',surface:'#faf8f3',ink:'#26352b',muted:'#677669',edge:'#a6afa0',accent:'#486655'},{bg:'#050608',surface:'#14171b',ink:'#f5f7fa',muted:'#bac2d0',edge:'#929daa',accent:'#a9d7ff'},{bg:'#0c1020',surface:'#141a30',ink:'#edf0ff',muted:'#9aabc9',edge:'#67749c',accent:'#c8c9ff'}];
export const icons={note:'M6 3h9l3 3v15H6Z M14 3v5h4 M9 12h6 M9 16h6',idea:'M9 18h6 M10 21h4 M8 14a6 6 0 1 1 8 0l-1 3H9Z',person:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',project:'M3 8h18v12H3Z M8 8V4h8v4 M3 13h18 M10 13v3h4v-3',folder:'M3 5h7l2 3h9v12H3Z',media:'M3 4h18v16H3Z M9 8l7 4-7 4Z',pin:'M9 3h6l-1 6 4 4v2H6v-2l4-4ZM12 15v7',check:'m5 12 4 4L19 6',search:'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0m-2 4 7 7',link:'m10 14 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0'};
export function round(c,x,y,w,h,r=24,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}}
export function text(c,value,x,y,size=36,fill='#f7f7f7',weight=400,align='left'){c.font=`${weight} ${size}px "Segoe UI Variable","Segoe UI",sans-serif`;c.fillStyle=fill;c.textAlign=align;c.textBaseline='middle';c.fillText(value,x,y);}
export function icon(c,id,x,y,size=24,ink='#f7f7f7'){c.save();c.translate(x-size/2,y-size/2);c.scale(size/24,size/24);c.strokeStyle=ink;c.lineWidth=1.6;c.lineCap='round';c.lineJoin='round';c.stroke(new Path2D(icons[id]||icons.note));c.restore();}
export function background(c,t=0,theme=themes[0],stars=false){c.fillStyle=theme.bg;c.fillRect(-4000,-4000,10000,10000);const g=c.createRadialGradient(960,500,20,960,500,1100);g.addColorStop(0,theme.accent+'0c');g.addColorStop(1,theme.bg+'00');c.fillStyle=g;c.fillRect(-4000,-4000,10000,10000);if(stars){for(let i=0;i<180;i++){const x=(i*387.37+t*2*(i%3+1))%W,y=(i*193.71+t*.6)%H;c.fillStyle=`rgba(207,219,255,${.1+.2*(.5+.5*Math.sin(i+t*.6))})`;c.beginPath();c.arc(x,y,i%4===0?1.7:.8,0,TAU);c.fill();}}}
export function node(c,n,{theme=themes[0],alpha=1,scale=1,label=true,selected=false,glow=false}={}){if(alpha<=0||scale<=0)return;c.save();c.globalAlpha*=alpha;c.translate(n.x,n.y);c.scale(scale,scale);const r=n.r||30,ink=n.color||theme.accent;if(glow){const g=c.createRadialGradient(0,0,r*.4,0,0,r*3.6);g.addColorStop(0,ink+'35');g.addColorStop(1,ink+'00');c.fillStyle=g;c.beginPath();c.arc(0,0,r*3.6,0,TAU);c.fill();}c.fillStyle=theme.surface;c.strokeStyle=ink;c.lineWidth=selected?3:1.7;c.beginPath();if(n.shape==='square')c.roundRect(-r,-r,r*2,r*2,r*.25);else if(n.shape==='diamond'){c.moveTo(0,-r*1.2);c.lineTo(r*1.2,0);c.lineTo(0,r*1.2);c.lineTo(-r*1.2,0);c.closePath();}else c.arc(0,0,r,0,TAU);c.fill();c.stroke();if(n.icon)icon(c,n.icon,0,0,r*.95,ink);else{c.fillStyle=ink;c.beginPath();c.arc(0,0,Math.max(2,r*.12),0,TAU);c.fill();}if(label&&n.title)text(c,n.title,0,r+24,Math.max(14,Math.min(25,r*.68)),theme.ink,500,'center');c.restore();}
export function link(c,a,b,theme=themes[0],alpha=.65,width=1.5,bend=0){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,ar=a.r||20,br=b.r||20;c.save();c.globalAlpha*=alpha;c.strokeStyle=theme.edge;c.lineWidth=width;c.beginPath();c.moveTo(a.x+dx/d*ar,a.y+dy/d*ar);c.quadraticCurveTo((a.x+b.x)/2-dy*bend,(a.y+b.y)/2+dx*bend,b.x-dx/d*br,b.y-dy/d*br);c.stroke();c.restore();}
export function touch(c,x,y,t,{hold=false,alpha=1}={}){c.save();c.globalAlpha*=alpha;const r=hold?48:25,g=c.createRadialGradient(x,y,0,x,y,r*2);g.addColorStop(0,'#ffffff4d');g.addColorStop(1,'#f2f2f200');c.fillStyle=g;c.beginPath();c.arc(x,y,r*2,0,TAU);c.fill();for(let k=0;k<2;k++){const p=(t+k*.5)%1;c.strokeStyle=`rgba(240,240,240,${(1-p)*.45})`;c.lineWidth=1.7;c.beginPath();c.arc(x,y,r*(.6+p*2.5),0,TAU);c.stroke();}c.fillStyle='#ffffffc0';c.beginPath();c.arc(x,y,5,0,TAU);c.fill();c.restore();}
const roots=[['Музыка','idea'],['Проекты','project'],['Люди','person'],['Книги','note'],['Жизнь','note'],['Идеи','idea']];
const names=[['Новый альбом','Пианино','Вечерний плейлист','Ритм','Концерт','Звук'],['Phosphorea','Наброски','Собрать команду','Следующий шаг','Исследование','Запуск'],['Мама','Встретиться','Друзья','Поговорить','Подарок','Вместе'],['Перечитать','Цитата','Книга на выходные','Заметки на полях','История','Открытие'],['Прогулка','Поездка','Дом','Завтра','Лето','Тихое утро'],['А что если…','Новая мысль','Связать','Попробовать','Вдохновение','Эскиз']];
// Seeded, heterogeneous knowledge network: clusters have different populations,
// several local hubs, peripheral notes, loops and meaningful cross-topic bridges.
let seed=73419;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const populations=[94,188,116,163,79,200];
const centers=[[-315,-630],[285,-365],[-320,70],[300,430],[-260,735],[250,-870]];
const spreads=[[210,240],[265,300],[235,205],[255,270],[200,180],[230,200]];
export const world=[],edges=[],groupRoots=[];
for(let group=0;group<6;group++){
 const start=world.length;groupRoots.push(start);
 const [cx,cy]=centers[group],[sx,sy]=spreads[group];
 const hubs=[{x:cx,y:cy}];
 for(let h=0;h<3+group%3;h++){const a=random()*TAU;hubs.push({x:cx+Math.cos(a)*sx*.62,y:cy+Math.sin(a)*sy*.62});}
 for(let i=0;i<populations[group];i++){
  const hub=hubs[i%hubs.length],a=random()*TAU,rad=Math.sqrt(random());
  const x=i===0?cx:hub.x+Math.cos(a)*sx*.55*rad,y=i===0?cy:hub.y+Math.sin(a)*sy*.55*rad;
  const isHub=i<hubs.length,r=i===0?30+group*2:isHub?17+random()*12:random()<.1?10+random()*8:3+random()*5;
  const n={id:world.length,group,x,y,r,isRoot:i===0,title:i===0?roots[group][0]:i<7?names[group][i-1]:'',icon:i===0?roots[group][1]:undefined,color:color[group],parent:-1};
  if(i){const previous=world.slice(start),nearest=previous.map(v=>({v,d:Math.hypot(v.x-x,v.y-y)})).sort((a,b)=>a.d-b.d);n.parent=nearest[0].v.id;edges.push([n.parent,n.id]);
   // Local cycles and hub shortcuts create multiple associations, not a tree.
   if(i>5&&random()<.42){const candidate=nearest[Math.min(nearest.length-1,1+Math.floor(random()*5))].v;edges.push([candidate.id,n.id]);}
   if(i>12&&random()<.11)edges.push([start+1+Math.floor(random()*Math.min(i-1,hubs.length)),n.id]);
  }
  world.push(n);
 }
}
// Resolve visual collisions without randomising the graph from frame to frame.
for(let pass=0;pass<12;pass++)for(let i=0;i<world.length;i++)for(let j=i+1;j<world.length;j++){
 const a=world[i],b=world[j];if(a.group!==b.group)continue;
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.01,gap=a.r+b.r+4;
 if(d<gap){const push=(gap-d)*.27,ux=dx/d,uy=dy/d;if(!a.isRoot){a.x-=ux*push;a.y-=uy*push;}if(!b.isRoot){b.x+=ux*push;b.y+=uy*push;}}
}
for(const [ga,gb] of [[0,1],[0,2],[1,3],[1,5],[2,3],[2,4],[3,4],[0,5],[3,5]]){
 const aa=world.filter(n=>n.group===ga),bb=world.filter(n=>n.group===gb);
 const pairs=aa.flatMap(a=>bb.map(b=>({a,b,d:Math.hypot(a.x-b.x,a.y-b.y)}))).sort((a,b)=>a.d-b.d);
 for(let j=0;j<2;j++){const pair=pairs[j*7];edges.push([pair.a.id,pair.b.id]);}
}
export const little=[{x:0,y:0,r:43,title:'Первая мысль',icon:'idea',color:color[0]},{x:170,y:-210,r:28,title:'Попробовать',icon:'note',color:color[1]},{x:175,y:220,r:31,title:'Новый проект',icon:'project',color:color[2]},{x:-170,y:210,r:26,title:'Вдохновение',icon:'note',color:color[3]},{x:-185,y:-200,r:29,title:'С кем поделиться',icon:'person',color:color[4]},{x:250,y:-540,r:20,title:'Первый шаг',color:color[1]},{x:230,y:540,r:22,title:'План',color:color[2]},{x:-245,y:530,r:20,title:'Книга',color:color[3]}];
export function littleGraph(c,t,{zoom=1,cx=960,cy=510,count=5,drag=0,physics=0,selected=false,labels=true}={}){c.save();c.translate(cx,cy);c.scale(zoom,zoom);const nodes=little.slice(0,count).map((n,i)=>({...n,x:n.x+drag*Math.exp(-i*.45)*Math.cos(i*.6),y:n.y+drag*.35*Math.sin(i*.8)+physics*Math.sin(i*2.4)*100}));for(let i=1;i<nodes.length;i++)link(c,nodes[i<5?0:i===7?3:i===5?1:2],nodes[i],themes[0],.6,1.6,.03*Math.sin(t+i));nodes.forEach((n,i)=>node(c,n,{label:labels,selected:selected,glow:i===0}));c.restore();return nodes.map(n=>({...n,x:cx+n.x*zoom,y:cy+n.y*zoom,r:n.r*zoom}));}
export function graph(c,t,{count=840,zoom=.68,cx=960,cy=530,theme=themes[0],labels=true,territories=false,focus=-1,edgeAlpha=1,nodeAlpha=1,territoryAlpha=1,colored=false,build=0,morph=1}={}){
 let nodes=build?world.map(n=>{if(n.isRoot){const angle=build*.42,x=n.x*Math.cos(angle)-n.y*Math.sin(angle),y=n.x*Math.sin(angle)+n.y*Math.cos(angle);return {...n,x:x*(build%2?1.08:.85),y:y*(build%2?.88:1.12)};}const root=world[groupRoots[n.group]],i=n.id-root.id,a=i*2.39996+build,rad=25+Math.sqrt(i)*18;let dx=n.x-root.x,dy=n.y-root.y;
 if(build===1){dx=Math.cos(a)*rad;dy=Math.sin(a)*rad;}
 else if(build===2){dx=(i%7-3)*62+Math.sin(i*.7)*12;dy=(Math.floor(i/7)-10)*22;}
 else if(build===3){dx=dx*.65+Math.sin(dy*.018)*110;dy=dy*1.25;}
 else if(build===4){dx=(i%11-5)*39;dy=(Math.floor(i/11)-6)*36;}
 else if(build===5){const r=50+Math.floor(i/25)*31;dx=Math.cos(a)*r*1.3;dy=Math.sin(a)*r*.75;}
 else{dx=dx*1.3;dy=dy*.65+Math.sin(dx*.025)*95;}
 const angle=build*.42,rx=(root.x*Math.cos(angle)-root.y*Math.sin(angle))*(build%2?1.08:.85),ry=(root.x*Math.sin(angle)+root.y*Math.cos(angle))*(build%2?.88:1.12);return {...n,x:rx+dx,y:ry+dy,r:n.r*(build%2?.85:1.1),shape:n.r>15&&build===4?'square':n.shape};}):world;
 if(morph<1)nodes=nodes.map((n,i)=>i<5?{...n,x:mix(world[0].x+little[i].x,n.x,morph),y:mix(world[0].y+little[i].y,n.y,morph),r:mix(little[i].r,n.r,morph),title:little[i].title,icon:little[i].icon}:n);
 c.save();c.translate(cx,cy);c.scale(zoom,zoom);

 if(territories)for(let g=0;g<6;g++){const root=nodes[groupRoots[g]];if(root.id<count)region(c,root.x,root.y,spreads[g][0]*1.05,spreads[g][1]*1.08,(colored?folderColors[(g+build)%6]:color[g]),.85*territoryAlpha*clamp((count-root.id)/32));}
 for(const [ai,bi] of edges){if(ai>=count||bi>=count)continue;const a=nodes[ai],b=nodes[bi],active=focus<0||a.group===focus||b.group===focus;link(c,a,b,theme,(active?.42:.07)*edgeAlpha*clamp(count-Math.max(ai,bi)),(a.group===b.group?.9:1.35)/zoom,.025);}
 for(let i=0;i<Math.min(count,world.length);i++){const n=nodes[i],alpha=clamp(count-i)*(focus<0||n.group===focus?1:.16)*nodeAlpha;node(c,colored&&n.isRoot?{...n,color:folderColors[(n.group+build)%6]}:theme===themes[0]?n:{...n,color:theme.accent},{theme,alpha,label:false,glow:n.isRoot});}
 if(labels)for(let i=0;i<Math.min(count,nodes.length);i++){const n=nodes[i];if(!n.title||!(n.isRoot||zoom>1.1&&i%3===0))continue;c.save();c.globalAlpha*=clamp(count-i)*(focus<0||n.group===focus?1:.16);const size=23/zoom,w=Math.min(310/zoom,n.title.length*size*.58+22/zoom),y=n.y+n.r+25/zoom;const labelInk=colored&&n.isRoot?folderColors[(n.group+build)%6]:theme.ink;round(c,n.x-w/2,y-19/zoom,w,38/zoom,12/zoom,theme.bg,colored&&n.isRoot?labelInk:undefined);text(c,n.title,n.x,y,size,labelInk,500,'center');c.restore();}
 c.restore();
}
export function region(c,x,y,rx,ry,ink,alpha=1){c.save();c.globalAlpha*=alpha;c.beginPath();for(let i=0;i<=80;i++){const a=i/80*TAU,r=1+.045*Math.sin(a*3)+.025*Math.cos(a*5);const px=x+Math.cos(a)*rx*r,py=y+Math.sin(a)*ry*r;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.fillStyle=ink+'0b';c.fill();c.strokeStyle=ink+'70';c.lineWidth=1.6;c.stroke();c.restore();}
export function pill(c,label,x,y,{selected=false,ink=color[0],width=170}={}){round(c,x,y,width,58,29,selected?ink:themes[0].surface,selected?undefined:'#494949');text(c,label,x+width/2,y+29,22,selected?themes[0].bg:themes[0].ink,500,'center');}
export function caption(c,label,sub='',alpha=1){c.save();c.globalAlpha*=alpha;text(c,label,120,150,64,themes[0].ink,500);if(sub)text(c,sub,124,218,25,themes[0].muted,400);c.restore();}
export function brand(c,x,y,size=140,alpha=1){c.save();c.globalAlpha*=alpha;const p=[{x:x,y:y-size*.36,r:size*.16},{x:x-size*.35,y:y+size*.18,r:size*.10},{x:x+size*.36,y:y+size*.16,r:size*.125}];for(let i=0;i<3;i++)link(c,p[i],p[(i+1)%3],{edge:'#f1f5f1'},1,Math.max(2,size*.035));p.forEach((n,i)=>{c.beginPath();c.arc(n.x,n.y,n.r,0,TAU);c.fillStyle=i===0?'#f1f5f1':themes[0].bg;c.fill();c.strokeStyle='#f1f5f1';c.lineWidth=Math.max(2,size*.035);c.stroke();});c.restore();}
