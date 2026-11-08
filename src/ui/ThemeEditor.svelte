<script lang="ts">
 import {onDestroy} from 'svelte';
 import {createTheme,currentTheme,applyTheme,patternImage,grainImage,type Theme,type Pattern} from '../core/themes';
 import type {Core} from '../core/core';
 let {core,initial,onclose}:{core:Core;initial:Theme;onclose:()=>void}=$props();
 const seed=(()=>structuredClone(initial))();let name=$state(seed.name);let base=$state({...seed.base});let effects=$state({...seed.effects,mode:seed.effects.mode??'static'});let busy=$state(false);let error=$state('');
 const draft=$derived(createTheme(seed.id,name,base,effects));
 $effect(()=>applyTheme(draft));
 onDestroy(()=>applyTheme(currentTheme(core.prefs.theme,core.prefs.customThemes)));
 async function save(){busy=true;error='';try{if(!name.trim())throw Error('Назовите тему.');const theme=createTheme(seed.id.startsWith('custom-')?seed.id:'custom-'+crypto.randomUUID(),name.trim(),$state.snapshot(base),$state.snapshot(effects));const customThemes=[...core.prefs.customThemes.filter(t=>t.id!==theme.id),theme];if(customThemes.length>30)throw Error('Можно сохранить до 30 тем.');await core.setPreferences({...core.prefs,theme:theme.id,customThemes});onclose();}catch(e){error=(e as Error).message;}finally{busy=false;}}
</script>
<form class="theme-designer" aria-label="Редактор темы" onsubmit={e=>{e.preventDefault();save();}}>
 <div class="row"><h3>Ваша тема</h3><button type="button" class="icon-button" aria-label="Отменить редактирование темы" disabled={busy} onclick={onclose}>×</button></div>
 <div class="theme-live-preview" style:background-color={draft.colors.background} style:background-image={`${grainImage(effects.grain)}, ${patternImage(draft)}`}><div style:background={draft.colors.surface} style:color={draft.colors.text}><strong>Место для ваших мыслей</strong><p style:color={draft.colors.muted}>Текст и детали остаются читаемыми.</p><span style:background={draft.colors.accent} style:color={draft.colors.onAccent}>Сейчас</span><small style:color={draft.colors.muted}>{draft.dark?'Тёмная':'Светлая'} палитра · автоматический контраст</small></div></div>
 <label class="stack">Название<input aria-label="Название темы" bind:value={name} maxlength="60" required/></label>
 <div class="theme-base-colors">{#each [{key:'background',label:'Фон'},{key:'accent',label:'Акцент'},{key:'tint',label:'Оттенок'}] as item}<label><input type="color" aria-label={`Цвет темы: ${item.label}`} bind:value={base[item.key as keyof typeof base]}/><span>{item.label}</span></label>{/each}</div>
 <p class="theme-help">Три цвета задают всю палитру. Поверхности, текст и границы подстраиваются автоматически.</p>
 <label class="stack">Рисунок фона<select aria-label="Рисунок фона" bind:value={effects.pattern}>{#each [['none','Без рисунка'],['daisies','Ромашки'],['stars','Сказочные звёзды'],['night-sky','Ночное небо'],['fireflies','Светлячки']] as [value,label]}<option value={value as Pattern}>{label}</option>{/each}</select></label>
 {#if effects.pattern!=='none'}<label class="stack">Количество<input aria-label="Количество фигур" type="range" min="0" max="1" step="0.05" bind:value={effects.density}/></label><label class="stack">Выразительность<input aria-label="Выразительность фона" type="range" min="0" max="1" step="0.05" bind:value={effects.strength}/></label>{/if}
 <label class="stack">Движение фона<select aria-label="Движение фона" bind:value={effects.mode}><option value="static">Неподвижный</option><option value="world">Вместе с картой</option><option value="parallax">Глубина</option></select></label>
 <p class="theme-help">Неподвижный фон, движение вместе с картой или мягкая глубина в три слоя. При уменьшении движения фон остаётся неподвижным.</p>
 <label class="stack">Зернистость · {Math.round(effects.grain*100)}%<input aria-label="Зернистость" type="range" min="0" max="1" step="0.05" bind:value={effects.grain}/></label>
 {#if error}<p role="alert" class="inline-error">{error}</p>{/if}
 <div class="button-wrap"><button class="primary" type="submit" disabled={busy}>Сохранить тему</button><button type="button" disabled={busy} onclick={onclose}>Отмена</button></div>
</form>
