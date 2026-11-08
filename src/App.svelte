<script lang="ts">
  import {animationsPlugin} from './plugins/animations';
  import SoundToggle from './ui/SoundToggle.svelte';
  import {soundPlugin} from './ui/sound';
  import {appUpdates,type UpdateStatus} from './ui/app-updates';
  import LoadingSurface from './ui/LoadingSurface.svelte';
  import {editorCheckpoint,EDITOR_CHECKPOINT,type EditorCheckpoint} from './core/editor-checkpoint';
  import {behaviorPlugin,appearancePlugin} from './plugins/behavior';
  import {mapTools} from './plugins/map-tools';
  import {surface,surfaceOwnsHistory,surfacesClosed} from './ui/surfaces';
  import {onMount,flushSync,tick} from 'svelte';
  import {fitCamera} from './graph/navigation';
  import {MIN_ZOOM,MAX_ZOOM} from './graph/model';
  import {validLocation,revealCamera,type SpatialLocation} from './graph/navigation';
  import {IntentMachine} from './graph/intent';
  import {excerpt} from './core/search';
  import {Core} from './core/core';
  import {SQLiteAdapter} from './storage/adapter';
  const loadBoard=()=>import('./ui/TaskBoard.svelte');
  import Map from './graph/Map.svelte';
  import {interfacePlugins,type ZoomControls,type BoardControls} from './plugins/interface';
  const loadEditor=()=>import('./ui/Editor.svelte');
  const loadSettings=()=>import('./ui/Settings.svelte');
  import ContextMenu from './ui/ContextMenu.svelte';
  const loadWorkspaces=()=>import('./ui/Workspaces.svelte');
  import BranchMenu from './ui/BranchMenu.svelte';
  import SaveStatus from './ui/SaveStatus.svelte';
  import ThemeBackdrop from './ui/ThemeBackdrop.svelte';
  import FolderStrip from './ui/FolderStrip.svelte';
  import FolderTerritories from './ui/FolderTerritories.svelte';
  import {createFoldersPlugin} from './plugins/folders';
  import {FOLDER_MEMBERSHIP,folderTerritories,type FolderProjection,type FolderFocus} from './graph/folders';
  import {graphBuiltin} from './plugins/graph-builtin';
  import {preferences} from './core/preferences';
  import {applyTheme,currentTheme} from './core/themes';
  import {PluginRuntime} from './plugins/runtime';
  import {templates} from './plugins/builtins';
  import {obsidian} from './plugins/obsidian';
  import {migrateObsidianBindings} from './plugins/obsidian-storage';
  import {dynamicsPlugins} from './plugins/dynamics';
  import {daily} from './plugins/daily';
  import {initializePluginDefaults} from './plugins/defaults';
  import {communityPlugin} from './plugins/sandbox';
  import type {Manifest,Command} from './plugins/api';
  import type {Atom,AtomState,Snapshot} from './core/model';
  import PluginView from './ui/PluginView.svelte';
  import type {PluginView as ViewDefinition} from './plugins/api';
  let recovery=$state<EditorCheckpoint|undefined>();let editorRef=$state<{checkpoint:()=>Promise<void>}>();
  let updateStatus=$state<UpdateStatus>({available:false,checking:false,message:''});let updates:ReturnType<typeof appUpdates>|undefined;
  async function checkUpdate(){await updates?.check();notify(updateStatus.message);}
  async function applyUpdate(){try{await editorRef?.checkpoint();await core.storage.transaction([]);await updates?.apply();}catch(e){error=(e as Error).message;}}
  let editorReturn:SpatialLocation|null=null;let view=$state({width:0,height:0});let revealRequest=$state<{id:string;nonce:number;point?:{x:number;y:number};zoom?:number}|null>(null);let revealNonce=0;
  const navigationKey='phosphored:'+location.pathname+location.search;
  function locationState():SpatialLocation{return{camera:$state.snapshot(camera),selected,lens};}
  function remember(){if(ready)history.replaceState({...history.state,[navigationKey]:locationState()},'');}
  // Hover, selected, focused and opened are separate states. Only a user action
  // selects; neither pointer motion nor camera movement can promote itself.
  const intent=new IntentMachine(()=>{if(intent.value.selected!==selected)selected=intent.value.selected;});
 let branch=$state<string[]>([]);let workspaces=$state(false);let workspaceName=$state('Основное');
  const behavior=behaviorPlugin(()=>core?.prefs||preferences(),async patch=>{await core.setPreferences({...core.prefs,...patch});});
  let prefs=$state(preferences());let contextIds=$state<string[]>([]);let contextId=$state('');let editorSection=$state('');
  let board=$state(false);let fieldInteracting=$state(false);let connectRequest=$state<{id:string;nonce:number}|null>(null);let connectNonce=0;
  async function changeView(value:boolean){if(value&&!boardOptions)return;notice='';board=value;try{await core.storage.transaction([{kind:'setting',key:'workspace-view',value:value?'kanban':'field'}]);}catch(e){error=(e as Error).message;}}
  let core:Core=$state()!;let runtime:PluginRuntime=$state()!;let data:Snapshot=$state({atoms:[],links:[]});let camera=$state({x:0,y:0,zoom:1});let ready=$state(false);let fatal=$state(false);let error=$state('');let notice=$state('');let editing:Partial<Atom>|null=$state(null);let parent:string|undefined=$state();let selected=$state('');let query=$state('');let lens=$state('all');let persistent=$state(false);let settings=$state(false);let menu=$state(false);let registry=$state(0);let installEvent:any=$state(null);let offlineReady=$state(false);let activeView=$state<ViewDefinition|null>(null);let searchInput:HTMLInputElement;let searchButton:HTMLButtonElement;let searchViewportHeight=$state(0);let searchOpen=$state(false);let searchIndex=$state(0);
  $effect(()=>{if(ready){registry;applyTheme(currentTheme(runtime?.active.has('builtin.appearance')?prefs.theme:'phosphor',prefs.customThemes));};});
  const states:Record<AtomState,string>={normal:'Обычные',now:'Сейчас',paused:'Пауза',archived:'Архив'};
  const results=$derived.by(()=>{data;return ready&&query?core.search(query):[];});
  const typeList=$derived.by(()=>{registry;return runtime?[...runtime.types.values()]:[];});
  const contextActions=$derived.by(()=>{registry;return runtime?[...runtime.actions.values()].filter(action=>!['builtin.templates:complete','builtin.folders:create'].includes(action.id)):[];});
  const current=$derived(data.atoms.find(a=>a.id===selected));
  let folderProjection=$state.raw<FolderProjection|null>(null),activeFolder=$state<string|null>(null),mapSelection=$state<string[]>([]);
  let folderDrag=$state<{ids:string[];target:string|null}|null>(null);
  const folderDragRemovals=$derived.by(()=>{const drag=folderDrag;if(!drag)return [];return(folderProjection?.folders||[]).filter(f=>drag.ids.length>0&&drag.ids.every(id=>(folderProjection?.memberships.get(id)?.[f.id]||0)>0)).map(f=>f.id);});
  const contextFolders=$derived((folderProjection?.folders||[]).map(folder=>{const count=contextIds.filter(id=>(folderProjection?.memberships.get(id)?.[folder.id]||0)>0).length;return{id:folder.id,name:folder.name,color:folder.color,selected:count===contextIds.length&&count>0,mixed:count>0&&count<contextIds.length};}));
  async function dropIntoFolder(id:string,ids:string[]){if(id!=='__remove__'){if(ids.length&&ids.every(atomId=>(folderProjection?.memberships.get(atomId)?.[id]||0)>0)){await folders.controller.removeMembers(id,ids);notify('Заметки убраны из папки');return;}await folders.controller.add(id,ids);notify('Добавлено в папку');return;}const targets=activeFolder?[activeFolder]:(folderProjection?.folders||[]).filter(f=>ids.some(id=>(folderProjection?.memberships.get(id)?.[f.id]||0)>0)).map(f=>f.id);for(const target of targets)await folders.controller.removeMembers(target,ids);notify('Заметки убраны из папки');}
  let folderStrip=$state<FolderStrip>();
  const folderSelection=$derived(mapSelection.length?mapSelection:contextId&&contextIds.length?contextIds:selected?[selected]:[]);
  const territories=$derived(folderProjection?folderTerritories(folderProjection,data.atoms):[]);
  function frameFolder(target:FolderFocus){lens='all';const fitted=fitCamera(target.bounds,view);revealRequest={id:'',point:{x:-fitted.x/fitted.zoom,y:-fitted.y/fitted.zoom},zoom:fitted.zoom,nonce:++revealNonce};activeFolder=target.folderId;}

  let zoomOptions=$state<ZoomControls|null>(null),boardOptions=$state<BoardControls|null>(null);
  const controls=interfacePlugins(value=>zoomOptions=value,value=>{boardOptions=value;if(!value&&board)void changeView(false);});
  const folders=createFoldersPlugin({getSelection:()=>folderSelection,requestCreate:ids=>{contextId='';menu=false;void tick().then(()=>folderStrip?.beginCreate(ids));},changed:projection=>{folderProjection=projection;if(!projection)activeFolder=null;},focus:frameFolder});
  let undoAvailable=$state(false),restoring=$state(false),noticeBusy=$state(false);let noticeAction=$state<null|{label:string;run:()=>Promise<void>}>(null);
  let noticeTimer:ReturnType<typeof setTimeout>;
  function notify(text:string,action:null|{label:string;run:()=>Promise<void>}=null){notice=text;noticeAction=action;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{notice='';noticeAction=null;},action?3000:1800);}
  async function undoDelete(){restoring=true;try{const ids=await core.undoDeletion();await tick();undoAvailable=false;if(ids.length){intent.select(ids[0]);const atom=core.data.atoms.find(a=>a.id===ids[0]);lens=atom?.state==='archived'?'archived':lens==='now'&&atom?.state==='now'?'now':'all';revealRequest={id:ids[0],nonce:++revealNonce};notify('\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u043e\u0442\u043c\u0435\u043d\u0435\u043d\u043e');}}finally{restoring=false;}}
  function deleted(count:number){undoAvailable=true;notify(count>1?`\u0423\u0434\u0430\u043b\u0435\u043d\u043e \u0430\u0442\u043e\u043c\u043e\u0432: ${count}`:'\u041c\u044b\u0441\u043b\u044c \u0443\u0434\u0430\u043b\u0435\u043d\u0430',{label:'\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c',run:undoDelete});}
  async function actNotice(){if(!noticeAction||noticeBusy)return;noticeBusy=true;try{await noticeAction.run();}catch(e){error=(e as Error).message;}finally{noticeBusy=false;}}
  async function persist(){try{persistent=await navigator.storage.persisted();if(!persistent){await navigator.storage.persist();persistent=await navigator.storage.persisted();}if(!persistent&&!await core.storage.getSetting('persistence-notified')){notify('Браузер не предоставил защиту от автоматической очистки. Подробности — в настройках хранилища.');await core.storage.transaction([{kind:'setting',key:'persistence-notified',value:true}]);}}catch{notify('Защита хранилища недоступна. Резервную копию можно скачать в настройках.');}}
  function expandSearch(){searchIndex=0;flushSync(()=>searchOpen=true);searchInput.focus();}
  function searchKeys(e:KeyboardEvent){
   if(e.isComposing)return;
   if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)&&results.length){e.preventDefault();searchIndex=e.key==='Home'?0:e.key==='End'?results.length-1:(Math.min(searchIndex,results.length-1)+(e.key==='ArrowDown'?1:-1)+results.length)%results.length;queueMicrotask(()=>document.getElementById(`search-result-${searchIndex}`)?.scrollIntoView({block:'nearest'}));}
   if(e.key==='Enter'&&!results.length&&query.trim()){e.preventDefault();createFromSearch();return;}
   if(e.key==='Enter'&&results.length){e.preventDefault();const id=results[Math.min(searchIndex,results.length-1)].id;if(e.shiftKey)focus(id);else chooseSearch(id);}
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();collapseSearch(true);}
  }
  function chooseSearch(id:string){query='';searchOpen=false;menu=false;open(id);}
  function typeName(type:string){return typeList.find(t=>t.id===type||t.id.split(':').at(-1)===type)?.name||type;}
  function createFromSearch(){const title=query.trim().slice(0,500);collapseSearch();intent.select('');create(-camera.x/camera.zoom,-camera.y/camera.zoom,title);}
  function collapseSearch(restore=false){searchOpen=false;query='';if(restore)searchButton.focus();}
  function saveCamera(){remember();if(ready)core.storage.transaction([{kind:'setting',key:'map',value:{camera:$state.snapshot(camera),lens,selected}}]).catch(e=>error=e.message);}
  // Restoring a place is a jump, not a journey: the user asked to go back, not to fly there.
  function travel(target:SpatialLocation){selected=data.atoms.some(a=>a.id===target.selected)?target.selected:'';lens=target.lens;camera={...target.camera};intent.select(selected);saveCamera();}
  function focus(id:string){const a=data.atoms.find(a=>a.id===id);if(!a)return;if(board)void changeView(false);remember();
   // Selection follows the search result. The camera only helps when the target is
   // off screen or too small to read; otherwise the view is left exactly as it is,
   // and any correction it does make is animated rather than a jump.
   if(revealCamera(camera,{x:a.x,y:a.y},view,commandBusy?camera.zoom:1))revealRequest={id,zoom:commandBusy?camera.zoom:1,nonce:++revealNonce};
   lens=a.state==='archived'?'archived':'all';
   history.pushState({...history.state,[navigationKey]:{camera:$state.snapshot(camera),selected:id,lens}},'');
   query='';searchOpen=false;menu=false;contextId='';intent.select(id);saveCamera();queueMicrotask(()=>document.querySelector<HTMLCanvasElement>('canvas.map')?.focus({preventScroll:true}));}

  onMount(()=>{updates=appUpdates(value=>updateStatus=value);core=new Core(new SQLiteAdapter());runtime=new PluginRuntime(core,{focus,notify,changed:()=>registry++});const unsub=core.subscribe(()=>{const previous=data;data=core.data;prefs=core.prefs;const changed=data.atoms.length!==previous.atoms.length||data.atoms.some((a,i)=>a.id!==previous.atoms[i]?.id||a.revision!==previous.atoms[i]?.revision);if(changed&&runtime?.active.has('builtin.folders'))void folders.controller.refresh().catch(e=>error=e.message);});core.placementProvider=input=>runtime.providers.active(runtime.providers.layout).place(input);
  core.init().then(async()=>{await core.rollTasks();board=await core.storage.getSetting('workspace-view')==='kanban';await runtime.enable(graphBuiltin);await migrateObsidianBindings(core.storage);await runtime.enable(obsidian);const saved=await core.storage.getSetting<any>('map');if(saved&&[saved.camera?.x,saved.camera?.y,saved.camera?.zoom].every(Number.isFinite)&&saved.camera.zoom>=MIN_ZOOM&&saved.camera.zoom<=MAX_ZOOM){camera=saved.camera;lens=['all','now','archived'].includes(saved.lens)?saved.lens:'all';selected=data.atoms.some(a=>a.id===saved.selected)?saved.selected:'';}const disabled=await initializePluginDefaults(core.storage,data.atoms.length>0);for(const p of [templates,daily,...dynamicsPlugins,...mapTools,folders.plugin,...controls,behavior,appearancePlugin,soundPlugin,animationsPlugin])if(!disabled.includes(p.manifest.id))await runtime.enable(p);if(!boardOptions)board=false;const community=await core.storage.getSetting<{manifest:Manifest;source:string;style?:string;assets?:Record<string,number[]>;enabled:boolean}[]>('community-plugins')||[];for(const p of community)if(p.enabled)try{await runtime.enable(communityPlugin(p.manifest,p.source,p));}catch(e){notify(`Плагин ${p.manifest.name} не запущен: ${(e as Error).message}`);}const spaces=await (core.storage as SQLiteAdapter).workspaces();workspaceName=spaces.items.find(w=>w.id===spaces.current)?.name||'Основное';undoAvailable=Boolean((await core.storage.getSetting<{count:number}>('last-deletion-summary'))?.count);recovery=editorCheckpoint(await core.storage.getSetting(EDITOR_CHECKPOINT));performance.mark('phosphora:data-ready');ready=true;remember();if(recovery){editorReturn=locationState();parent=recovery.parent;editing=recovery.initial;notify('\u0427\u0435\u0440\u043d\u043e\u0432\u0438\u043a \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d.');}await persist();}).catch(e=>{fatal=true;error=e.message;});
  const viewport=window.visualViewport,resizeSearch=()=>searchViewportHeight=viewport?.height||innerHeight;resizeSearch();viewport?.addEventListener('resize',resizeSearch);
  if('serviceWorker' in navigator)navigator.serviceWorker.ready.then(()=>offlineReady=true);
  const pop=(e:PopStateEvent)=>{if(surfaceOwnsHistory())return;const target=e.state?.[navigationKey];if(validLocation(target)){if(editing)editorReturn=target;else editorReturn=null;contextId='';menu=false;travel(target);}};window.addEventListener('popstate',pop);
  const install=(e:Event)=>{e.preventDefault();installEvent=e;};window.addEventListener('beforeinstallprompt',install);
  const rollTimer=setInterval(()=>{if(ready)core.rollTasks().catch(e=>error=e.message);},60000);
  const keys=(e:KeyboardEvent)=>{if(e.key==='Escape'){menu=false;activeView=null;}if(!surfaceOwnsHistory()&&!editing&&!settings&&!workspaces&&!contextId&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();expandSearch();}};window.addEventListener('keydown',keys);
  return()=>{viewport?.removeEventListener('resize',resizeSearch);updates?.dispose();clearInterval(rollTimer);unsub();runtime.dispose();core.storage.close();window.removeEventListener('beforeinstallprompt',install);window.removeEventListener('keydown',keys);clearTimeout(noticeTimer);window.removeEventListener('popstate',pop);};});
  function create(x?:number,y?:number,title='',related=false){recovery=undefined;editorReturn=locationState();const a=data.atoms.find(a=>a.id===selected)||data.atoms.find(a=>folderProjection?.folders.find(f=>f.id===activeFolder)?.roots.includes(a.id));parent=related?a?.id:undefined;editing={title,content:'',type:'note',state:lens==='now'?'now':'normal',importance:0,pinned:false,spatial:{resistance:0},appearance:{color:'#b4ecc1'},aliases:[],properties:activeFolder?{[FOLDER_MEMBERSHIP]:{[activeFolder]:1}}:{},...(x!==undefined&&y!==undefined?{x,y}:{})};contextId='';editorSection='';menu=false;}
  function open(id:string,section=''){const a=data.atoms.find(a=>a.id===id);if(a){recovery=undefined;if(!editing)editorReturn=locationState();contextId='';parent=undefined;editorSection=section;editing=$state.snapshot(a);intent.open(id);}}
  function closeEditor(){recovery=undefined;editing=null;contextId='';intent.close();if(editorReturn){camera=editorReturn.camera;selected=data.atoms.some(a=>a.id===editorReturn!.selected)?editorReturn!.selected:'';lens=editorReturn.lens;editorReturn=null;}saveCamera();}
  function showContext(ids:string[]){contextIds=ids;editing=null;intent.select(ids[0]);contextId=ids[0];menu=false;}
  function closeContext(){contextId='';intent.release();selected='';saveCamera();}
  async function save(draft:Partial<Atom>&{title:string},add:{to:string;relation:string}[],remove:string[],keepOpen=false){const created=!draft.id;const atom=await core.saveDraft(draft,add,remove,parent,true,true);if(keepOpen)return atom;closeEditor();if(created){intent.select(atom.id);lens=atom.state==='archived'?'archived':lens==='now'&&atom.state==='now'?'now':'all';saveCamera();}return atom;}
  async function removeAtom(id:string){await core.delete(id);closeEditor();deleted(1);}
  async function changeState(id:string,state:AtomState){try{await core.setState(id,state);}catch(e){error=(e as Error).message;}}
  let commandBusy=$state(false);
  async function command(c:Command){if(commandBusy)return;commandBusy=true;menu=false;try{await tick();await surfacesClosed();const folderRoot=folderProjection?.folders.find(f=>f.id===activeFolder)?.roots.find(id=>data.atoms.some(a=>a.id===id));await c.run(c.id==='builtin.daily:daily'?undefined:folderRoot||selected,{folderId:activeFolder??undefined,position:{x:-camera.x/camera.zoom,y:-camera.y/camera.zoom}});}catch(e){error=(e as Error).message;}finally{commandBusy=false;}}
  async function layout(id:string){menu=false;try{const positions=await runtime.layouts.get(id)!.run(structuredClone(core.data));for(const p of positions){const a=core.data.atoms.find(a=>a.id===p.id);if(!a)throw Error('Unknown atom');if(!a.pinned)await core.update(p.id,{x:p.x,y:p.y,spatial:{resistance:0}});}}catch(e){error=(e as Error).message;}}
</script>
<svelte:window onpointerdown={e=>{if(searchOpen&&!(e.target as Element).closest('.search'))collapseSearch();}}/>
<svelte:head><title>Posphorea — ваша живая карта</title></svelte:head>
<main data-navigation="idle" class:map-interacting={fieldInteracting} class:booting={!ready} class:app-ready={ready}>{#if ready}<ThemeBackdrop {camera}/>{/if}
 {#if ready&&folderProjection&&!board}
  <FolderTerritories {territories} {camera} width={view.width} height={view.height} activeId={activeFolder}/>
  {#if !editing&&!settings&&!workspaces&&!contextId}
   <FolderStrip removeIds={folderDragRemovals} drag={folderDrag} bind:this={folderStrip} folders={folderProjection.folders} selectionIds={folderSelection} bind:activeId={activeFolder} oncreate={folders.controller.create} onfocus={folders.controller.focus} onupdate={folders.controller.update} onremove={folders.controller.remove} onadd={folders.controller.add}/>
  {/if}
 {/if}
 <header><button class="workspace-switch" aria-label="Выбрать хранилище" disabled={!ready||Boolean(editing)} onclick={()=>{workspaces=true;menu=false;contextId='';}}><span>✳</span><span>{workspaceName}</span><small>⌄</small></button><div class="search" class:search-open={searchOpen}><button bind:this={searchButton} class="search-trigger" aria-label="Открыть поиск" aria-expanded={searchOpen} disabled={!ready} onclick={expandSearch}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></button><input bind:this={searchInput} tabindex={searchOpen?0:-1} aria-hidden={!searchOpen} enterkeyhint="search" autocomplete="off" aria-label="Поиск" placeholder="Найти мысль…" bind:value={query} aria-autocomplete="list" aria-controls={searchOpen&&query?'search-results':undefined} aria-activedescendant={searchOpen&&query&&results.length?`search-result-${Math.min(searchIndex,results.length-1)}`:undefined} oninput={()=>searchIndex=0} onkeydown={searchKeys}/>{#if searchOpen}<button class="search-close" aria-label="Закрыть поиск" onclick={()=>collapseSearch(true)}>×</button>{/if}{#if searchOpen&&query}<div class="search-results" style:--search-room={searchViewportHeight?`${Math.max(120,searchViewportHeight-150)}px`:undefined}><div id="search-results" role="listbox" aria-label="Результаты поиска">{#each results as a,i}<button id={`search-result-${i}`} role="option" aria-selected={i===Math.min(searchIndex,results.length-1)} class:search-current={i===Math.min(searchIndex,results.length-1)} onpointermove={()=>searchIndex=i} onclick={()=>chooseSearch(a.id)}><span>{#each excerpt(a.title,query,100) as part}{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}</span>{#if a.content}<span class="search-excerpt">{#each excerpt(a.content,query) as part}{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}</span>{/if}<small>{typeName(a.type)} · {states[a.state]}{a.paused?' · Пауза':''}</small></button>{:else}<button class="search-create" onclick={createFromSearch}>+ Создать «{query.trim().slice(0,80)}»</button>{/each}</div>{#if results.length}<button class="search-location" onclick={()=>focus(results[Math.min(searchIndex,results.length-1)].id)}>Показать на карте <span aria-hidden="true">↗</span></button>{/if}</div>{/if}</div><SaveStatus/>{#if ready&&registry>=0&&runtime?.active.has('builtin.sound')}<SoundToggle/>{/if}<button aria-label="Меню карты" aria-expanded={menu} disabled={!ready||commandBusy} onclick={()=>menu=!menu}>•••</button></header>
 {#if error}<div role="alert" class="notice">{error}{#if fatal}<button onclick={()=>location.reload()}>Повторить запуск</button><button onclick={()=>location.search=''}>Открыть последнее хранилище</button>{:else}<button onclick={()=>error=''}>Закрыть</button>{/if}</div>{/if}
 {#if notice&&!editing&&!contextId&&!searchOpen}<div role="status" class="toast"><span>{notice}</span>{#if noticeAction}<button class="notice-action" disabled={noticeBusy} onclick={actNotice}>{noticeAction.label}</button>{/if}<button aria-label="Скрыть уведомление" onclick={()=>notice=''}>×</button></div>{/if}
 {#if !ready}<div class="empty"><h1>{fatal?'Карта не открыта':'Открываем вашу карту'}</h1><p>{fatal?'Данные не удалены. Закройте другую вкладку или повторите запуск.':'Локальные данные остаются на этом устройстве.'}</p></div>{:else}
 <div class="map-scene" class:field-hidden={board} style:height="100%"><Map physicsEnabled={Boolean(registry>=0&&runtime?.active.has('builtin.physics'))} {zoomOptions} {data} {selected} {lens} bind:camera providers={runtime.providers} {prefs} providerVersion={registry} paused={Boolean(board||activeView||editing||settings||contextId||menu||workspaces||branch.length)} onselection={ids=>mapSelection=ids} onfolderdrop={dropIntoFolder} onfolderdrag={value=>folderDrag=value} onviewport={(size:any)=>view=size} {revealRequest} {connectRequest} preservePositions={restoring} oninteraction={active=>fieldInteracting=active} onselect={id=>{intent.select(id);contextId='';saveCamera();}} onhover={id=>intent.hover(id)} onopen={open} oncontext={id=>showContext([id])} onbranch={showContext} oncreate={(x,y)=>create(x,y)} onpositions={(positions,manual)=>core.positions(positions,manual)} onstate={changeState} onlinkchange={(before,after)=>core.changeLink(before,after)} onstates={async(ids,state)=>{await core.group(ids,state);if(state==='delete')deleted(ids.length);}} oncamera={saveCamera} onerror={e=>error=e.message}/></div>{#if board}{#await loadBoard() then m}<m.default {data} {core} options={boardOptions} onopen={open}/>{:catch e}<p role="alert">{e.message}</p>{/await}{/if}
 {#if !board&&!data.atoms.length}<div class="empty"><small>ВАШЕ ПРОСТРАНСТВО ДЛЯ МЫСЛЕЙ</small><h1>Всё начинается<br/>с одной мысли.</h1><p>Запишите её. Свяжи с другой.<br/>Постепенно появится ваша карта.</p><p>Зажмите свободное место на карте, чтобы создать атом.<br/>На клавиатуре — N.</p></div>{/if}
 {#if !board&&data.atoms.length&&lens==='now'&&!data.atoms.some(a=>a.state==='now'&&!a.paused)}<div class="empty lens-empty"><h2>Что важно сейчас?</h2><p>Выберите атом на карте и измените его состояние на «Сейчас».</p><button onclick={()=>{lens='all';saveCamera();}}>Посмотреть всю карту</button></div>{/if}
 {#if contextId&&current}<ContextMenu actions={contextActions} onaction={async action=>{const id=contextId,folderId=activeFolder??undefined;closeContext();await tick();await surfacesClosed();try{await action.run(id,{folderId});}catch(e){error=(e as Error).message;}}} folders={contextFolders} onfolder={folderProjection?async(id,add)=>{if(add)await folders.controller.add(id,contextIds);else await folders.controller.removeMembers(id,contextIds);}:undefined} onnewfolder={folderProjection?()=>{const ids=[...contextIds];closeContext();void tick().then(()=>folderStrip?.beginCreate(ids));}:undefined} types={typeList} ontype={async (value:string)=>{if(contextIds.length===1)await core.update(contextId,{type:value});else await core.groupUpdate(contextIds,{type:value});closeContext();}} onconnect={()=>{connectRequest={id:contextId,nonce:++connectNonce};contextId='';menu=false;}} count={contextIds.length} onmove={()=>{branch=[...contextIds];contextId='';}} atom={{...current,paused:contextIds.some(id=>data.atoms.find(a=>a.id===id)?.paused),pinned:contextIds.every(id=>data.atoms.find(a=>a.id===id)?.pinned)}} pinning={prefs.pinning} onappearance={async(appearance,importance)=>{const patch={appearance:{...appearance,...(importance!==current?.importance?{size_override:undefined}:{})},...(importance!==undefined?{importance}:{})};if(contextIds.length===1)await core.update(contextId,patch);else await core.groupUpdate(contextIds,patch);closeContext();}} ondelete={async()=>{if(contextIds.length===1)await removeAtom(contextId);else{await core.group(contextIds,'delete');deleted(contextIds.length);}closeContext();}} onclose={closeContext} onstate={async s=>{await core.group(contextIds,s);closeContext();}} onpin={async()=>{await core.group(contextIds,contextIds.every(id=>data.atoms.find(a=>a.id===id)?.pinned)?'unpin':'pin');closeContext();}} onedit={section=>open(contextId,section)} oncreate={()=>create(undefined,undefined,'',true)} onimportance={async importance=>{if(contextIds.length===1)await core.update(contextId,{importance});else await core.groupUpdate(contextIds,{importance});closeContext();}}/>{/if}
 <footer><button class="storage-status" onclick={()=>settings=true}>{data.atoms.length} атомов · {data.links.length} связей <span>· {offlineReady?'готово offline':'локально'}{persistent?' · закреплено':''}</span></button><div class="footer-controls"><div class="view-toggle" role="group" aria-label="Представление"><button class:active={!board} aria-pressed={!board} onclick={()=>changeView(false)}>Поле</button><button disabled={!boardOptions} class:active={board} aria-pressed={board} onclick={()=>changeView(true)}>Канбан</button></div><nav class:inactive={board} aria-hidden={board} inert={board} aria-label="Линзы карты">{#each [['now','Сейчас'],['all','Обычные'],['archived','Архив']] as [s,label]}<button class:active={lens===s} aria-pressed={lens===s} onclick={()=>{lens=s;saveCamera();}}>{label}</button>{/each}</nav></div></footer>
 {/if}
 {#if menu}<div class="main-menu" use:surface={{close:()=>menu=false}}>{#if undoAvailable}<button onclick={async()=>{menu=false;try{await undoDelete();}catch(e){error=(e as Error).message;}}}>Отменить удаление</button>{/if}{#key registry}{#each [...runtime.commands.values()].filter(c=>c.id!=='builtin.folders:create') as c}<button onclick={()=>command(c)}>{c.name}</button>{/each}{#each [...runtime.layouts.values()] as l}<button onclick={()=>layout(l.id)}>{l.name}</button>{/each}{#each [...runtime.views.values()] as v}<button onclick={async()=>{menu=false;try{activeView=v;}catch(e){error=(e as Error).message;}}}>{v.name}</button>{/each}{/key}{#if installEvent}<button onclick={async()=>{await installEvent.prompt();installEvent=null;menu=false;}}>Установить приложение</button>{/if}<button onclick={()=>{settings=true;menu=false;}}>Настройки и резервные копии</button></div>{/if}
 {#if editing}{#key editing}{#await loadEditor()}<LoadingSurface onclose={closeEditor}/>{:then m}<m.default bind:this={editorRef} {recovery} initial={$state.snapshot(editing)} {data} types={typeList} {parent} {prefs} section={editorSection} storage={core.storage} onopen={open} onsave={save} onclose={closeEditor} ondelete={removeAtom}/>{:catch e}<LoadingSurface onclose={closeEditor} error={e.message}/>{/await}{/key}{/if}
 {#if branch.length}<BranchMenu destinationOnly onpatch={async patch=>{await core.groupUpdate(branch,patch);branch=[];}} atoms={data.atoms} onmove={target=>core.moveInto(branch,target)} ids={branch} pinned={branch.every(id=>data.atoms.find(a=>a.id===id)?.pinned)} onaction={action=>core.group(branch,action)} onclose={()=>branch=[]}/>{/if}
 {#if workspaces}{#await loadWorkspaces()}<LoadingSurface onclose={()=>workspaces=false}/>{:then m}<m.default storage={core.storage as SQLiteAdapter} onclose={async()=>{workspaces=false;const spaces=await (core.storage as SQLiteAdapter).workspaces();workspaceName=spaces.items.find(w=>w.id===spaces.current)?.name||'Основное';}}/>{:catch e}<LoadingSurface onclose={()=>workspaces=false} error={e.message}/>{/await}{/if}
 {#if settings}{#await loadSettings()}<LoadingSurface onclose={()=>settings=false}/>{:then m}<m.default extraBuiltins={[folders.plugin,...controls,behavior,appearancePlugin,soundPlugin,animationsPlugin]} {core} {runtime} {persistent} {prefs} onclose={()=>settings=false} onpersist={persist} onnotify={notify} {updateStatus} oncheckupdate={checkUpdate} onupdate={applyUpdate}/>{:catch e}<LoadingSurface onclose={()=>settings=false} error={e.message}/>{/await}{/if}
 {#if activeView}<PluginView view={activeView} onclose={()=>activeView=null}/>{/if}
 {#if ready&&updateStatus.available&&!editing&&!settings&&!workspaces&&!contextId&&!menu}<div class="update-prompt" role="status"><span>Новая версия готова</span><button onclick={applyUpdate}>Обновить</button></div>{/if}
</main>
