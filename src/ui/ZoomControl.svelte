<script lang="ts">
 import RotaryZoom from './RotaryZoom.svelte';
 import {playSound} from './sound';
 import {onMount,onDestroy} from 'svelte';
 import type {ZoomControls} from '../plugins/interface';
 let {value,percent,options,onvalue}:{value:number;percent:number;options:ZoomControls;onvalue:(value:number)=>void}=$props();
 let grabbed=$state(false),lit=$state(false),draft=$state(0),reduced=$state(false);let timer:ReturnType<typeof setTimeout>;let bucket=-1;let meter:HTMLOutputElement;
 const side=$derived(options.side);const vertical=$derived(side!=='bottom');
 function wake(){lit=true;clearTimeout(timer);timer=setTimeout(()=>{if(!grabbed)lit=false;},1000);}
 function change(next:number){draft=next;wake();const step=Math.floor(next/(10));if(step!==bucket){bucket=step;playSound('detent');if(options.feedback&&!reduced){navigator.vibrate?.(next===0||next===100?10:5);meter?.animate([{transform:'scale(.97)',opacity:.7},{transform:'scale(1)',opacity:1}],{duration:140,easing:'cubic-bezier(.23,1,.32,1)'});}}onvalue(next);}
 function release(){if(grabbed){grabbed=false;wake();}}
 onMount(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');reduced=media.matches;const update=()=>reduced=media.matches;media.addEventListener('change',update);return()=>media.removeEventListener('change',update);});onDestroy(()=>clearTimeout(timer));
</script>
<svelte:window onpointerup={release} onpointercancel={release}/>
<div class="camera-slider zoom-control" class:wheel={options.style==='wheel'} class:lit class:grabbed class:vertical class:left={side==='left'} class:right={side==='right'} class:bottom={side==='bottom'} aria-label="Управление масштабом">
 {#if options.style==='wheel'}<RotaryZoom {value} {percent} {vertical} onvalue={change}/>{:else}<div class="zoom-rail"><span class="zoom-progress" aria-hidden="true" style:transform={vertical?`scaleY(${value/100})`:`scaleX(${value/100})`}></span><div class="zoom-ticks" aria-hidden="true">{#each Array.from({length:11},(_,i)=>i) as i}<i style:left={vertical?'26%':`${i*10}%`} style:top={vertical?`${100-i*10}%`:'50%'} class:major={i===0||i===5||i===10} class:current={Math.abs(i*10-value)<3}></i>{/each}</div>
 <input aria-label="Масштаб карты" aria-valuetext={value<2?'Обзор':`${percent}%`} type="range" min="0" max="100" step="1" value={grabbed?draft:value} onpointerdown={()=>{draft=value;bucket=Math.floor(value/10);grabbed=true;wake();}} oninput={e=>change(Number(e.currentTarget.value))} onkeydown={wake} onblur={()=>{grabbed=false;wake();}}/>
 </div>{/if}<output bind:this={meter} aria-hidden="true">{percent}%</output>
</div>
<style>
 .zoom-control.wheel{padding:0;width:auto;background:color-mix(in srgb,var(--theme-surface),transparent 40%);border-color:transparent}.zoom-control.wheel:active{opacity:1}
 .zoom-control{position:absolute;z-index:4;display:flex;align-items:center;justify-content:center;border:1px solid color-mix(in srgb,var(--theme-border),transparent 55%);border-radius:28px;background:color-mix(in srgb,var(--theme-surface),transparent 28%);color:var(--theme-text);opacity:.25;transition:opacity 180ms var(--ease),border-color 180ms ease;touch-action:none}
 .zoom-control.lit,.zoom-control.grabbed,.zoom-control:has(input:focus-visible),.zoom-control:has(:global(.rotary.held)),.zoom-control:has(:global(.rotary:focus-visible)){opacity:1;border-color:var(--theme-border)}
 .vertical{top:50%;transform:translateY(-50%);padding:10px 0;width:44px}.left{left:max(8px,env(safe-area-inset-left))}.right{right:max(8px,env(safe-area-inset-right))}.bottom{bottom:calc(110px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);padding:0 12px}
 .zoom-rail{position:relative;display:flex;align-items:center;justify-content:center;width:134px;height:44px}.vertical .zoom-rail{width:44px;height:144px}
 .zoom-progress{position:absolute;z-index:2;pointer-events:none;width:100%;height:3px;border-radius:3px;background:var(--theme-accent);transform-origin:left center;opacity:.7}.vertical .zoom-progress{height:100%;width:3px;transform-origin:center bottom}
 input{position:relative;z-index:1;width:134px;min-height:44px;padding:0;margin:0;appearance:none;background:transparent;border:0;border-radius:999px;box-shadow:none;outline:none;cursor:grab;touch-action:none}.vertical input{writing-mode:vertical-lr;direction:rtl;width:44px;height:144px;min-height:0}input:active{cursor:grabbing}input:focus{outline:none;box-shadow:none}
 input::-webkit-slider-runnable-track{background:var(--theme-border);border-radius:4px;height:3px;width:100%}input::-moz-range-track{background:var(--theme-border);border-radius:4px;height:3px;width:100%}
 .vertical input::-webkit-slider-runnable-track{height:100%;width:3px}.vertical input::-moz-range-track{height:100%;width:3px}
 input::-webkit-slider-thumb{appearance:none;width:16px;height:16px;border:2px solid var(--theme-surface);border-radius:50%;background:var(--theme-accent);margin-top:-6px;transition:transform 140ms var(--ease)}input::-moz-range-thumb{width:14px;height:14px;border:2px solid var(--theme-surface);border-radius:50%;background:var(--theme-accent);transition:transform 140ms var(--ease)}
 .vertical input::-webkit-slider-thumb{margin-top:0;margin-left:-6px}input:active::-webkit-slider-thumb{transform:scale(1.18)}input:active::-moz-range-thumb{transform:scale(1.18)}
 .zoom-ticks{position:absolute;inset:8px 0;pointer-events:none;opacity:.9}.vertical .zoom-ticks{inset:0 9px}.zoom-ticks i{position:absolute;width:1px;height:4px;background:var(--theme-text);transform:translate(-50%,-50%)}.vertical .zoom-ticks i{width:5px;height:1px}.zoom-ticks i.major{opacity:.85}.zoom-ticks i:not(.major){opacity:.6}
 .zoom-ticks i.current{background:var(--theme-accent);opacity:1;transform:translate(-50%,-50%) scale(1.5)}
 output{position:absolute;pointer-events:none;opacity:0;font-size:10px;font-variant-numeric:tabular-nums;padding:5px 8px;border:1px solid var(--theme-border);border-radius:12px;background:var(--theme-surface);transition:opacity 140ms var(--ease);white-space:nowrap}.right output{right:50px}.left output{left:50px}.bottom output{bottom:52px}.lit output,.grabbed output{opacity:1}
 @media(hover:hover) and (pointer:fine){.zoom-control:hover{opacity:1}.zoom-control:hover output{opacity:1}}@media(prefers-reduced-motion:reduce){.zoom-control,input,output{transition:none}input:active::-webkit-slider-thumb,input:active::-moz-range-thumb{transform:none}}
</style>
