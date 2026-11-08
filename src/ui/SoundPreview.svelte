<script lang="ts">
 import {previewSound,prepareSound,motionSound,stopMotionSound,observeSound,soundState,type SoundCue} from './sound';
 import type {MotionKind} from './motion-audio';
 import SoundToggle from './SoundToggle.svelte';
 import {onDestroy,onMount} from 'svelte';
 let muted=$state(soundState().muted);
 onMount(()=>observeSound(()=>muted=soundState().muted));
 let timer:ReturnType<typeof setTimeout>|undefined;
 let playing=$state('');
 let revision=0;
 async function preview(cue:SoundCue|MotionKind){
  const version=++revision;clearTimeout(timer);stopMotionSound();playing=cue;
  if(cue==='zoom'||cue==='pan'||cue==='lasso'){
   await prepareSound();if(version!==revision)return;
   const start=performance.now();
   const step=()=>{if(version!==revision)return;const elapsed=performance.now()-start;if(elapsed>1200){stopMotionSound();playing='';return;}motionSound(cue,Math.sin(elapsed/1200*Math.PI));timer=setTimeout(step,30);};step();
  }else{await previewSound(cue);if(version===revision)timer=setTimeout(()=>playing='',cue==='hold'||cue==='pulse'?1900:650);}
 }
 onDestroy(()=>{revision++;clearTimeout(timer);stopMotionSound();});
</script>
<div class="sound-preview" data-sound="off">
 <div class="preview-heading"><p>Послушать</p><SoundToggle/></div>
 <div>{#each [{cue:'tap',label:'Касание'},{cue:'detent',label:'Деление'},{cue:'hold',label:'Волна'},{cue:'pan',label:'Движение'},{cue:'zoom',label:'Зум'},{cue:'lasso',label:'Лассо'}] as item}<button disabled={muted} class:playing={playing===item.cue} onclick={()=>preview(item.cue as SoundCue|MotionKind)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6Z"/></svg>{item.label}</button>{/each}</div>
 <small>{muted?'Звук выключен. Включите его значком выше, чтобы послушать.':'Включение звука общее для карты и настроек.'}</small>
</div>
<style>
 .sound-preview{padding:12px 0 4px}.sound-preview p{font-size:13px;opacity:.65;margin:0}.sound-preview>div{display:flex;gap:6px;flex-wrap:wrap}.preview-heading{align-items:center;justify-content:space-between;margin-bottom:8px}.sound-preview button{display:flex;align-items:center;gap:5px;min-height:42px;padding:8px 12px;border-radius:14px;background:color-mix(in srgb,currentColor,transparent 95%);border:1px solid color-mix(in srgb,currentColor,transparent 90%);transition:background 150ms}.sound-preview button.playing{background:color-mix(in srgb,var(--theme-accent),transparent 85%)}svg{width:14px;height:14px;fill:currentColor}small{display:block;font-size:11px;opacity:.5;margin-top:10px;line-height:1.5}
</style>
