import type {Plugin,PluginAPI} from './api';
import {projectFolders,FOLDER_MEMBERSHIP} from '../graph/folders';

/** Calendar containers are ordinary atoms; no private graph entities. */
export async function createDaily(app:PluginAPI,date=new Date(),contextId?:string,folderId?:string,position?:{x:number;y:number}){
 const day=date.toLocaleDateString('sv-SE'),year=day.slice(0,4),month=day.slice(0,7);
 const atoms=await app.atoms.list(),links=await app.links.list();
 const existing=atoms.find(a=>a.properties.dailyDate===day);
 if(existing){app.graph.focus(existing.id);return existing;}
 const projection=contextId||folderId?projectFolders({atoms,links}):null;
 const weights=folderId&&projection?.folders.some(f=>f.id===folderId)?{[folderId]:1}:contextId?projection?.memberships.get(contextId):undefined;
 const format=await app.settings.get<string>('dayFormat')||'{D} {MMMM} {YYYY}';
 const title=format.replace(/\{(YYYY|MMMM|MM|DD|D)\}/g,(_,token:string)=>({YYYY:year,MMMM:date.toLocaleDateString('ru-RU',{day:'numeric',month:'long'}).replace(/^\d+\s*/,''),MM:day.slice(5,7),DD:day.slice(8),D:String(date.getDate())}[token]!));
 async function ensure(key:string,title:string,parent?:string,placement=position||{x:0,y:0}){
  let atom=atoms.find(a=>a.properties.calendarKey===key||(key===day&&a.properties.dailyDate===day));
  if(position){for(let i=0;i<512;i++){const radius=140*Math.sqrt(i),angle=i*2.399963229728653;placement={x:position.x+Math.cos(angle)*radius,y:position.y+Math.sin(angle)*radius};if(atoms.every(a=>Math.hypot(a.x-placement.x,a.y-placement.y)>130+(a.appearance.size_override||30)))break;}}
  if(!atom){atom=await app.atoms.create({title,...(contextId?{}:placement),properties:{calendarKey:key,...(weights?{[FOLDER_MEMBERSHIP]:weights}:{}),...(key===day?{dailyDate:day}:{})},...(key===day?{state:'normal' as const,content:'## Что сегодня важно\n\n- \n\n## Мысли\n\n'}:{})},parent);atoms.push(atom);if(parent){const actual=(await app.links.list()).find(l=>l.from===parent&&l.to===atom!.id);if(actual)links.push(actual);}}
  if(parent&&!links.some(l=>(l.from===parent&&l.to===atom!.id)||(l.to===parent&&l.from===atom!.id)))links.push(await app.links.create(parent,atom.id));
  return atom;
 }
 let parent=atoms.find(a=>a.id===contextId);
 if(await app.settings.get<boolean>('years')===true)parent=await ensure(year,year,parent?.id);
 if(await app.settings.get<boolean>('months')===true)parent=await ensure(month,date.toLocaleDateString('ru-RU',{month:'long',year:'numeric'}),parent?.id,{x:(parent?.x||0)+date.getMonth()*260,y:(parent?.y||0)+240});
 const weeks=await app.settings.get<boolean>('weeks');
 // Weeks are month-local, so a week never belongs to two month containers.
 const week=Math.floor((date.getDate()-1)/7)+1;
 if(weeks)parent=await ensure(`${month}-w${week}`,`${(week-1)*7+1}–${Math.min(week*7,new Date(date.getFullYear(),date.getMonth()+1,0).getDate())} · ${date.toLocaleDateString('ru-RU',{month:'long'})}`,parent?.id,{x:(parent?.x||0)+(week-1)*260,y:(parent?.y||0)+220});
 const atom=await ensure(day,title,parent?.id,position||{x:(parent?.x||0)+(parent?(weeks?(date.getDate()-1)%7:date.getDate()-1)*220:0),y:(parent?.y||0)+220});
 app.graph.focus(atom.id);return atom;
}
export const daily:Plugin={manifest:{id:'builtin.daily',name:'Ежедневные заметки',version:'1.0.0',apiVersion:1,description:'Календарная иерархия обычных атомов.',permissions:['atoms.read','atoms.write','links.read','links.write','graph','ui','settings'],settings:[{key:'years',label:'Создавать атом года',type:'boolean',default:false},{key:'months',label:'Создавать атом месяца',type:'boolean',default:false},{key:'weeks',label:'Недели месяца (1–7, 8–14…)',type:'boolean',default:false},{key:'dayFormat',label:'Название дня: {D}, {DD}, {MM}, {MMMM}, {YYYY}',type:'text',default:'{D} {MMMM} {YYYY}'}]},activate(app){let pending:Promise<unknown>|undefined;app.commands.add({id:'daily',name:'Создать дневную запись',run(contextId,context){if(!pending)pending=createDaily(app,new Date(),contextId,context?.folderId,context?.position).finally(()=>pending=undefined);return pending;}});}};
