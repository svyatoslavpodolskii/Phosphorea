<script lang="ts">
 import {playSound} from './sound';
 function pulse(event:AnimationEvent){if(event.animationName.endsWith('hold-pulse'))playSound('pulse');}
 let {point,reduced=false}:{point:{x:number;y:number;id:number;held:boolean}|null;reduced?:boolean}=$props();
</script>
{#if point}
 {#key point.id}
 <div class="touch-feedback" class:held={point.held} class:reduced style:left={`${point.x}px`} style:top={`${point.y}px`} aria-hidden="true"><i class="contact"></i><i class="wave burst"></i><i class="wave first" onanimationiteration={pulse}></i><i class="wave second" onanimationstart={pulse} onanimationiteration={pulse}></i><i class="progress"></i></div>
 {/key}
{/if}
<style>
 .touch-feedback{position:absolute;z-index:5;pointer-events:none;width:0;height:0;color:var(--theme-accent)}
 i{position:absolute;display:block;border-radius:50%;pointer-events:none}.contact{left:-24px;top:-24px;width:48px;height:48px;background:radial-gradient(circle,color-mix(in srgb,currentColor,transparent 88%),transparent 72%);animation:contact-in 180ms var(--ease) both}.progress{visibility:hidden;left:-17px;top:-17px;width:34px;height:34px;border:1px solid currentColor;animation:hold-in 550ms var(--ease) both}.wave{left:-18px;top:-18px;width:36px;height:36px;border:1px solid currentColor;opacity:0;animation:tap-out 480ms var(--ease) both}.held .wave{animation:wave-out 1200ms ease-out infinite}.held .second{animation-delay:600ms}.second{display:none}.held .second{display:block}.held .progress{visibility:visible;opacity:.35;transform:scale(1)}
 @keyframes tap-out{from{opacity:.10;transform:scale(.65)}to{opacity:0;transform:scale(1.8)}}@keyframes contact-in{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}@keyframes hold-in{from{opacity:0;transform:scale(.65)}to{opacity:.35;transform:scale(1)}}@keyframes wave-out{from{opacity:.28;transform:scale(.65)}to{opacity:0;transform:scale(2.6)}}
 .reduced i{animation:none!important}.reduced .wave{display:none}.reduced .progress{opacity:.4}@media(prefers-reduced-motion:reduce){i{animation:none!important}.wave{display:none}.progress{opacity:.4}}
 .burst{display:none}.held .burst{display:block;left:-48px;top:-48px;width:96px;height:96px;animation:hold-burst 2000ms cubic-bezier(.35,0,.25,1) both}
 .held .wave:not(.burst){left:-40px;top:-40px;width:80px;height:80px;animation:hold-pulse 3000ms cubic-bezier(.35,0,.25,1) infinite}.held .wave.second{animation-delay:1500ms}
 .held .progress{left:-32px;top:-32px;width:64px;height:64px;opacity:.24}
 .held .contact{left:-44px;top:-44px;width:88px;height:88px}
 @keyframes hold-burst{from{opacity:.28;transform:scale(1.15)}to{opacity:0;transform:scale(3.2)}}
 @keyframes hold-pulse{from{opacity:.23;transform:scale(1.05)}to{opacity:0;transform:scale(2.9)}}
 .held .wave{box-shadow:0 0 12px color-mix(in srgb,currentColor,transparent 65%),inset 0 0 7px color-mix(in srgb,currentColor,transparent 80%);border-color:color-mix(in srgb,currentColor,white 20%)}
 .held.reduced .wave{display:none}@media(prefers-reduced-motion:reduce){.held .wave{display:none}}
</style>
