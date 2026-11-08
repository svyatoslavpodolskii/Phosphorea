<script lang="ts">
 import {onMount,tick} from 'svelte';
 let {label,value,options,onchange,disabled=false}:{label:string;value:string;options:{value:string;label:string}[];onchange:(value:string)=>unknown;disabled?:boolean}=$props();
 let open=$state(false),root:HTMLDivElement,trigger:HTMLButtonElement;
 const id=$props.id();
 async function show(){open=!open;if(open){await tick();root.querySelector<HTMLElement>('[aria-selected=true]')?.focus();}}
 function choose(v:string){onchange(v);open=false;trigger.focus();}
 function keys(e:KeyboardEvent){if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();open=false;trigger.focus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();if(!open){void show();return;}const items=[...root.querySelectorAll<HTMLElement>('[role=option]')],i=items.indexOf(document.activeElement as HTMLElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowUp'?-1:1)+items.length)%items.length]?.focus();}}
 onMount(()=>{const outside=(e:PointerEvent)=>{if(!root.contains(e.target as Node))open=false;};document.addEventListener('pointerdown',outside,true);return()=>document.removeEventListener('pointerdown',outside,true);});
</script>
<div class="choice" bind:this={root} onfocusout={e=>{if(!root.contains(e.relatedTarget as Node))open=false;}} data-escape-local={open||undefined} role="group" aria-label={label}>
 <button bind:this={trigger} onkeydown={keys} type="button" role="combobox" aria-label={label} aria-haspopup="listbox" aria-controls={id} aria-expanded={open} {disabled} onclick={show}><span>{options.find(o=>o.value===value)?.label||value}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg></button>
 {#if open}<div class="choices" id={id} role="listbox" aria-label={label}>{#each options as option}<button type="button" role="option" onkeydown={keys} aria-selected={option.value===value} onclick={()=>choose(option.value)}><span>{option.label}</span>{#if option.value===value}<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8"/></svg>{/if}</button>{/each}</div>{/if}
</div>
<style>
 .choice{position:relative;min-width:0}.choice>button{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:40px;padding:7px 10px;border:1px solid var(--theme-border);border-radius:12px;background:var(--theme-surfaceAlt);color:var(--theme-text);font-size:13px}.choice>button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;flex:none}.choices{position:absolute;top:calc(100% + 6px);left:0;z-index:30;width:max-content;min-width:100%;max-width:min(280px,80vw);max-height:260px;overflow:auto;padding:5px;border-radius:16px;border:1px solid var(--theme-border);background:var(--theme-surface);box-shadow:0 12px 35px #0003;overscroll-behavior:contain}.choices button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;padding:9px 11px;min-height:42px;border:0;border-radius:11px;background:transparent;text-align:left;font-size:13px}.choices button[aria-selected=true]{background:color-mix(in srgb,var(--theme-accent),transparent 88%)}.choices button:focus-visible{outline:2px solid var(--theme-accent);outline-offset:-2px}
</style>
