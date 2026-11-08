<script lang="ts">
 import {onMount,onDestroy} from 'svelte';import {observeSave,type SaveStatus} from '../storage/status';
 let timer:ReturnType<typeof setTimeout>;onDestroy(()=>clearTimeout(timer));function toggle(){open=!open;clearTimeout(timer);if(open)timer=setTimeout(()=>open=false,2400);}
 let status=$state<SaveStatus>({pending:0}),open=$state(false),hover=$state(false);
 onMount(()=>observeSave(value=>status=value));
 const title=$derived(status.error?'Не удалось сохранить':status.pending?'Сохраняем…':'Сохранено локально');
</script>
<svelte:window onpointerdown={e=>{if(!(e.target as Element).closest('.save-status'))open=false;}} onkeydown={e=>{if(e.key==='Escape')open=false;}}/>
<div class="save-status" onpointerenter={e=>hover=e.pointerType==='mouse'} onpointerleave={()=>hover=false} role="presentation">
 <button class:error={Boolean(status.error)} aria-label={status.error?'Не удалось сохранить':'Сохранение на устройстве'} aria-expanded={open||hover} onclick={toggle}><svg viewBox="0 0 24 24" class:saving={status.pending>0} aria-hidden="true">{#if status.error}<circle cx="12" cy="12" r="8"/><path d="M12 7v6m0 3h.01"/>{:else if status.pending}<path d="M20 8a8 8 0 0 0-13-2L4 9m0-5v5h5M4 16a8 8 0 0 0 13 2l3-3m0 5v-5h-5"/>{:else}<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6ZM8 12l3 3 5-6"/>{/if}</svg></button>
 {#if open||hover}<div class="save-popover" role="status"><strong>{title}</strong><p>{status.error||'Изменения хранятся на этом устройстве.'}</p>{#if status.at}<small>Последнее сохранение: {new Date(status.at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</small>{/if}</div>{/if}
</div>
<style>button svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.saving{animation:save-turn 1.4s linear infinite}@keyframes save-turn{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.saving{animation:none}}</style>
