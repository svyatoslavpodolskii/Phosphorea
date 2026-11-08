import type {Plugin,SettingField} from './api';
import {validSettingValue} from './api';
export interface ZoomControls {side:'left'|'right'|'bottom';feedback:boolean;style?:'slider'|'wheel'}
export interface BoardControls {scale:number;gap:number}
function controlPlugin<T>(id:string,name:string,description:string,fields:SettingField[],changed:(value:T|null)=>void):Plugin{
 return {manifest:{id,name,description,version:'1.0.0',apiVersion:1,permissions:['settings'],settings:fields},async activate(api){let alive=true,revision=0;
  async function refresh(){const version=++revision,result:Record<string,unknown>={};for(const field of fields){const value=await api.settings.get(field.key);result[field.key]=validSettingValue(field,value)?value:field.default;}if(alive&&version===revision)changed(result as T);}
  const off=api.events.on('preferences:plugin-setting',event=>event.plugin===id?refresh():undefined);try{await refresh();}catch(error){off();throw error;}
  return()=>{alive=false;revision++;off();changed(null);};
 }};
}
export function interfacePlugins(zoom:(value:ZoomControls|null)=>void,board:(value:BoardControls|null)=>void){return[
 controlPlugin<ZoomControls>('builtin.zoom','Кинетичный зум','Управление одной рукой. Ненавязчивый ползунок с откликом на масштаб и границы.',[
  {key:'side',label:'Расположение зума',type:'select',default:'right',options:[{value:'right',label:'Справа'},{value:'left',label:'Слева'},{value:'bottom',label:'Снизу'}]},
  {key:'style',label:'Управление зумом',type:'select',default:'slider',options:[{value:'slider',label:'Ползунок'},{value:'wheel',label:'Крутилка'}]},
  {key:'feedback',label:'Тактильный отклик',type:'boolean',default:true},
 ],zoom),
 controlPlugin<BoardControls>('builtin.kanban','Канбан','Задачи из заметок, компактное представление и повторения.',[
  {key:'scale',label:'Масштаб канбана',type:'range',min:.8,max:1.15,step:.05,default:.9},
  {key:'gap',label:'Отступы канбана',type:'range',min:2,max:16,step:2,default:6},
 ],board),
];}
