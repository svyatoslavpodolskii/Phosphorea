<script lang="ts">
 import {previewSound,prepareSound,motionSound,stopMotionSound,type SoundCue} from './sound';
 import {onDestroy} from 'svelte';
 let timer:ReturnType<typeof setTimeout>|undefined;
 let playing=$state('');
 let revision=0;
 async function preview(cue:SoundCue|'zoom'){
  const version=++revision;clearTimeout(timer);stopMotionSound();playing=cue;
  if(cue==='zoom'){
   await prepareSound();if(version!==revision)return;
   const start=performance.now();
   const step=()=>{if(version!==revision)return;const elapsed=performance.now()-start;if(elapsed>900){stopMotionSound();playing='';return;}motionSound('zoom',Math.sin(elapsed/900*Math.PI));timer=setTimeout(step,30);};step();
  }else{await previewSound(cue);if(version===revision)timer=setTimeout(()=>playing='',650);}
 }
 onDestroy(()=>{revision++;clearTimeout(timer);stopMotionSound();});
</script>
<div class="sound-preview" data-sound="off">
 <p>Послушать</p>
 <div>{#each [{cue:'tap',label:'Касание'},{cue:'hold',label:'Волна'},{cue:'zoom',label:'Движение'}] as item}<button class:playing={playing===item.cue} onclick={()=>preview(item.cue as SoundCue|'zoom')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6Z"/></svg>{item.label}</button>{/each}</div>
 <small>Общая кнопка звука на карте отключает и прослушивание.</small>
</div>
<style>
 .sound-preview{padding:12px 0 4px}.sound-preview p{font-size:13px;opacity:.65;margin:0 0 10px}.sound-preview>div{display:flex;gap:6px;flex-wrap:wrap}.sound-preview button{display:flex;align-items:center;gap:5px;min-height:42px;padding:8px 12px;border-radius:14px;background:color-mix(in srgb,currentColor,transparent 95%);border:1px solid color-mix(in srgb,currentColor,transparent 90%);transition:background 150ms}.sound-preview button.playing{background:color-mix(in srgb,var(--theme-accent),transparent 85%)}svg{width:14px;height:14px;fill:currentColor}small{display:block;font-size:11px;opacity:.5;margin-top:10px;line-height:1.5}
</style>
