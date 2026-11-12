<script lang="ts">
 import type {SettingField} from '../plugins/api';
 import Choice from './Choice.svelte';
 let {field,value,disabled,onchange}:{field:SettingField;value:boolean|string|number;disabled:boolean;onchange:(value:boolean|string|number)=>unknown}=$props();
</script>
<label class:stack={field.type!=='boolean'}>
 <span>{field.label}{#if field.type==='range'} <output>{Number(value).toLocaleString('ru-RU')}</output>{/if}</span>
 {#if field.type==='boolean'}<input aria-label={field.label} type="checkbox" checked={Boolean(value)} {disabled} onchange={e=>onchange(e.currentTarget.checked)}/>
 {:else if field.type==='range'}<input aria-label={field.label} type="range" min={field.min} max={field.max} step={field.step} value={Number(value)} {disabled} onchange={e=>onchange(Number(e.currentTarget.value))}/>
 {:else if field.type==='select'&&['icon','searchDesktop','searchMobile','folderShortcut','model','language'].includes(field.key)}<Choice label={field.label} value={String(value)} options={field.options} {disabled} onchange={onchange}/>
 {:else if field.type==='select'}<select aria-label={field.label} value={String(value)} {disabled} onchange={e=>onchange(e.currentTarget.value)}>{#each field.options as option}<option value={option.value}>{option.label}</option>{/each}</select>
 {:else}<input aria-label={field.label} type="text" value={String(value)} maxlength="200" {disabled} onchange={e=>onchange(e.currentTarget.value)}/>{/if}
</label>
<style>label{margin-block:14px}output{color:var(--theme-muted);font-variant-numeric:tabular-nums;font-size:11px}input[type=range]{padding:0;accent-color:var(--theme-accent)}</style>
