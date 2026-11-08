import {text,round,node,link,smooth,mix,icon} from '../engine.js';
import {qr} from '../sync-qr.js';
const ink='#f3f3f3',muted='#a8a8a8',surface='#171717',theme={bg:'#070707',surface,ink,accent:ink,edge:'#888888'};
function notes(c,x,y,t,scale=1){c.save();c.translate(x,y);c.scale(scale,scale);const a={x:0,y:0,r:21,icon:'note',title:''},b={x:85,y:-60,r:14},d={x:-60,y:80,r:16};link(c,a,b,theme,.7);link(c,a,d,theme,.7);node(c,a,{theme});node(c,b,{theme});node(c,d,{theme});c.restore();}
export default function(c,t,s){const e=s.events;
 c.fillStyle='#070707';c.fillRect(-4000,-4000,10000,10000);
 const enter=smooth(t/.15),transfer=smooth((t-e.transfer)/1.2);c.save();c.globalAlpha=enter;
 // Phone and computer share the same visual field; neither is a permanent host.
 round(c,655,-50,260,495,38,surface,'#666666');round(c,747,-33,76,10,5,'#555555');notes(c,785,195,t,.95);
 round(c,1005,490,430,285,24,surface,'#666666');round(c,1187,775,66,65,10,'#333333');round(c,1115,835,210,12,6,'#555555');
 text(c,'Телефон',785,485,25,muted,400,'center');text(c,'Компьютер',1220,892,25,muted,400,'center');
 const q=1-smooth((t-e.verify)/.3);if(q>0){c.save();c.globalAlpha*=(t>=e.qr?1:0)*q;round(c,1114,529,206,206,15,'#fff');const size=qr.length,cell=174/size;c.fillStyle='#111111';for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(qr[y][x])c.fillRect(1130+x*cell,545+y*cell,cell+.1,cell+.1);c.restore();}
 if(t>=e.verify){c.save();c.globalAlpha*=1;notes(c,1220,635,t,1.1);c.restore();}
 // Two identical verification strips, followed by a bidirectional exchange.
 const verify=(t>=e.verify?1:0)*(1-smooth((t-e.transfer)/.15));if(verify>0){c.save();c.globalAlpha*=verify;for(const y of [1050,1130]){round(c,700,y-31,520,62,20,surface,'#414141');['🌙','🌻','🐢','🔑','⛵','🍋'].forEach((e,i)=>text(c,e,745+i*85,y,36,ink,400,'center'));}c.restore();}
 if(t>=e.transfer){const a={x:860,y:370},b={x:1110,y:540};c.strokeStyle='#777777';c.lineWidth=2;c.setLineDash([4,9]);c.beginPath();c.moveTo(a.x,a.y);c.bezierCurveTo(1020,345,950,565,b.x,b.y);c.stroke();c.setLineDash([]);for(let i=0;i<4;i++){const p=(transfer+i*.25)%1;for(const reverse of [false,true]){const u=reverse?1-p:p,x=mix(a.x,b.x,u),y=mix(a.y,b.y,u);round(c,x-10,y-13,20,26,4,ink);}}}
 c.globalAlpha*=t>=e.caption?1:0;text(c,'Одна карта.',960,1075,53,ink,500,'center');text(c,'На любом устройстве.',960,1150,45,ink,500,'center');text(c,'Без облачного хранилища',960,1250,28,muted,400,'center');c.restore();
}
