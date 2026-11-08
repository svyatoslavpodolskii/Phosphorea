import {placeAtom,type PlacementInput} from '../graph/placement';
import {branchingLayout} from '../graph/structure';
import {NoteSearch} from './search';
import {transitionState,makeAtom,makeLink,type Atom,type AtomState,type Snapshot,type StorageAdapter,type Mutation,type PositionUpdate} from './model';
import {normalize,candidates,sameTextContext,type Rejection} from './matching';
import {preferences,type Preferences} from './preferences';
import {syncTasks,taskPatch,type Recurrence} from './tasks';
import {DraftPolicies} from './drafts';
import {EDITOR_CHECKPOINT} from './editor-checkpoint';
export {normalize} from './matching';
export class Core {
 readonly drafts=new DraftPolicies();
 placementProvider?: (input:PlacementInput)=>Promise<{x:number;y:number}>|{x:number;y:number};
 data:Snapshot={atoms:[],links:[]};prefs=preferences();
 private searchIndex=new NoteSearch();
 private listeners=new Set<()=>void>();private events=new Map<string,Set<(payload:any)=>unknown>>();private queue:Promise<unknown>=Promise.resolve();
 constructor(public storage:StorageAdapter){}
 async init(){await this.storage.open();this.prefs=preferences(await this.storage.getSetting<Preferences>('preferences'));await this.refresh();if(!await this.storage.getSetting('structural-layout-v2')){const layout=branchingLayout(this.data,this.prefs.preset,this.prefs.physics.distance);await this.storage.transaction([{kind:'positions',positions:this.data.atoms.filter(a=>!a.pinned&&!a.spatial.resistance).map(a=>({id:a.id,...layout.points.get(a.id)!})),manual:false},{kind:'setting',key:'structural-layout-v2',value:true}]);await this.refresh();}}
 subscribe(fn:()=>void){this.listeners.add(fn);return()=>{this.listeners.delete(fn);};}
 on(name:string,fn:(payload:any)=>unknown){const set=this.events.get(name)||new Set();set.add(fn);this.events.set(name,set);return()=>{set.delete(fn);};}
 emit(name:string,payload:unknown){for(const fn of this.events.get(name)||[])try{Promise.resolve(fn(structuredClone(payload))).catch(e=>console.error('Plugin event',e));}catch(e){console.error('Plugin event',e);}}
 private changed(){for(const fn of this.listeners)fn();}
 async refresh(){this.data=await this.storage.snapshot();this.searchIndex.sync(this.data.atoms);this.changed();}
 private serial<T>(fn:()=>Promise<T>):Promise<T>{const next=this.queue.then(fn);this.queue=next.catch(()=>{});return next;}
 async commit(ops:Mutation[]){await this.storage.transaction(ops);await this.refresh();}
 async setPreferences(value:Preferences){const next=preferences(value);await this.storage.transaction([{kind:'setting',key:'preferences',value:next}]);this.prefs=next;this.emit('preferences:update',next);this.changed();}
 saveDraft(input:Partial<Atom>&{title:string},add:{to:string;relation:string;source?:string}[]=[],remove:string[]=[],parent?:string,preservePosition=true,consumeCheckpoint=false){return this.serial(async()=>{
 const plain=JSON.parse(JSON.stringify(input));const before=input.id?this.data.atoms.find(a=>a.id===input.id):undefined;if(input.id&&!before)throw Error('Атом не найден.');const autoPlace=!before&&(plain.x===undefined||plain.y===undefined);if(!before)delete plain.id;
 let atom:Atom=before?{...before,...plain,id:before.id,x:preservePosition?before.x:plain.x??before.x,y:preservePosition?before.y:plain.y??before.y,spatial:preservePosition?before.spatial:plain.spatial??before.spatial,created_at:before.created_at,updated_at:new Date().toISOString(),revision:before.revision+1}:makeAtom(plain);
 atom=syncTasks(transitionState(before,atom),before);
 if(before&&atom.pinned!==before.pinned)atom.spatial={resistance:0};
 const ops:Mutation[]=[{kind:'atom',atom,expectedRevision:before?input.revision??before.revision:undefined}];const text=atom.title+' '+atom.content;const oldRejection=await this.storage.getSetting<Rejection>('rejected:'+atom.id);const rejection:Rejection={text:normalize(text),targets:oldRejection&&sameTextContext(text,oldRejection.text)?[...oldRejection.targets]:[]};
 for(const id of remove){const l=this.data.links.find(l=>l.id===id);if(l){const to=l.from===atom.id?l.to:l.from;rejection.targets.push(to);const other=this.data.atoms.find(a=>a.id===to);if(other){const old=await this.storage.getSetting<Rejection>('rejected:'+to);const otherText=normalize(other.title+' '+other.content);ops.push({kind:'setting',key:'rejected:'+to,value:{text:otherText,targets:[...(old&&sameTextContext(otherText,old.text)?old.targets:[]),atom.id]}});}}ops.push({kind:'unlink',id});}
 if(remove.length)ops.push({kind:'setting',key:'rejected:'+atom.id,value:rejection});
 if(parent&&!before)ops.push({kind:'link',link:makeLink(parent,atom.id,'related','context')});
 const additions=[...add];if(this.prefs.linkMode==='automatic'){const excluded=new Set([atom.id,...this.data.links.filter(l=>l.from===atom.id||l.to===atom.id).flatMap(l=>[l.from,l.to]),...add.map(l=>l.to),...(parent?[parent]:[])]);const matches=candidates(text,this.data.atoms,excluded,rejection,false);for(const c of matches.filter(c=>c.confidence===1&&this.data.atoms.filter(a=>[a.title,...a.aliases].some(t=>normalize(t)===c.matched)).length===1))additions.push({to:c.atom.id,relation:'related',source:'automatic'});}
 if(consumeCheckpoint)ops.push({kind:'setting',key:EDITOR_CHECKPOINT,value:null});
 const effects=await this.drafts.prepare({atom,before,data:this.data,parent,add:additions,remove,rejected:rejection.targets});
 atom.properties=effects.properties;additions.push(...effects.add);for(const id of effects.remove)ops.push({kind:'unlink',id});
 if(autoPlace){const placement:PlacementInput={data:structuredClone(this.data),parent,atom,targets:[...new Set([...(parent?[parent]:[]),...additions.map(l=>l.to)])]};const point=await (this.placementProvider?.(placement)??placeAtom(placement));if(!Number.isFinite(point.x)||!Number.isFinite(point.y))throw Error('Invalid layout position');Object.assign(atom,point);}
 for(const l of additions)ops.push({kind:'link',link:makeLink(atom.id,l.to,l.relation,l.source||'manual')});await this.commit(ops);this.emit(before?'atom:update':'atom:create',atom);for(const op of ops){if(op.kind==='link')this.emit('link:create',op.link);if(op.kind==='unlink')this.emit('link:delete',{id:op.id});}return atom;
 });}
 create(input:Partial<Atom>&{title:string},parent?:string){return this.saveDraft(input,[],[],parent);}
 update(id:string,patch:Partial<Atom>,expectedRevision?:number){const a=this.data.atoms.find(a=>a.id===id);if(!a)return Promise.reject(Error('Атом не найден.'));return this.saveDraft({...a,...patch,id,revision:expectedRevision??patch.revision??a.revision},[],[],undefined,false);}
 setState(id:string,state:AtomState){return this.update(id,{state});}
 setPaused(id:string,paused:boolean){return this.update(id,{paused});}
 setPinned(id:string,pinned:boolean){return this.update(id,{pinned});}
 positions(positions:PositionUpdate[],manual=false){return this.serial(async()=>{const input=JSON.parse(JSON.stringify(positions)) as PositionUpdate[];await this.storage.transaction([{kind:'positions',positions:input,manual}]);const map=new Map(input.map(p=>[p.id,p]));this.data={...this.data,atoms:this.data.atoms.map(a=>{const p=map.get(a.id);return p&&(manual||!a.pinned)?{...a,x:p.x,y:p.y,spatial:p.resistance===undefined?a.spatial:{resistance:p.resistance}}:a;})};this.changed();this.emit('graph:positions',{positions:input,manual});});}
 link(from:string,to:string,relation='related'){return this.serial(async()=>{const link=makeLink(from,to,relation);await this.commit([{kind:'link',link}]);this.emit('link:create',link);return link;});}
 /** Atomic, conflict-checked relationship edit used by direct manipulation and undo. */
 changeLink(before:import('./model').Link|null,after:import('./model').Link|null){before=before?{...before}:null;after=after?{...after}:null;return this.serial(async()=>{
  const current=before&&this.data.links.find(l=>l.id===before.id);
  if(before&&(!current||(['id','from','to','relation','source','created_at'] as const).some(key=>current[key]!==before[key])))throw Error('Связь уже изменена. Выберите её заново.');
  if(after&&this.data.links.some(l=>l.id!==before?.id&&(l.id===after.id||l.from===after.from&&l.to===after.to&&l.relation===after.relation)))throw Error('Такая связь уже существует.');
  const ops:Mutation[]=[];
  if(before){ops.push({kind:'unlink',id:before.id});for(const [from,to] of [[before.from,before.to],[before.to,before.from]]){
   const atom=this.data.atoms.find(a=>a.id===from);if(!atom)continue;const text=normalize(atom.title+' '+atom.content),old=await this.storage.getSetting<Rejection>('rejected:'+from);
   ops.push({kind:'setting',key:'rejected:'+from,value:{text,targets:[...new Set([...(old&&sameTextContext(text,old.text)?old.targets:[]),to])]}});
  }}
  if(after)ops.push({kind:'link',link:structuredClone(after)});
  await this.commit(ops);if(before)this.emit('link:delete',{id:before.id});if(after)this.emit('link:create',after);
 });}
 unlink(id:string){return this.serial(async()=>{const l=this.data.links.find(l=>l.id===id);const ops:Mutation[]=[{kind:'unlink',id}];if(l)for(const [from,to] of [[l.from,l.to],[l.to,l.from]]){const a=this.data.atoms.find(a=>a.id===from);if(a){const old=await this.storage.getSetting<Rejection>('rejected:'+from);const text=normalize(a.title+' '+a.content);ops.push({kind:'setting',key:'rejected:'+from,value:{text,targets:[...(old&&sameTextContext(text,old.text)?old.targets:[]),to]}});}}await this.commit(ops);this.emit('link:delete',{id});});}
 delete(id:string){return this.group([id],'delete');}
 async undoDeletion(){return this.serial(async()=>{
  const entry=await this.storage.getSetting<{version:number;data:Snapshot}>('last-deletion');if(!entry||entry.version!==1)return [];
  const ids=new Set(entry.data.atoms.map(a=>a.id)),existing=new Set(this.data.atoms.map(a=>a.id));
  if(entry.data.atoms.some(a=>existing.has(a.id)))throw Error('Нельзя отменить удаление: атом с этим ID уже есть на карте.');
  const path=(a:Atom)=>{const v=a.properties.vault as {vault?:string;path?:string}|undefined;return typeof v?.vault==='string'&&typeof v.path==='string'?v.vault+'|'+v.path.toLocaleLowerCase('en-US'):'';};
  const used=new Set(this.data.atoms.map(path).filter(Boolean));if(entry.data.atoms.some(a=>path(a)&&used.has(path(a))))throw Error('Путь удалённой заметки уже занят. Переименуйте её копию перед отменой.');
  const links=entry.data.links.filter(l=>(existing.has(l.from)||ids.has(l.from))&&(existing.has(l.to)||ids.has(l.to)));
  if(links.some(l=>this.data.links.some(current=>current.id===l.id)))throw Error('Связь с этим ID уже есть на карте.');
  await this.commit([...entry.data.atoms.map(atom=>({kind:'atom' as const,atom})),...links.map(link=>({kind:'link' as const,link})),{kind:'setting',key:'last-deletion',value:null},{kind:'setting',key:'last-deletion-summary',value:null}]);
  for(const atom of entry.data.atoms)this.emit('atom:create',atom);for(const link of links)this.emit('link:create',link);return [...ids];
 });}

 group(ids:string[],action:AtomState|'resume'|'pin'|'unpin'|'delete'){return this.serial(async()=>{const members=this.data.atoms.filter(a=>ids.includes(a.id)&&(action!=='resume'||a.paused===true));const ops:Mutation[]=[];if(action==='delete'){if(!members.length)return;const backups=await this.storage.getSetting<{at:string;data:Snapshot}[]>('backups')||[],selected=new Set(members.map(a=>a.id));ops.push({kind:'setting',key:'backups',value:[{at:new Date().toISOString(),data:this.data},...backups].slice(0,3)},{kind:'setting',key:'last-deletion-summary',value:{count:members.length}},{kind:'setting',key:'last-deletion',value:{version:1,data:{atoms:members,links:this.data.links.filter(l=>selected.has(l.from)||selected.has(l.to))}}});for(const a of members)ops.push({kind:'delete',id:a.id});}else for(const a of members)ops.push({kind:'atom',expectedRevision:a.revision,atom:transitionState(a,{...a,...(action==='pin'||action==='unpin'?{pinned:action==='pin',spatial:{resistance:0}}:action==='resume'?{paused:false}:action==='paused'?{paused:true}:{state:action}),revision:a.revision+1,updated_at:new Date().toISOString()})});await this.commit(ops);for(const op of ops){if(op.kind==='atom')this.emit('atom:update',op.atom);if(op.kind==='delete')this.emit('atom:delete',{id:op.id});}});}
 groupUpdate(ids:string[],patch:Partial<Pick<Atom,'importance'|'appearance'|'type'>>){return this.serial(async()=>{
  const members=this.data.atoms.filter(a=>ids.includes(a.id));
  await this.commit(members.map(a=>({kind:'atom',expectedRevision:a.revision,atom:{...a,...patch,revision:a.revision+1,updated_at:new Date().toISOString()}})));
  for(const a of this.data.atoms.filter(a=>ids.includes(a.id)))this.emit('atom:update',a);
 });}
 moveInto(ids:string[],target:string){return this.serial(async()=>{
  const selected=new Set(ids);const parent=this.data.atoms.find(a=>a.id===target);
  if(!parent||selected.has(target)||!ids.length||ids.some(id=>!this.data.atoms.some(a=>a.id===id)))throw Error('Выберите группу вне выделения.');
  // A grouped link has one parent. Moving a group must never make a cycle.
  const descendants=new Set(selected);let changed=true;
  while(changed){changed=false;for(const l of this.data.links)if(l.relation==='grouped'&&descendants.has(l.from)&&!descendants.has(l.to)){descendants.add(l.to);changed=true;}}
  if(descendants.has(target))throw Error('Нельзя переместить группу внутрь самой себя.');
  const internal=this.data.links.filter(l=>l.relation==='grouped'&&selected.has(l.from)&&selected.has(l.to));
  const roots=[...selected].filter(id=>!internal.some(l=>l.to===id));
  const removed=this.data.links.filter(l=>l.relation==='grouped'&&selected.has(l.to)&&!selected.has(l.from));
  const added=roots.map(id=>makeLink(target,id,'grouped','manual'));
  await this.commit([...removed.map(l=>({kind:'unlink' as const,id:l.id})),...added.map(link=>({kind:'link' as const,link}))]);
  for(const l of removed)this.emit('link:delete',{id:l.id});for(const l of added)this.emit('link:create',l);
 });}
 setTask(id:string,taskId:string,patch:{checked?:boolean;recurrence?:Recurrence|null;remove?:true}){const atom=this.data.atoms.find(a=>a.id===id);if(!atom)return Promise.reject(Error('Atom no longer exists.'));return this.update(id,taskPatch(atom,taskId,patch),atom.revision);}
 rollTasks(now=new Date()){return this.serial(async()=>{const ops:Mutation[]=[];for(const atom of this.data.atoms){const next=syncTasks(atom,undefined,now,true);if(next.content!==atom.content)ops.push({kind:'atom',expectedRevision:atom.revision,atom:{...next,revision:atom.revision+1,updated_at:new Date().toISOString()}});}if(ops.length){await this.commit(ops);for(const op of ops)if(op.kind==='atom')this.emit('atom:update',op.atom);}});}
 search(query:string):Atom[]{return this.searchIndex.search(query,this.data.atoms);}
}
