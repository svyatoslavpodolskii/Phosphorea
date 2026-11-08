<script lang="ts">
 import {onDestroy} from 'svelte';
 import type {FolderSummary} from '../graph/folders';
 import {FOLDER_COLORS} from '../plugins/folders';
 import FolderColors from './FolderColors.svelte';
 let {folders,selectionIds=[],activeId=$bindable(null),drag=null,removeIds=[],oncreate,onfocus,onremove,onadd,onupdate}:{
  drag?:{ids:string[];target:string|null}|null;removeIds?:string[];
  folders:FolderSummary[];selectionIds?:readonly string[];activeId?:string|null;
  oncreate:(name:string,ids:readonly string[],color:string)=>Promise<string>;
  onfocus:(id:string|null)=>unknown|Promise<unknown>;
  onupdate:(id:string,name:string,color:string)=>Promise<void>;onremove:(id:string)=>Promise<void>;onadd:(id:string,ids:readonly string[])=>Promise<void>;
 }=$props();
 let creating=$state(false),name=$state(''),color=$state(FOLDER_COLORS[0]),ids=$state<string[]>([]),busy=$state(false),error=$state('');
 let input=$state<HTMLInputElement>();
 let tabs=$state<HTMLDivElement>();let autoHover=$state<string|null>(null);let dragTarget=$derived(autoHover||drag?.target||null);
 $effect(()=>{if(!drag){autoHover=null;return;}let point:{x:number;y:number}|null=null,frame=0,last=0;
  const track=(e:PointerEvent)=>point={x:e.clientX,y:e.clientY};
  const scroll=(time:number)=>{const dt=Math.min(32,time-last||16);last=time;if(point&&tabs){const b=tabs.getBoundingClientRect();if(point.y>b.top-20&&point.y<b.bottom+20&&point.x>b.left-30&&point.x<b.right+30){const edge=42,direction=point.x<b.left+edge?-Math.min(1,(b.left+edge-point.x)/edge):point.x>b.right-edge?Math.min(1,(point.x-b.right+edge)/edge):0;tabs.scrollLeft+=direction*dt*.42;autoHover=(document.elementFromPoint(point.x,point.y)?.closest('[data-folder-id]') as HTMLElement|null)?.dataset.folderId||null;}else autoHover=null;}frame=requestAnimationFrame(scroll);};
  window.addEventListener('pointermove',track);frame=requestAnimationFrame(scroll);return()=>{window.removeEventListener('pointermove',track);cancelAnimationFrame(frame);};
 });
 let collapsed=$state(false),context=$state<string|null>(null);let hold:ReturnType<typeof setTimeout>;let held=false;let pressPoint={x:0,y:0};onDestroy(()=>clearTimeout(hold));let rename=$state(''),tint=$state('#9bbef2');
 function showContext(id:string){const f=folders.find(f=>f.id===id);if(f){context=id;rename=f.name;tint=f.color;}}
 async function updateFolder(){if(!context||busy)return;busy=true;try{await onupdate(context,rename,tint);context=null;}catch(e){error=(e as Error).message;}finally{busy=false;}}

 async function action(remove=false){if(!context)return;busy=true;try{if(remove){await onremove(context);if(activeId===context)activeId=null;}else await onadd(context,selectionIds);context=null;}catch(e){error=(e as Error).message;}finally{busy=false;}}
 /** Host context-action callback: strip?.beginCreate(rawAtomIds). */
 export function beginCreate(selected:readonly string[]){
  if(busy)return;collapsed=false;ids=[...new Set(selected)];if(!ids.length)return;
  name='';color=FOLDER_COLORS[folders.length%FOLDER_COLORS.length];error='';creating=true;
 }
 $effect(()=>{if(creating)input?.focus();});
 async function create(event:SubmitEvent){event.preventDefault();if(busy)return;busy=true;error='';
  try{const id=await oncreate(name,ids,color);creating=false;await focus(id);}catch(e){error=(e as Error).message;}finally{busy=false;}
 }
 async function focus(id:string|null){try{await onfocus(id);activeId=id;error='';}catch(e){error=(e as Error).message;}}
</script>

{#if folders.length||creating||selectionIds.length>1}
<div class="folder-strip" class:collapsed aria-label="Папки">
 <button aria-label={collapsed?'Развернуть папки':'Свернуть папки'} aria-expanded={!collapsed} onclick={()=>{collapsed=!collapsed;if(collapsed){creating=false;context=null;}}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d={collapsed?'m9 12 3 3 3-3':'m9 15 3-3 3 3'}/></svg></button>
 {#if !collapsed}
 <div bind:this={tabs} class="folder-tabs" class:drag-scrolling={Boolean(drag)} role="group" aria-label="Области карты">
  <button data-folder-id={drag?'__remove__':undefined} class:remove-target={Boolean(drag)} class:drop-target={dragTarget==='__remove__'} class:chosen={!drag&&activeId===null} aria-label={drag?(activeId?'Убрать из текущей папки':'Убрать из всех папок'):'Все'} aria-pressed={!drag&&activeId===null} onclick={()=>{if(!drag)void focus(null);}}>{#if drag}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>{:else}Все{/if}</button>
  {#each folders as folder (folder.id)}
   <button data-folder-id={folder.id} class:remove-target={Boolean(drag)&&removeIds.includes(folder.id)} class:drop-target={dragTarget===folder.id} class:chosen={activeId===folder.id} aria-pressed={activeId===folder.id} title={`${folder.name}: ${folder.count}`} onpointerdown={e=>{pressPoint={x:e.clientX,y:e.clientY};held=false;hold=setTimeout(()=>{held=true;showContext(folder.id);},550);}} onpointermove={e=>{if(Math.hypot(e.clientX-pressPoint.x,e.clientY-pressPoint.y)>10)clearTimeout(hold);}} onpointerup={()=>clearTimeout(hold)} onpointercancel={()=>clearTimeout(hold)} onpointerleave={()=>clearTimeout(hold)} oncontextmenu={e=>{e.preventDefault();held=true;showContext(folder.id);}} onclick={()=>{if(!held)void focus(folder.id);held=false;}}>
    <i style:background={folder.color} style:color={folder.color} aria-hidden="true"></i><span>{folder.name}</span>{#if drag}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d={removeIds.includes(folder.id)?"m6 6 12 12M18 6 6 18":"M12 5v14M5 12h14"}/></svg>{:else}<small>{folder.count}</small>{/if}
   </button>
  {/each}
 </div>
 {/if}
 {#if !collapsed&&selectionIds.length>1}<button class="create-folder" disabled={busy} onclick={()=>beginCreate(selectionIds)} title="Создать папку из выделенных заметок" aria-label="Создать папку из выделения">＋</button>{/if}
 {#if dragTarget}<div class="drop-message" role="status">{dragTarget==='__remove__'?(activeId?'Убрать из текущей папки':'Убрать из всех папок'):`${removeIds.includes(dragTarget)?'Убрать из':'Добавить в'} «${folders.find(f=>f.id===dragTarget)?.name||''}»`}</div>{/if}
 {#if context}<div class="folder-actions"><input aria-label="Имя папки" bind:value={rename} maxlength="80"/><FolderColors bind:value={tint} disabled={busy}/><button disabled={busy||!rename.trim()} onclick={updateFolder}>Готово</button>{#if selectionIds.length}<button disabled={busy} onclick={()=>action()}>Добавить выделение</button>{/if}<button disabled={busy} onclick={()=>action(true)}>Удалить папку</button><button onclick={()=>context=null}>Закрыть</button><small>Заметки останутся на карте</small></div>{/if}
 {#if creating}
  <form onsubmit={create}>
   <label class="name">Название папки<input bind:this={input} bind:value={name} maxlength="80" required placeholder="Работа, музыка…" disabled={busy}/></label>
   <div class="color"><span>Цвет</span><FolderColors bind:value={color} disabled={busy}/></div>
   <span class="selection-count">Выбрано: {ids.length}</span>
   <button type="submit" disabled={busy||!name.trim()}>Создать</button>
   <button type="button" disabled={busy} onclick={()=>{creating=false;error='';}}>Отмена</button>
  </form>
 {/if}
 {#if error}<p role="alert">{error}</p>{/if}
</div>
{/if}

<style>
 .folder-strip{position:absolute;top:var(--folder-strip-top,70px);left:max(16px,env(safe-area-inset-left));z-index:4;display:flex;align-items:center;gap:6px;flex-wrap:wrap;width:max-content;max-width:calc(100% - 32px);padding:5px;border:1px solid color-mix(in srgb,var(--theme-border),transparent 35%);border-radius:18px;background:color-mix(in srgb,var(--theme-surface),transparent 18%);backdrop-filter:blur(10px);color:var(--theme-text);font:inherit}
 .folder-tabs.drag-scrolling{scroll-snap-type:none!important;scroll-behavior:auto}.folder-tabs i{box-shadow:0 0 8px currentColor;width:10px!important;height:10px!important}.folder-tabs{display:flex;gap:3px;overflow-x:auto;min-width:0;flex:1;scrollbar-width:thin}.folder-tabs button{display:flex;align-items:center;gap:8px;min-height:44px;padding:8px 13px;white-space:nowrap;background:transparent;border:1px solid transparent;border-radius:12px}.folder-tabs button.chosen{background:color-mix(in srgb,var(--theme-text),transparent 91%);border-color:color-mix(in srgb,var(--theme-border),transparent 25%)}
 .folder-tabs span{overflow:hidden;text-overflow:ellipsis;max-width:180px}.folder-tabs i{width:7px;height:7px;border-radius:50%;flex-shrink:0}.folder-tabs small{font-size:11px;opacity:.65;font-variant-numeric:tabular-nums}.create-folder{background:transparent;border-color:transparent;font-size:12px;white-space:nowrap}
 form{display:flex;align-items:end;gap:8px;flex-wrap:wrap;width:100%;padding:10px;border-top:1px solid var(--theme-border)}label{display:flex;flex-direction:column;align-items:start;gap:5px;font-size:12px}.name{flex:1;min-width:150px}.name input{width:100%}.selection-count{font-size:12px;opacity:.7;align-self:center}p{flex-basis:100%;margin:0;padding:6px 10px;font-size:12px}
 button:focus-visible,input:focus-visible{outline:2px solid var(--theme-accent);outline-offset:2px}
 @media(max-width:650px){.folder-strip{top:var(--folder-strip-top,72px);max-width:calc(100% - 20px)}.create-folder{padding-inline:8px}.folder-tabs span{max-width:110px}}
.folder-actions{flex-basis:100%;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px}.folder-actions small{width:100%;color:var(--theme-muted)}
.folder-actions input:not([type=color]){flex:1;min-width:130px;width:140px}
 .folder-strip{border:0;border-radius:999px;max-width:calc(100% - 32px);background:color-mix(in srgb,var(--theme-surface),transparent 10%);box-shadow:0 2px 14px #0001;flex-wrap:nowrap}.folder-strip:has(form),.folder-strip:has(.folder-actions){flex-wrap:wrap;border-radius:24px}.folder-strip>button{flex:none;width:44px;min-height:44px;padding:0;border:0;border-radius:50%;display:grid;place-items:center;background:transparent}.folder-tabs{border-radius:24px;scrollbar-width:none;scroll-snap-type:x mandatory;scroll-padding:4px;overscroll-behavior-x:contain}.folder-tabs::-webkit-scrollbar{display:none}.folder-tabs button{flex-shrink:0;scroll-snap-align:start;scroll-snap-stop:always;border-radius:22px;border:0}.folder-tabs button.chosen{border:0;background:color-mix(in srgb,var(--theme-text),transparent 94%)}.folder-tabs .drop-target{background:color-mix(in srgb,var(--theme-accent),transparent 70%);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--theme-accent),transparent 55%)}.folder-tabs .remove-target{color:#c99697;background:color-mix(in srgb,#c99697,transparent 91%)}.folder-tabs .remove-target.drop-target{background:color-mix(in srgb,#c99697,transparent 70%)}.drop-message{position:absolute;top:calc(100% + 8px);left:0;max-width:calc(100vw - 32px);padding:8px 12px;border-radius:18px;background:var(--theme-surface);font-size:12px;pointer-events:none}.color{display:flex;flex-direction:column;gap:4px;font-size:12px}.color>span{color:var(--theme-muted)}
</style>
