import type {Plugin,SettingField} from './api';
import {validSettingValue} from './api';
import type {Preferences} from '../core/preferences';
import {PRESETS,PHYSICS_RANGES,type PhysicsSettings} from '../graph/physics';

const labels:Record<keyof PhysicsSettings,string>={elasticity:'Упругость',repulsion:'Разделение при контакте',distance:'Длина связей',damping:'Сохранение движения',inertia:'Инерция',friction:'Устойчивость после перемещения'};
/** Preferences remain the compatibility source; scoped plugin settings own new
 * edits. Disabling the plugin suspends motion without erasing either store. */
export function behaviorPlugin(read:()=>Preferences,write:(patch:Partial<Preferences>)=>Promise<void>):Plugin{
 const fields:SettingField[]=[
  {key:'graphModel',label:'Модель карты',type:'select',default:'builtin.branch:structure',options:[{value:'builtin.branch:structure',label:'Ветви'},{value:'builtin.molecule:structure',label:'Молекула'},{value:'builtin.compact:structure',label:'Созвездия'}]},
  {key:'liveliness',label:'Живость карты',type:'range',min:0,max:1,step:.05,default:0},
  ...Object.entries(PHYSICS_RANGES).map(([key,[min,max]]):SettingField=>({key,label:labels[key as keyof PhysicsSettings],type:'range',min,max,step:(max-min)/100,default:PRESETS.calm[key as keyof PhysicsSettings]})),
  {key:'linkMode',label:'Связи из текста',type:'select',default:'suggest',options:[{value:'suggest',label:'Предлагать'},{value:'automatic',label:'Автоматически'},{value:'off',label:'Выключено'}]},
 ];
 return {manifest:{id:'builtin.physics',name:'Физика и поведение',description:'Свободное движение, модели карты, живость и связи из текста.',version:'1.0.0',apiVersion:1,permissions:['settings'],settings:fields},async activate(app){
  // Existing preferences supply defaults without thirteen startup transactions.
  const prefs=read();for(const field of fields){const value=field.key in prefs.physics?prefs.physics[field.key as keyof PhysicsSettings]:(prefs as unknown as Record<string,unknown>)[field.key];if(validSettingValue(field,value))Object.assign(field,{default:value});}
  const stored=await Promise.all(fields.map(field=>app.settings.get(field.key))),patch:Record<string,unknown>={},physics={...prefs.physics};let physicsChanged=false;
  fields.forEach((field,i)=>{const value=stored[i];if(!validSettingValue(field,value))return;if(field.key in PHYSICS_RANGES){if(value!==physics[field.key as keyof PhysicsSettings]){physics[field.key as keyof PhysicsSettings]=value as number;physicsChanged=true;}}else if(value!==(prefs as unknown as Record<string,unknown>)[field.key])patch[field.key]=value;});
  if(physicsChanged)patch.physics=physics;if(Object.keys(patch).length)await write(patch as Partial<Preferences>);
  let alive=true,queue=Promise.resolve();
  const off=app.events.on('preferences:plugin-setting',event=>{
   if(event.plugin!=='builtin.physics')return;const field=fields.find(f=>f.key===event.key);if(!field)return;
   const next=queue.catch(()=>{}).then(async()=>{if(!alive)return;const value=await app.settings.get(field.key);if(!alive||!validSettingValue(field,value))return;
    const patch=field.key in PHYSICS_RANGES?{physics:{...read().physics,[field.key]:value}}:{[field.key]:value};await write(patch as Partial<Preferences>);
   });queue=next;return next;
  });
  return()=>{alive=false;off();};
 }};
}
export const appearancePlugin:Plugin={manifest:{id:'builtin.appearance',name:'Темы и атмосфера',description:'Палитры, контраст, бумага и тематические фоны.',version:'1.0.0',apiVersion:1,permissions:[]},activate(){}};
