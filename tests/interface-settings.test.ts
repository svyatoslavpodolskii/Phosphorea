import {it,expect} from 'vitest';
import {validateManifest,validSettingValue,type Manifest,type PluginAPI} from '../src/plugins/api';
import {interfacePlugins} from '../src/plugins/interface';
it('validates numeric bounds, defaults and finite values in plugin manifests',()=>{
 const plugins=interfacePlugins(()=>{},()=>{});for(const plugin of plugins)expect(()=>validateManifest(plugin.manifest)).not.toThrow();
 const manifest:Manifest={id:'test.settings',name:'Settings',version:'1',apiVersion:1,permissions:['settings'],settings:[{key:'scale',label:'Scale',type:'range',min:.8,max:1.2,step:.05,default:1}]};
 const field=manifest.settings![0];expect(validSettingValue(field,NaN)).toBe(false);expect(validSettingValue(field,Infinity)).toBe(false);expect(validSettingValue(field,.5)).toBe(false);expect(validSettingValue(field,'1')).toBe(false);
 for(const patch of [{min:2},{step:0},{max:Infinity},{default:4}])expect(()=>validateManifest({...manifest,settings:[{...field,...patch} as any]})).toThrow();
 const side=plugins.find(p=>p.manifest.id==='builtin.zoom')!.manifest.settings![0];expect(validSettingValue(side,'left')).toBe(true);expect(validSettingValue(side,'other')).toBe(false);
 expect(()=>validateManifest({...manifest,settings:[{...side,options:[{value:'a',label:'A'},{value:'a',label:'B'}]} as any]})).toThrow();
});
it('does not revive interface controls when a settings read finishes after plugin disable',async()=>{
 const changes:unknown[]=[],handlers=new Set<(event:any)=>unknown>();let delayed=false,release:(value:unknown)=>void=()=>{};
 const plugin=interfacePlugins(value=>changes.push(value),()=>{}).find(p=>p.manifest.id==='builtin.zoom')!;
 const api={settings:{get:async(key:string)=>key==='side'&&delayed?new Promise(resolve=>release=resolve):undefined},events:{on:(_name:string,handler:(event:any)=>unknown)=>{handlers.add(handler);return()=>handlers.delete(handler);}}} as unknown as PluginAPI;
 const dispose=await plugin.activate(api);expect(changes.at(-1)).toEqual({side:'right',style:'wheel',feedback:true});
 delayed=true;const pending=[...handlers][0]({plugin:plugin.manifest.id,key:'side'});if(typeof dispose==='function')dispose();release('left');await pending;
 expect(changes).toEqual([{side:'right',style:'wheel',feedback:true},null]);expect(handlers.size).toBe(0);
});
