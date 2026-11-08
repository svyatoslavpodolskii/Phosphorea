import type {Plugin,PluginAPI} from './api';
import type {DraftPolicy} from '../core/drafts';
import {FOLDER_DEFINITIONS,FOLDER_MEMBERSHIP,MAX_FOLDERS,MAX_FOLDER_ROOTS,folderDefinitions,projectFolders,type FolderDefinition,type FolderFocus,type FolderProjection} from '../graph/folders';

export interface FolderHost {
 /** Return raw atom IDs (expand any rendered clusters in the host). */
 getSelection?:()=>readonly string[];
 /** A context action requests the host's naming UI; it must not write yet. */
 requestCreate?:(ids:readonly string[])=>void;
 /** null means disabled: unmount strip/territories and clear local folder focus. */
 changed?:(projection:FolderProjection|null)=>void;
 focus?:(target:FolderFocus)=>void;
}
export interface FolderController {
 update:(id:string,name:string,color:string)=>Promise<void>;
 remove:(id:string)=>Promise<void>;
 add:(id:string,ids:readonly string[])=>Promise<void>;
 removeMembers:(id:string,ids:readonly string[])=>Promise<void>;
 create:(name:string,ids?:readonly string[],color?:string)=>Promise<string>;
 focus:(folderId:string|null)=>Promise<FolderFocus|null>;
 refresh:()=>Promise<void>;
}
export const FOLDER_COLORS=['#75aee8','#b398dd','#80b78b','#d3ae6d','#d991a0','#68bfc0'];

/** New contextual descendants inherit memberships inside the public draft
 * transaction. No async event writes, private Core access or link side effects. */
export function folderDraftPolicy():DraftPolicy{
 return {id:'inherit',name:'Наследование папок веткой',prepare(context){
  if(context.before||!context.parent)return {};
  const weights=projectFolders(context.data).memberships.get(context.parent);
  if(!weights||!Object.keys(weights).length)return {};
  const explicit=context.atom.properties[FOLDER_MEMBERSHIP];
  if(explicit!==undefined)return {}; // Imports and explicit caller choices win.
  return {properties:{[FOLDER_MEMBERSHIP]:{...weights}}};
 }};
}

/** The factory binds only host presentation callbacks; all persistent access goes
 * through PluginAPI. Retain `controller` for the strip's create/focus callbacks. */
export function createFoldersPlugin(host:FolderHost={}) : {plugin:Plugin;controller:FolderController}{
 let hasFolders=false;let app:PluginAPI|undefined,epoch=0,dirty=false,pending:{version:number;promise:Promise<void>}|undefined,creating=false;
 const requireApp=()=>{if(!app)throw Error('Плагин «Папки» выключен.');return app;};
 async function read(api:PluginAPI){const [atoms,links]=await Promise.all([api.atoms.list(),api.links.list()]);return projectFolders({atoms,links});}
 async function refresh(){
  const api=requireApp(),version=epoch;dirty=true;
  if(pending?.version===version)return pending.promise;
  const promise=(async()=>{while(dirty&&app===api&&epoch===version){dirty=false;const projection=await read(api);if(app===api&&epoch===version){hasFolders=projection.folders.length>0;host.changed?.(projection);}}})().finally(()=>{if(pending?.promise===promise)pending=undefined;});
  pending={version,promise};return promise;
 }
 const controller:FolderController={
  async update(id,name,color){const api=requireApp();name=name.trim();if(!name||name.length>80||!/^#[0-9a-f]{6}$/i.test(color))throw Error('Проверьте название и цвет папки.');const atoms=await api.atoms.list(),owner=atoms.find(a=>folderDefinitions(a).some(f=>f.id===id));if(!owner)throw Error('Папка уже удалена.');await api.atoms.update(owner.id,{revision:owner.revision,properties:{...owner.properties,[FOLDER_DEFINITIONS]:folderDefinitions(owner).map(f=>f.id===id?{...f,name,color}:f)}});if(app===api)await refresh();},
  async remove(id){const api=requireApp(),atoms=await api.atoms.list(),owner=atoms.find(a=>folderDefinitions(a).some(f=>f.id===id));if(!owner)return;await api.atoms.update(owner.id,{revision:owner.revision,properties:{...owner.properties,[FOLDER_DEFINITIONS]:folderDefinitions(owner).filter(f=>f.id!==id)}});if(app===api)await refresh();},
  async add(id,ids){const api=requireApp(),atoms=await api.atoms.list(),owner=atoms.find(a=>folderDefinitions(a).some(f=>f.id===id));if(!owner)throw Error('Папка уже удалена.');const valid=new Set(atoms.map(a=>a.id));if(!ids.length||ids.some(id=>!valid.has(id)))throw Error('Выделение изменилось. Выберите заметки заново.');const definitions=folderDefinitions(owner).map(f=>f.id===id?{...f,roots:[...new Set([...f.roots,...ids])],excluded:(f.excluded||[]).filter(id=>!ids.includes(id))}:f);if(definitions.some(f=>f.roots.length>MAX_FOLDER_ROOTS))throw Error('В папке слишком много заметок.');await api.atoms.update(owner.id,{revision:owner.revision,properties:{...owner.properties,[FOLDER_DEFINITIONS]:definitions}});if(app===api)await refresh();},
  async removeMembers(id,ids){const api=requireApp(),atoms=await api.atoms.list(),owner=atoms.find(a=>folderDefinitions(a).some(f=>f.id===id));if(!owner)throw Error('Папка уже удалена.');const definitions=folderDefinitions(owner).map(f=>f.id===id?{...f,excluded:[...new Set([...(f.excluded||[]),...ids])]}:f);if(definitions.some(f=>(f.excluded?.length||0)>MAX_FOLDER_ROOTS))throw Error('Слишком много исключений в папке.');await api.atoms.update(owner.id,{revision:owner.revision,properties:{...owner.properties,[FOLDER_DEFINITIONS]:definitions}});if(app===api)await refresh();},
  async create(name,ids,color){
   if(creating)throw Error('Дождитесь создания предыдущей папки.');creating=true;
   try{
   const api=requireApp(),version=epoch;name=name.trim();if(!name||name.length>80)throw Error('Название папки должно содержать от 1 до 80 символов.');
   const roots=[...new Set(ids??host.getSelection?.()??[])];
   if(!roots.length||roots.length>MAX_FOLDER_ROOTS)throw Error(`Выберите от 1 до ${MAX_FOLDER_ROOTS} заметок.`);
   const atoms=await api.atoms.list(),byId=new Map(atoms.map(atom=>[atom.id,atom]));
   if(roots.some(id=>!byId.has(id)))throw Error('Выделение изменилось. Выберите заметки заново.');
   const current=projectFolders({atoms,links:[]});if(current.folders.length>=MAX_FOLDERS)throw Error(`Можно создать не более ${MAX_FOLDERS} папок.`);
   color??=FOLDER_COLORS[current.folders.length%FOLDER_COLORS.length];if(!/^#[0-9a-f]{6}$/i.test(color))throw Error('Выберите цвет в формате #RRGGBB.');
   // One ordinary atom update is atomic even for a large lasso. No moves, copies,
   // extra nodes or per-selected-note writes; definitions contain the seed IDs.
   const owner=byId.get(roots[0])!;
   const definition:FolderDefinition={id:crypto.randomUUID(),name,color,roots};
   const definitions=[...folderDefinitions(owner),definition];
   if(definitions.length>MAX_FOLDERS)throw Error('К этой заметке привязано слишком много папок.');
   if(epoch!==version||app!==api)throw Error('Плагин «Папки» выключен.');
   await api.atoms.update(owner.id,{revision:owner.revision,properties:{...owner.properties,[FOLDER_DEFINITIONS]:definitions}});
   if(epoch===version&&app===api)await refresh();
   return definition.id;
   }finally{creating=false;}
  },
  async focus(folderId){const api=requireApp(),version=epoch,projection=await read(api);
   const target=folderId===null?projection.all:projection.folders.find(folder=>folder.id===folderId)?.focus??null;
   if(target&&epoch===version&&app===api)host.focus?.(target);return target;
  },refresh,
 };
 const plugin:Plugin={manifest:{id:'builtin.folders',name:'Папки',version:'1.0.0',apiVersion:1,
  description:'Мягкие области на общей карте. Заметка может принадлежать нескольким папкам.',
  permissions:['atoms.read','atoms.write','links.read','links.write','graph','ui']},
  async activate(api){
   if(app)throw Error('Плагин «Папки» уже включён.');app=api;epoch++;const offs:Array<()=>void>=[];
   const dispose=()=>{app=undefined;epoch++;dirty=false;for(const off of offs.reverse())off();host.changed?.(null);};
   try{
    offs.push(api.atoms.registerDraftPolicy(folderDraftPolicy()));
    const request=(id?:string)=>{const selected=[...new Set(host.getSelection?.()??[])];const ids=selected.length?selected:id?[id]:[];
     if(!ids.length){api.ui.notify('Выделите заметки лассо, чтобы создать папку.');return;}
     if(host.requestCreate)host.requestCreate(ids);else api.ui.notify('Откройте панель папок, чтобы задать название.');
    };
    offs.push(api.commands.add({id:'create',name:'Создать папку из выделения',run:request}));
    offs.push(api.ui.registerContextAction({id:'create',name:'Создать папку из выделения',run:request}));
    const schedule=()=>{void refresh().catch(error=>{if(app===api)api.ui.notify((error as Error).message);});};
    for(const event of ['atom:create','atom:update','atom:delete','link:create','link:delete','graph:positions'])offs.push(api.events.on(event,()=>{if(event!=='graph:positions'||hasFolders)schedule();}));
    await refresh();return dispose;
   }catch(error){dispose();throw error;}
  }};
 return {plugin,controller};
}
