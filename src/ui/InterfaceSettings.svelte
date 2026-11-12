<script lang="ts">
 import {onMount} from 'svelte';import PluginSetting from './PluginSetting.svelte';import {interfacePlugins} from '../plugins/interface';import type {Core} from '../core/core';
 let {core}:{core:Core}=$props();const manifest=interfacePlugins(()=>{},()=>{}).find(p=>p.manifest.id==='builtin.interface')!.manifest;let values=$state<Record<string,any>>({}),error=$state('');
 onMount(()=>{void Promise.all(manifest.settings!.map(async field=>values[field.key]=await core.storage.getSetting(`plugin:${manifest.id}:${field.key}`)??field.default)).catch(e=>error=e.message);});
 async function change(key:string,value:unknown){try{await core.storage.transaction([{kind:'setting',key:`plugin:${manifest.id}:${key}`,value}]);values[key]=value;core.emit('preferences:plugin-setting',{plugin:manifest.id,key});}catch(e){error=(e as Error).message;}}
</script>
<details><summary>Панели и навигация</summary>{#each manifest.settings! as field}<PluginSetting disabled={false} {field} value={values[field.key]??field.default} onchange={value=>change(field.key,value)}/>{/each}{#if error}<p role="alert">{error}</p>{/if}</details>
