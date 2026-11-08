<script lang="ts">
 import {onMount,tick} from 'svelte';
 import {surface} from './surfaces';
 let {onclose}:{onclose:()=>void}=$props();
 let step=$state(-1),rect=$state({x:0,y:0,width:0,height:0}),height=$state(800);
 const steps=[
  {title:'Начните с мысли',text:'Зажмите пустое место, затем отпустите палец — откроется новая заметка. Тап по атому выбирает его; по тексту заметки можно сразу писать.',target:'canvas.map'},
  {title:'Пространство под пальцами',text:'Ведите одним пальцем, чтобы двигать карту. Сведите два — для масштаба. Двойной тап приближает, а на максимуме возвращает обзор. Крутилка управляет зумом одной рукой.',target:'.zoom-control .rotary,.zoom-control input'},
  {title:'Двигайте и связывайте',text:'Зажмите атом и потяните. Наложите его на другой — появится предложение связи. Повторное наложение убирает связь. Соседние атомы откликаются на движение.',target:'canvas.map'},
  {title:'Выбирайте вместе',text:'Зажмите пустое место и, не отпуская палец, обведите атомы. На компьютере — Shift и перетаскивание. Выделенные можно двигать вместе и объединить в папку через обычное меню. Папка приближает свою область карты.',target:'.folder-strip'},
  {title:'Сейчас, архив и закрепление',text:'Зажмите атом и тяните к появившимся зонам: «Сейчас», «Обычные», «Архив», закрепление или удаление. Это работает и с выделенной группой. Удаление можно отменить.',target:'footer nav'},
  {title:'Находите нужное',text:'Поиск находит текст заметок. Выберите результат, чтобы открыть его, или покажите совпадения на карте. В канбане удобно разбирать задачи из заметок.',target:'.search'},
  {title:'Продолжайте на другом устройстве',text:'Это необязательно. Откройте «Устройства» на двух экранах: покажите QR на любом из них и сканируйте другим. Сравните шесть эмодзи и подтвердите с двух сторон. Если заметку независимо изменили, обе версии сохранятся до вашего выбора.',target:'[aria-label="Устройства и синхронизация"]'},
  {title:'Сделайте карту своей',text:'В меню → Настройки есть темы и плагины: физика, папки, зум, звук и многое другое. В «Данные и копии» сохраните полную резервную копию. Заметки хранятся на вашем устройстве.',target:'[aria-label="Меню карты"]'}
 ];
 async function locate(){await tick();height=innerHeight;const selector=steps[step]?.target;if(!selector)return;const el=document.querySelector(selector)||document.querySelector('canvas.map');const b=el?.getBoundingClientRect();if(!b)return;
  // A map gesture is illustrated in the center instead of framing the whole screen.
  rect=el?.matches('canvas.map')?{x:innerWidth*.2,y:height*.25,width:innerWidth*.6,height:height*.24}:{x:b.x-6,y:b.y-6,width:b.width+12,height:b.height+12};
 }
 function next(value:number){step=value;void locate();}
 onMount(()=>{window.addEventListener('resize',locate);return()=>window.removeEventListener('resize',locate);});
</script>
<div class="tour-layer" use:surface={{close:onclose}}>
 {#if step>=0}<div class="tour-spot" aria-hidden="true" style:left={`${rect.x}px`} style:top={`${rect.y}px`} style:width={`${rect.width}px`} style:height={`${rect.height}px`}></div>{/if}
 <div class="tour-card" class:top={step>=0&&rect.y>height*.58} role="dialog" aria-modal="true" aria-label={step<0?'Знакомство с Phosphorea':'Тур по карте'} tabindex="-1">
  <small>{step<0?'ВАШЕ ПРОСТРАНСТВО':`${step+1} / ${steps.length}`}</small>
  <h2>{step<0?'Осмотримся?':steps[step].title}</h2>
  <p>{step<0?'Короткий тур покажет основные жесты, папки, поиск и оформление. Около минуты — без изменений вашей карты.':steps[step].text}</p>
  <div class="tour-actions"><button onclick={step>0?()=>next(step-1):onclose}>{step>0?'Назад':'Не сейчас'}</button><button class="tour-next" onclick={()=>step===steps.length-1?onclose():next(step+1)}>{step<0?'Начать тур':step===steps.length-1?'Готово':'Дальше'}<span aria-hidden="true"> →</span></button></div>
  {#if step>=0}<button class="tour-skip" onclick={onclose}>Закончить тур</button>{:else}<span class="tour-hint">Можно повторить в настройках</span>{/if}
 </div>
</div>
<style>
 .tour-layer{position:fixed;inset:0;z-index:120;isolation:isolate;background:color-mix(in srgb,var(--theme-background),transparent 28%)}
 .tour-layer:has(.tour-spot){background:transparent}.tour-spot{position:fixed;border-radius:24px;box-shadow:0 0 0 150vmax color-mix(in srgb,var(--theme-background),transparent 24%);border:1px solid color-mix(in srgb,var(--theme-text),transparent 55%);pointer-events:none}
 .tour-card{position:absolute;bottom:max(24px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:min(400px,calc(100% - 32px));padding:24px;border:1px solid var(--theme-border);border-radius:26px;background:var(--theme-surface);box-shadow:0 12px 50px #0002}
 .tour-card.top{top:max(80px,calc(env(safe-area-inset-top) + 64px));bottom:auto}.tour-card small{font-size:10px;letter-spacing:.12em;color:var(--theme-muted)}h2{font-size:25px;line-height:1.15;font-weight:550;letter-spacing:-.6px;margin:14px 0}p{font-size:14px;line-height:1.6;margin:0 0 22px;color:var(--theme-muted)}.tour-actions{display:flex;justify-content:space-between;gap:12px}.tour-actions button{flex:1;border:0;background:var(--theme-surfaceAlt)}.tour-actions .tour-next{background:var(--theme-text);color:var(--theme-surface)}.tour-skip{display:block;margin:12px auto -8px;background:transparent;border:0;font-size:12px;color:var(--theme-muted)}.tour-hint{display:block;text-align:center;margin-top:16px;font-size:11px;color:var(--theme-muted)}
 @media(max-height:550px){.tour-card{padding:16px;bottom:10px;max-height:85dvh;overflow:auto}.tour-card.top{top:10px}h2{font-size:21px;margin:8px 0}p{margin-bottom:12px}}
</style>
