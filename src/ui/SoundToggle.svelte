<script lang="ts">
 import {onMount} from 'svelte';
 import {observeSound,soundState,setMuted,installSoundFeedback} from './sound';
 let state=$state(soundState());onMount(()=>{const off=observeSound(()=>state=soundState()),stop=installSoundFeedback();return()=>{off();stop();};});
</script>
<button class="sound-toggle" data-sound="off" aria-label={state.muted?'Включить звук':'Выключить звук'} aria-pressed={!state.muted} title={state.muted?'Звук выключен':'Звук включён'} onclick={()=>setMuted(!state.muted)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4 6 8H3v8h3l5 4Z"/>{#if state.muted}<path d="m16 9 6 6m0-6-6 6"/>{:else}<path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>{/if}</svg></button>
<style>.sound-toggle{width:40px;min-height:40px;padding:9px;border:0;background:transparent;color:var(--theme-muted);border-radius:50%}.sound-toggle svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.sound-toggle[aria-pressed=true]{color:var(--theme-text)}.sound-toggle:active{transform:scale(.93)}</style>
