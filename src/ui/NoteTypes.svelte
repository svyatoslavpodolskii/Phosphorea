<script lang="ts">
 import {onMount} from 'svelte';
 import type {Core} from '../core/core';
 import {NOTE_TYPES_KEY,noteTypes} from '../core/note-types';
 import type {AtomType} from '../plugins/api';
 import {ICONS,iconDefinition} from '../core/icons';
 import Choice from './Choice.svelte';
 let {core}:{core:Core}=$props();
 let catalog=$state<AtomType[]>([]),editing=$state<AtomType|null>(null),deleting=$state<AtomType|null>(null),busy=$state(false),error=$state('');
 onMount(()=>{core.storage.getSetting(NOTE_TYPES_KEY).then(value=>catalog=noteTypes(value,core.data.atoms.map(a=>a.type))).catch(e=>error=e.message);});
 async function persist(next:AtomType[],removed?:string){busy=true;error='';try{
  const values=noteTypes(next),affected=removed?core.data.atoms.filter(a=>a.type===removed||a.type==='builtin.templates:'+removed):[];
  await core.commit([...affected.map(atom=>({kind:'atom' as const,expectedRevision:atom.revision,atom:{...atom,type:'note',revision:atom.revision+1,updated_at:new Date().toISOString()}})),{kind:'setting',key:NOTE_TYPES_KEY,value:values}]);
  core.emit('preferences:plugin-setting',{plugin:'builtin.templates',key:'catalog'});catalog=values;editing=null;deleting=null;
 }catch(e){error=(e as Error).message;}finally{busy=false;}}
</script>
<div class="type-settings">
 <p class="explanation">Тип — название, значок и шаблон текста. Он не создаёт папку и не меняет положение на карте.</p>
 {#if error}<p role="alert">{error}</p>{/if}
 {#each catalog as type}<div class="type-row"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={iconDefinition(type.icon||'icon:note')?.path}/></svg><span>{type.name}</span><button aria-label={`Изменить тип ${type.name}`} disabled={busy} onclick={()=>{editing=structuredClone($state.snapshot(type));deleting=null;}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14Z"/></svg></button>{#if type.id!=='note'}<button aria-label={`Удалить тип ${type.name}`} disabled={busy} onclick={()=>{deleting=type;editing=null;}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/></svg></button>{/if}</div>{/each}
 {#if deleting}<div class="type-form"><p>Удалить тип «{deleting.name}»? Его заметки станут обычными заметками. Текст, связи и оформление сохранятся.</p><div class="actions"><button disabled={busy} onclick={()=>persist(catalog.filter(t=>t.id!==deleting!.id),deleting!.id)}>Удалить тип</button><button disabled={busy} onclick={()=>deleting=null}>Отмена</button></div></div>{/if}
 {#if editing}<div class="type-form"><label class="stack">Название типа<input aria-label="Название типа" bind:value={editing.name} maxlength="60"/></label><Choice label="Значок типа" value={editing.icon||'icon:note'} options={ICONS.map(i=>({value:'icon:'+i.id,label:i.name==='Центр'?'Связи':i.name}))} onchange={value=>editing={...editing!,icon:value}}/><label class="stack">Шаблон текста<textarea aria-label="Шаблон текста" bind:value={editing.content} placeholder="Необязательно" maxlength="100000" rows="3"></textarea></label><div class="actions"><button class="primary" disabled={busy||!editing.name.trim()} onclick={()=>persist(catalog.some(t=>t.id===editing!.id)?catalog.map(t=>t.id===editing!.id?editing!:t):[...catalog,editing!])}>Сохранить тип</button><button disabled={busy} onclick={()=>editing=null}>Отмена</button></div></div>{:else}<button class="add-type" disabled={busy||catalog.length>=100} onclick={()=>{editing={id:'custom-'+crypto.randomUUID(),name:'',icon:'icon:note',content:''};deleting=null;}}>Добавить тип</button>{/if}
 <small>Типы и шаблоны входят в полную копию хранилища и экспорт карты.</small>
</div>
<style>
 .explanation{font-size:13px;line-height:1.5;color:var(--theme-muted);margin:0 0 12px}.type-row{display:flex;align-items:center;gap:10px;min-height:48px}.type-row>span{flex:1;overflow-wrap:anywhere}.type-row svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.5;flex:none}.type-row>svg{color:var(--theme-muted)}.type-row button{padding:7px;width:38px;height:40px;min-height:40px;border:0;background:transparent;border-radius:12px}.type-form{padding:12px;margin-block:10px;border:1px solid var(--theme-border);border-radius:16px;display:grid;gap:10px}.type-form label{margin:0}.type-form p{font-size:13px;margin:0;line-height:1.5}.type-form textarea{resize:vertical;min-height:90px}.actions{display:flex;gap:8px}.add-type{margin:12px 0}small{display:block;color:var(--theme-muted);font-size:11px;line-height:1.5;letter-spacing:0}
</style>
