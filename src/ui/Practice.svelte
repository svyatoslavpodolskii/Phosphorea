<script lang="ts">
 import {onDestroy,untrack} from 'svelte';
 import Map from '../graph/Map.svelte';
 import ThemeBackdrop from './ThemeBackdrop.svelte';
 import {GraphProviders} from '../graph/providers';
 import {GraphWorkerClient} from '../graph/worker-client';
 import type {GraphModel} from '../graph/model';
 import {PracticeStorage} from '../core/practice-storage';
 import {makeAtom,makeLink,type Atom,type AtomState,type Snapshot,type Mutation,type Link} from '../core/model';
 import type {Preferences} from '../core/preferences';
 import type {AtomType} from '../plugins/api';
 import {applyTheme,getAppliedTheme,THEMES} from '../core/themes';
 const loadEditor=()=>import('./Editor.svelte');
 let {prefs,types,onclose}:{prefs:Preferences;types:AtomType[];onclose:()=>void}=$props();
 const store=new PracticeStorage(),originalTheme=getAppliedTheme(),providers=new GraphProviders(),worker=new GraphWorkerClient();
 // Learning uses the built-in engine, never installed providers bound to a real vault.
 providers.clustering.set('practice',{id:'practice',name:'Practice',project:input=>worker.call<GraphModel>('cluster',input)});
 providers.reduction.set('practice',{id:'practice',name:'Practice',reduce:input=>worker.call<Link[]>('reduce',input)});
 providers.weight.set('practice',{id:'practice',name:'Practice',weigh:input=>worker.call<Record<string,number>>('weight',input)});
 providers.layout.set('practice',{id:'practice',name:'Practice',place:input=>worker.call<{x:number;y:number}>('layout',input)});
 providers.tools.set('practice-lasso',{id:'practice-lasso',name:'Лассо',kind:'lasso'});
 let data=$state.raw<Snapshot>({atoms:[],links:[]}),selected=$state(''),camera=$state({x:0,y:0,zoom:1}),editing=$state<Partial<Atom>|null>(null),step=$state(0),done=$state(false),error=$state(''),search=$state(false),query=$state(''),menu=$state(false),reveal=$state<{id:string;nonce:number}|null>(null);
 const practicePrefs=untrack(()=>({...prefs,graphModel:undefined,liveliness:0}));
 const steps=[
  {title:'Создайте свою первую мысль',text:'Зажмите пустое место и отпустите. На компьютере можно нажать N. Напишите что-нибудь и сохраните.'},
  {title:'Приблизьте и осмотритесь',text:'Прокрутите колёсико или сведите два пальца. Потяните пустое место, чтобы передвинуть карту.'},
  {title:'Соедините две мысли',text:'Зажмите атом, перенесите на другой и чуть задержитесь. Когда появится связь, отпустите.'},
  {title:'Выберите несколько сразу',text:'Зажмите пустое место и обведите оба атома. На компьютере — Shift и перетаскивание.'},
  {title:'Оставьте важное на сейчас',text:'Зажмите атом и перетащите в зону «Сейчас» снизу. Или откройте его меню долгим нажатием.'},
  {title:'Найдите свою мысль',text:'Нажмите лупу, введите часть названия и выберите результат. На основной карте поиск открывается через Ctrl / ⌘ K.'},
  {title:'Выберите настроение',text:'Попробуйте любую тему ниже. В своей карте вы сможете настроить цвета, плагины и поведение под себя.'}
 ];
 async function commit(ops:Mutation[]){await store.transaction(ops);data=await store.snapshot();}
 function create(x:number,y:number){editing={x,y};}
 async function save(draft:Partial<Atom>&{title:string},add:{to:string;relation:string}[],remove:string[]){const old=data.atoms.find(a=>a.id===draft.id),atom=old?{...old,...draft,revision:old.revision+1}:makeAtom(draft);await commit([{kind:'atom',atom,expectedRevision:old?.revision},...add.map(l=>({kind:'link' as const,link:makeLink(atom.id,l.to,l.relation)})),...remove.map(id=>({kind:'unlink' as const,id}))]);editing=null;selected=atom.id;if(step===0)done=true;return atom;}
 async function changeState(ids:string[],value:AtomState|'delete'|'pin'|'unpin'){await commit(ids.flatMap<Mutation>(id=>{const atom=data.atoms.find(a=>a.id===id);if(!atom)return[];return value==='delete'?[{kind:'delete' as const,id}]:[{kind:'atom' as const,atom:{...atom,...(value==='pin'||value==='unpin'?{pinned:value==='pin'}:{state:value}),revision:atom.revision+1},expectedRevision:atom.revision}];}));menu=false;if(step===4&&value==='now')done=true;}
 async function next(){
  if(step===steps.length-1){onclose();return;}
  step++;done=false;query='';search=false;menu=false;camera={x:0,y:0,zoom:1};
  if(step===2){const first=data.atoms[0];await commit([...(first?[{kind:'atom' as const,atom:{...first,x:-90,y:-70,revision:first.revision+1},expectedRevision:first.revision}]:[]),{kind:'atom',atom:makeAtom({title:'Следующий шаг',x:100,y:20})}]);}
  if(step===3)await commit(data.atoms.map((atom,i)=>({kind:'atom' as const,atom:{...atom,x:i?100:-90,y:i?20:-70,revision:atom.revision+1},expectedRevision:atom.revision})));

 }
 function choose(id:string){selected=id;reveal={id,nonce:Date.now()};search=false;if(step===5)done=true;}
 onDestroy(()=>{worker.close();store.close();applyTheme(originalTheme);});
</script>
<div class="practice" data-step={step}>
 <ThemeBackdrop {camera}/>
 <Map {data} {selected} lens="all" bind:camera {providers} prefs={practicePrefs} providerVersion={0} paused={Boolean(editing)} physicsEnabled={false} preservePositions onselect={id=>selected=id} onselection={ids=>{if(step===3&&ids.length>=2)done=true;}} onopen={id=>editing=data.atoms.find(a=>a.id===id)||null} oncreate={create} oncontext={id=>{selected=id;menu=true;}} onbranch={ids=>{selected=ids[0]||'';menu=true;}} onpositions={async positions=>{await commit([{kind:'positions',positions,manual:true}]);}} onstate={(id,value)=>changeState([id],value)} onstates={changeState} onlinkchange={async(before,after)=>{await commit([...(before?[{kind:'unlink' as const,id:before.id}]:[]),...(after?[{kind:'link' as const,link:after}]:[])]);if(step===2&&data.links.length)done=true;}} oncamera={()=>{if(step===1&&Math.abs(camera.zoom-1)>.08||step===1&&Math.hypot(camera.x,camera.y)>30)done=true;}} revealRequest={reveal} onerror={e=>error=e.message}/>
 <div class="practice-top"><span>Учебная карта <small>Записи здесь не сохраняются</small></span><button aria-label="Поиск в учебной карте" onclick={()=>search=!search}><svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg></button><button onclick={onclose} aria-label="Завершить обучение">×</button></div>
 {#if search}<div class="practice-search"><input aria-label="Найти учебную мысль" placeholder="Название мысли" bind:value={query}/>{#each data.atoms.filter(a=>query&&a.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())) as atom}<button onclick={()=>choose(atom.id)}>{atom.title}</button>{/each}</div>{/if}
 {#if menu}<div class="practice-menu"><button onclick={()=>changeState([selected],'now')}>Сейчас</button><button onclick={()=>editing=data.atoms.find(a=>a.id===selected)||null}>Открыть заметку</button><button onclick={()=>menu=false}>Закрыть</button></div>{/if}
 {#if !editing}<div class="practice-guide" class:top-guide={step===4} aria-live="polite"><div class="practice-progress"><span>{step+1} / {steps.length}</span><span>{done?'Получилось!':'Попробуйте сами'}</span></div><h2>{steps[step].title}</h2><p>{steps[step].text}</p>
  {#if step===6}<div class="practice-themes">{#each THEMES.slice(0,5) as theme}<button style:background={theme.colors.background} style:color={theme.colors.text} onclick={()=>{applyTheme(theme);done=true;}}>{theme.name}</button>{/each}</div>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
  <div class="practice-actions"><button onclick={next}>{step===6?'Закончить':'Пропустить шаг'}</button><button class="practice-next" disabled={!done} onclick={next}>{step===6?'К моей карте':'Дальше'}</button></div>
 </div>{/if}
 {#if editing}{#await loadEditor() then m}<m.default initial={editing} {data} {types} prefs={practicePrefs} section="" storage={store} onopen={id=>editing=data.atoms.find(a=>a.id===id)||null} onsave={save} onclose={()=>editing=null} ondelete={async id=>{await changeState([id],'delete');editing=null;}}/>{/await}{/if}
</div>
<style>
 .practice{position:absolute;inset:0;overflow:hidden;isolation:isolate;background:var(--theme-background)}.practice-top{position:absolute;left:24px;right:24px;top:max(16px,env(safe-area-inset-top));display:flex;align-items:center;gap:8px;pointer-events:none}.practice-top>span{margin-right:auto;font-size:13px}.practice-top small{display:block;font-size:10px;color:var(--theme-muted);margin-top:4px}.practice-top button{pointer-events:auto;padding:0;width:44px;font-size:22px;border-radius:50%}.practice-top svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6}
 .practice-guide{position:absolute;bottom:max(20px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:min(460px,calc(100% - 24px));padding:20px;border:1px solid var(--theme-border);border-radius:24px;background:var(--theme-surface);box-shadow:0 8px 40px #0002}.practice-progress{display:flex;justify-content:space-between;color:var(--theme-muted);font-size:11px}.practice-guide h2{font-size:22px;line-height:1.2;margin:12px 0}.practice-guide p{font-size:13px;line-height:1.55;color:var(--theme-muted);margin:0 0 16px}.practice-actions{display:flex;justify-content:space-between;gap:12px}.practice-actions button{font-size:12px;border:0;background:transparent;color:var(--theme-muted)}.practice-actions .practice-next{background:var(--theme-accent);color:var(--theme-onAccent);padding:10px 20px}.practice-themes{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}.practice-themes button{font-size:11px;padding:6px 10px}
 .practice-guide.top-guide{top:90px;bottom:auto}.practice-menu{z-index:3;top:50%!important;transform:translate(-50%,-50%)!important}.practice-search{z-index:3}
 .practice-search,.practice-menu{position:absolute;top:100px;left:50%;transform:translateX(-50%);width:min(440px,calc(100% - 32px));padding:12px;border:1px solid var(--theme-border);border-radius:20px;background:var(--theme-surface);display:grid;gap:6px}.practice-search input{width:100%}.practice-search button,.practice-menu button{text-align:left;border:0}
 @media(max-height:600px){.practice-guide{bottom:10px;padding:14px;width:min(400px,calc(100% - 24px))}.practice-guide h2{font-size:18px;margin:8px 0}.practice-guide p{font-size:12px;margin-bottom:8px}}
</style>
