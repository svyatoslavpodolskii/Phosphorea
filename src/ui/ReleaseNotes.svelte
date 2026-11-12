<script lang="ts">
 import {untrack} from 'svelte';
 import {releases,releasesSince} from './releases';
 import {surface} from './surfaces';
 let {onclose,since=null,showAll=false}:{onclose:()=>void;since?:string|null;showAll?:boolean}=$props();
 let history=$state(untrack(()=>showAll)),index=$state(0);
 const received=$derived(releasesSince(since));
 const visibleReleases=$derived(history?releases:received);
</script>
<div class="scrim release-scrim" use:surface={{close:onclose}}>
 <div class="editor release-notes" role="dialog" aria-modal="true" aria-labelledby="release-title" tabindex="-1">
  <div class="release-heading"><span>НОВОЕ В PHOSPHOREA</span><button aria-label="Закрыть историю обновлений" onclick={onclose}><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
  {#if visibleReleases.length>1}<nav class="release-versions" aria-label={history?'История обновлений':'Полученные обновления'}>{#each visibleReleases as release,i}<button aria-pressed={index===i} onclick={()=>index=i}>{release.version}</button>{/each}</nav>{/if}
  {#each visibleReleases.slice(index,index+1) as release,i}
   <article class:previous={i>0}>
    <div class="release-meta"><span>{release.version}</span><time datetime={release.date}>{new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(release.date+'T00:00:00Z'))}</time></div>
    {#if i===0}<h2 id="release-title">{release.title}</h2>{:else}<h3>{release.title}</h3>{/if}
    <p class="release-intro">{release.intro}</p>
    <ul>{#each release.changes as change}<li><span class="release-dot" aria-hidden="true"></span><div><h3>{change.title}</h3><p>{change.body}</p></div></li>{/each}</ul>
   </article>
  {/each}
  {#if visibleReleases.length>1}<div class="release-paging"><button disabled={index===0} onclick={()=>index--}>Назад</button><span>{index+1} / {visibleReleases.length}</span><button disabled={index===visibleReleases.length-1} onclick={()=>index++}>Дальше</button></div>{/if}
  <div class="release-actions"><button class="release-history" onclick={()=>{history=!history;index=0;}}>{history?'Новые возможности':'Вся история обновлений'}</button><button class="release-done" onclick={onclose}>Продолжить</button></div>
 </div>
</div>
<style>
 .release-scrim{justify-content:center}.release-notes{width:min(560px,calc(100vw - 32px));gap:0;padding:28px;overflow:auto;overscroll-behavior:contain;max-height:calc(100dvh - 48px)}
 .release-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px}.release-heading>span{font-size:10px;letter-spacing:.13em;color:var(--theme-muted);font-weight:600}.release-heading button{display:grid;place-items:center;flex:none;width:40px;min-height:40px;padding:0;border:0;background:transparent;border-radius:50%}.release-heading svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6}
 .release-meta{display:flex;gap:10px;align-items:center;color:var(--theme-muted);font-size:11px}.release-meta>span{border:1px solid var(--theme-border);border-radius:20px;padding:4px 9px;color:var(--theme-text);font-variant-numeric:tabular-nums}
 .release-notes h2{font-size:30px;line-height:1.12;letter-spacing:-.8px;margin:18px 0 12px;text-wrap:balance}h3{font-size:14px;line-height:1.4;font-weight:600;margin:0 0 5px}.release-intro{font-size:14px;line-height:1.6;color:var(--theme-muted);margin:0 0 24px}ul{list-style:none;display:grid;gap:20px;padding:0;margin:0}li{display:flex;align-items:flex-start;gap:14px}.release-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--theme-accent);margin-top:7px}li p{font-size:13px;line-height:1.6;color:var(--theme-muted);margin:0;overflow-wrap:anywhere}
 .previous{margin-top:28px;padding-top:24px;border-top:1px solid var(--theme-border)}.previous>h3{font-size:21px;margin:14px 0 10px}.release-actions{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:28px}.release-history{background:transparent;border:0;padding-inline:0;font-size:12px;color:var(--theme-muted)}.release-done{background:var(--theme-accent);color:var(--theme-onAccent);border-color:transparent}
 .release-versions{display:flex;gap:6px;overflow:auto;scroll-snap-type:x mandatory;padding:0 0 16px}.release-versions button{flex:none;scroll-snap-align:start;font-size:12px;min-height:36px;padding:6px 12px;background:transparent}.release-versions button[aria-pressed=true]{background:var(--theme-accent);color:var(--theme-onAccent);border-color:transparent}.release-paging{display:flex;align-items:center;justify-content:space-between;margin-top:20px;color:var(--theme-muted);font-size:12px}.release-paging button{font-size:12px;background:transparent;border:0;padding:6px 10px}
 .release-actions{position:sticky;bottom:-28px;margin-bottom:-12px;padding-block:12px;background:var(--theme-surface);z-index:1;flex-shrink:0}
 @media(max-width:650px){.release-notes{padding:22px;max-height:calc(100dvh - 24px);width:100%}.release-notes h2{font-size:27px}.release-actions{flex-wrap:wrap}}
</style>
