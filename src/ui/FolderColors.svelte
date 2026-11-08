<script lang="ts">
 import {FOLDER_COLORS} from '../plugins/folders';
 let {value=$bindable(FOLDER_COLORS[0]),disabled=false}:{value?:string;disabled?:boolean}=$props();
 const names=['Стандартный','Синий','Лаванда','Шалфей','Песок','Пыльная роза','Туман'];
 const colors=$derived(FOLDER_COLORS.includes(value)?FOLDER_COLORS:[...FOLDER_COLORS,value]);
</script>
<div class="folder-colors" role="group" aria-label="Цвет папки">{#each colors as color,i}<button type="button" {disabled} aria-label={names[i]||'Текущий цвет'} aria-pressed={value===color} style:--swatch={color} onclick={()=>value=color}><i></i>{#if value===color}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 8 3 3 5-6"/></svg>{/if}</button>{/each}</div>
<style>
 .folder-colors{display:flex;flex-wrap:wrap;gap:2px}.folder-colors button{position:relative;display:grid;place-items:center;width:36px;height:36px;min-height:36px;padding:0;border:0;border-radius:50%;background:transparent}.folder-colors i{width:23px;height:23px;border-radius:50%;background:var(--swatch);opacity:.8}.folder-colors svg{position:absolute;width:16px;height:16px;fill:none;stroke:#17201d;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.folder-colors button[aria-pressed=true]{box-shadow:inset 0 0 0 1px var(--swatch)}
</style>
