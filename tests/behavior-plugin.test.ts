import {it,expect,vi} from 'vitest';
import {behaviorPlugin} from '../src/plugins/behavior';
import {preferences} from '../src/core/preferences';
import {validateManifest,type PluginAPI} from '../src/plugins/api';

it('migrates current physics settings without changing them, then applies scoped settings and disposes listeners',async()=>{
 let prefs=preferences({liveliness:.35,linkMode:'off'});const values:Record<string,unknown>={};let listener:((e:any)=>unknown)|undefined;
 const write=vi.fn(async patch=>{prefs={...prefs,...patch};}),off=vi.fn(()=>listener=undefined);
 const api={settings:{get:async(key:string)=>values[key],set:async(key:string,value:unknown)=>{values[key]=value;}},events:{on:(_event:string,fn:(e:any)=>unknown)=>{listener=fn;return off;}}} as unknown as PluginAPI;
 const plugin=behaviorPlugin(()=>prefs,write);validateManifest(plugin.manifest);const stop=await plugin.activate(api);
 expect(plugin.manifest.settings!.find(f=>f.key==='liveliness')!.default).toBe(.35);expect(plugin.manifest.settings!.find(f=>f.key==='linkMode')!.default).toBe('off');expect(values).toEqual({});expect(write).not.toHaveBeenCalled();values.distance=230;await listener!({plugin:'builtin.physics',key:'distance'});expect(prefs.physics.distance).toBe(230);expect(prefs.liveliness).toBe(.35);if(typeof stop==='function')stop();expect(off).toHaveBeenCalledOnce();
 values.liveliness=.7;const stopAgain=await plugin.activate(api);expect(prefs.liveliness).toBe(.7);expect(prefs.physics.distance).toBe(230);if(typeof stopAgain==='function')stopAgain();
});
