import {it,expect} from 'vitest';
import {initializePluginDefaults,optionalBuiltins} from '../src/plugins/defaults';
import type {StorageAdapter,Mutation} from '../src/core/model';
function storage(values:Record<string,unknown>={}){
 return {values,adapter:{getSetting:async(key:string)=>values[key],transaction:async(ops:Mutation[])=>{for(const op of ops)if(op.kind==='setting')values[op.key]=op.value;}} as StorageAdapter};
}
it('new workspace enables every available feature, preserving later choices',async()=>{
 const h=storage();expect(await initializePluginDefaults(h.adapter,false)).toEqual(['builtin.daily-tasks']);
 h.values['disabled-builtins']=[];
 expect(await initializePluginDefaults(h.adapter,true)).toEqual([]);
 expect(h.values['plugin:builtin.daily:years']).toBeUndefined();
});
it('upgrade preserves enabled features, calendar defaults and explicit choices',async()=>{
 const h=storage({'disabled-builtins':['builtin.daily'],'plugin:builtin.daily:years':false});
 expect(await initializePluginDefaults(h.adapter,true)).toEqual(['builtin.daily','builtin.daily-tasks','builtin.ambient']);
 expect(h.values['plugin:builtin.daily:years']).toBe(false);
 expect(h.values['plugin:builtin.daily:months']).toBe(true);
 const old=storage({map:{}});expect(await initializePluginDefaults(old.adapter,false)).toEqual(['builtin.daily-tasks','builtin.ambient']);
 const populated=storage();expect(await initializePluginDefaults(populated.adapter,true)).toEqual(['builtin.daily-tasks','builtin.ambient']);
});

it('repairs the automatically disabled lasso once, preserving later explicit disabling',async()=>{
 const h=storage({'plugin-defaults-v2':true,'map-tools-defaults-v1':true,'disabled-builtins':['builtin.lasso','builtin.daily']});expect(await initializePluginDefaults(h.adapter,true)).toEqual(['builtin.daily','builtin.daily-tasks']);h.values['disabled-builtins']=['builtin.lasso','builtin.daily'];expect(await initializePluginDefaults(h.adapter,true)).toEqual(['builtin.lasso','builtin.daily']);
});
