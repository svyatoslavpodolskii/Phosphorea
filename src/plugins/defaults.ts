import type {StorageAdapter,Mutation} from '../core/model';

export const optionalBuiltins=['builtin.templates','builtin.daily','builtin.molecule','builtin.compact','builtin.ambient'];
/** Builtins that were withdrawn. They are switched off once and then forgotten;
 *  anything they wrote stays in the workspace, because that is the user's data. */
const retired=['builtin.daily-tasks'];

/** Persist once per workspace; upgrades retain the previous enabled set. */
export async function initializePluginDefaults(storage:StorageAdapter,hasAtoms:boolean){
 let disabled=await storage.getSetting<string[]>('disabled-builtins');
 const existing=hasAtoms||disabled!==undefined||await storage.getSetting('map')!==undefined||await storage.getSetting('preferences')!==undefined;
 if(!existing){const disabled=[...retired];await storage.transaction([{kind:'setting',key:'disabled-builtins',value:disabled},...['retired-builtins-v1','map-tools-defaults-v1','plugin-defaults-v2','lasso-default-v2'].map(key=>({kind:'setting' as const,key,value:true}))]);return disabled;}
 if(!await storage.getSetting('retired-builtins-v1')){
  if(disabled!==undefined)disabled=[...new Set([...disabled,...retired])];
  await storage.transaction([{kind:'setting',key:'retired-builtins-v1',value:true},...(disabled!==undefined?[{kind:'setting' as const,key:'disabled-builtins',value:disabled}]:[])]);
 }
 if(!await storage.getSetting('map-tools-defaults-v1')){
  disabled=[...new Set([...(disabled??(existing?retired:optionalBuiltins)),'builtin.ambient','builtin.lasso'])];
  await storage.transaction([{kind:'setting',key:'disabled-builtins',value:disabled},{kind:'setting',key:'map-tools-defaults-v1',value:true}]);
 }
 if(await storage.getSetting('plugin-defaults-v2'))return lassoDefault(storage,disabled??(existing?retired:optionalBuiltins));
 const next=disabled??(existing?retired:[...optionalBuiltins]);
 const ops:Mutation[]=[{kind:'setting',key:'disabled-builtins',value:next},{kind:'setting',key:'plugin-defaults-v2',value:true}];
 if(existing)for(const field of ['years','months']){
  const key=`plugin:builtin.daily:${field}`;
  if(await storage.getSetting(key)===undefined)ops.push({kind:'setting',key,value:true});
 }
 await storage.transaction(ops);
 return lassoDefault(storage,next);
}

/** One-time repair of the old release's automatically disabled lasso. Later choices persist. */
async function lassoDefault(storage:StorageAdapter,disabled:string[]){
 if(await storage.getSetting('lasso-default-v2'))return disabled;
 const next=disabled.filter(id=>id!=='builtin.lasso');
 await storage.transaction([{kind:'setting',key:'disabled-builtins',value:next},{kind:'setting',key:'lasso-default-v2',value:true}]);return next;
}
