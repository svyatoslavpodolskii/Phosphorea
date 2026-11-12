import {validateManifest} from '../plugins/api';
import {preferences} from '../core/preferences';
export const APPEARANCE='appearance-profile';
export type PluginSyncMode='all'|'settings'|'local';
export function pluginSyncMode(value:unknown):PluginSyncMode{return value==='settings'||value==='local'?value:'all';}
/** The visual opt-in is independent of the functional plugin policy. */
export function acceptsPluginSetting(key:string,mode:PluginSyncMode,installed:Set<string>){
 if(visualSetting(key))return true;
 if(mode==='all')return true;
 if(key==='disabled-builtins'||key==='community-plugins')return false;
 if(mode==='local')return key!=='preferences'&&!key.startsWith('plugin:');
 if(!key.startsWith('plugin:'))return true;
 const id=key.slice(7).split(':')[0];return id.startsWith('builtin.')||installed.has(id);
}
/** Migration receipts are device-local, but share the same scope as plugin defaults. */
export function profileSetting(key:string){return sharedSetting(key)||key==='plugin:builtin.transcription:model'||['retired-builtins-v1','map-tools-defaults-v1','plugin-defaults-v2','lasso-default-v2'].includes(key);}
/** Device trust, filesystem bindings, backups and camera state never travel. */
export function sharedSetting(key:string){return typeof key==='string'&&(['preferences',APPEARANCE,'disabled-builtins','community-plugins'].includes(key)||key.startsWith('plugin:')&&key!=='plugin:builtin.transcription:model'&&!key.startsWith('plugin:builtin.obsidian:'));}
export function visualSetting(key:string){return key===APPEARANCE||/^plugin:builtin\.(appearance|animations|zoom|interface)/.test(key);}
export function functionalPreferences(value:any){const {theme,customThemes,...rest}=value||{};return rest;}
export function validateSetting(key:string,value:unknown){
 if(!sharedSetting(key)||key.length>300||value===undefined||JSON.stringify(value).length>12_000_000)throw Error('Недопустимая общая настройка.');
 if(key==='disabled-builtins'&&(!Array.isArray(value)||value.length>100||value.some(v=>typeof v!=='string'||!/^builtin\.[a-z0-9.-]+$/.test(v))))throw Error('Некорректный список плагинов.');
 if(key==='community-plugins'){
  if(!Array.isArray(value)||value.length>100)throw Error('Некорректные пакеты плагинов.');
  const ids=new Set();for(const p of value){validateManifest(p?.manifest);if(p.manifest.id.startsWith('builtin.')||ids.has(p.manifest.id)||typeof p.source!=='string'||p.source.length>1_000_000||typeof p.enabled!=='boolean'||p.style!==undefined&&(typeof p.style!=='string'||p.style.length>1_000_000))throw Error('Некорректный пакет плагина.');ids.add(p.manifest.id);if(p.assets!==undefined){if(!p.assets||Array.isArray(p.assets)||typeof p.assets!=='object')throw Error('Некорректные ресурсы плагина.');for(const [path,bytes] of Object.entries(p.assets)){if(!path.startsWith('assets/')||path.includes('..')||!Array.isArray(bytes)||bytes.some(n=>!Number.isInteger(n)||Number(n)<0||Number(n)>255))throw Error('Некорректный ресурс плагина.');}}}
 }
 if((key==='preferences'||key===APPEARANCE)&&(!value||typeof value!=='object'||Array.isArray(value)))throw Error('Некорректные настройки.');
 if(key==='preferences'||key===APPEARANCE)preferences(value as any);
}
