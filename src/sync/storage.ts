import type {Database} from '../storage/schema';
import {makeAtom,type Atom,type Link,type Mutation} from '../core/model';
import {NOTE_TYPES_KEY} from '../core/note-types';
import {FOLDER_DEFINITIONS} from '../graph/folders';
import {canonical,semantic,mergeHeads,unionClock,hasConflict,validateRecord,RECORD_PREFIX,key,type SyncRecord,type Head,type Kind} from './records';
const actors=new WeakMap<Database,string>();
const counters=new WeakMap<Database,number>();
const durable=new WeakMap<Database,{id:string;device:string;counter:number}>();
/** Bind the local writer to this browser's non-exportable identity. A restored
 * backup resets this marker; another device never adopts the writer's counter. */
export function initializeActor(db:Database,device:string){
 const saved=get(db,'sync:local-actor');const state=saved?.device===device&&typeof saved.id==='string'&&/^[a-f0-9-]{36}$/.test(saved.id)&&Number.isSafeInteger(saved.counter)&&saved.counter>=0?saved:{id:crypto.randomUUID(),device,counter:0};
 actors.set(db,state.id);counters.set(db,state.counter);durable.set(db,state);
 db.exec({sql:'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',bind:['sync:local-actor',JSON.stringify(state)]});
}
function actor(db:Database){let value=actors.get(db);if(!value){value=crypto.randomUUID();actors.set(db,value);}return value;}
function get(db:Database,k:string){const value=db.selectValue('SELECT value FROM settings WHERE key=?',[k]);return value===undefined?undefined:JSON.parse(value);}
function put(db:Database,r:SyncRecord){db.exec({sql:'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',bind:[key(r),JSON.stringify(r)]});}
function atom(db:Database,id:string):Atom|null {const r=db.selectObjects('SELECT * FROM atoms WHERE id=?',[id])[0];return r?{...r,paused:Boolean(r.paused),pinned:Boolean(r.pinned),properties:JSON.parse(r.properties),appearance:JSON.parse(r.appearance),spatial:JSON.parse(r.spatial),aliases:db.selectObjects('SELECT alias FROM aliases WHERE atom_id=?',[id]).map(r=>r.alias)} as Atom:null;}
function value(db:Database,kind:Kind,id:string){return kind==='atom'?atom(db,id):kind==='link'?db.selectObjects('SELECT * FROM links WHERE id=?',[id])[0]??null:get(db,id)??null;}
function newHead(db:Database,v:Head['value'],base:Head[],branch=false):Head{const clock=unionClock(base),a=branch?crypto.randomUUID():actor(db),n=Math.max(counters.get(db)||0,clock[a]||0)+1;counters.set(db,n);clock[a]=n;const state=durable.get(db);if(state){state.counter=n;db.exec({sql:'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',bind:['sync:local-actor',JSON.stringify(state)]});}return{id:crypto.randomUUID(),clock,value:v,at:new Date().toISOString(),device:get(db,'sync:device-name')||'Устройство'};}
/** Called inside the same SQLite transaction as every ordinary write. */
export function trackLocal(db:Database,changes:Map<string,{kind:Kind;id:string;base?:Head[]}>){
 for(const target of changes.values()){
  const r:SyncRecord=get(db,key(target))??{...target,heads:[]},v=value(db,target.kind,target.id);
  if(r.heads.length&&r.heads.every(h=>semantic(h.value)===semantic(v)))continue;
  // Editing the visible version must not silently resolve the hidden versions.
  const next=newHead(db,v,target.base??r.heads.slice(0,1),hasConflict(r));r.heads=mergeHeads([...r.heads,next]);put(db,r);
 }
}
function basis(v:Head['value']){if(v&&!Array.isArray(v)&&'title' in v){const {x,y,spatial,...rest}=v as Atom;return semantic(rest as Atom);}return semantic(v);}
export function localChanges(db:Database,ops:Mutation[]){const result=new Map<string,{kind:Kind;id:string;base?:Head[]}>();const add=(kind:Kind,id:string)=>{const record=get(db,key({kind,id})) as SyncRecord|undefined,current=basis(value(db,kind,id));result.set(key({kind,id}),{kind,id,base:record?.heads.filter(h=>basis(h.value)===current)});};
 const removeLink=(id:string)=>{add('link',id);const edge=value(db,'link',id) as Link|null;if(!edge)return;
  // Concurrently created identical edges can have different UUIDs. Deleting
  // the visible edge must also tombstone the aliases already observed here.
  for(const row of db.selectObjects('SELECT value FROM settings WHERE substr(key,1,?)=?',[(RECORD_PREFIX+'link:').length,RECORD_PREFIX+'link:'])){
   const r=JSON.parse(row.value) as SyncRecord,base=r.heads.filter(h=>h.value&&(h.value as Link).from===edge.from&&(h.value as Link).to===edge.to&&(h.value as Link).relation===edge.relation);
   if(base.length)result.set(key(r),{kind:'link',id:r.id,base});
  }
 };
 for(const op of ops){if(op.kind==='atom')add('atom',op.atom.id);if(op.kind==='link')add('link',op.link.id);if(op.kind==='unlink')removeLink(op.id);if(op.kind==='setting'&&op.key===NOTE_TYPES_KEY)add('catalog',op.key);
  if(op.kind==='positions'&&op.manual)for(const p of op.positions)add('atom',p.id);
  if(op.kind==='delete'){add('atom',op.id);for(const l of db.selectObjects('SELECT id FROM links WHERE "from"=? OR "to"=?',[op.id,op.id]))removeLink(l.id);}
 }return result;
}
export function exportRecords(db:Database):SyncRecord[]{
 db.exec('BEGIN IMMEDIATE');try{
  const missing=new Map<string,{kind:Kind;id:string}>();
  for(const kind of ['atom','link'] as const)for(const r of db.selectObjects(`SELECT id FROM ${kind==='atom'?'atoms':'links'}`))if(!get(db,key({kind,id:r.id})))missing.set(r.id,{kind,id:r.id});
  if(get(db,NOTE_TYPES_KEY)!==undefined&&!get(db,key({kind:'catalog',id:NOTE_TYPES_KEY})))missing.set(NOTE_TYPES_KEY,{kind:'catalog',id:NOTE_TYPES_KEY});
  trackLocal(db,missing);db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 return db.selectObjects('SELECT value FROM settings WHERE substr(key,1,?)=?',[RECORD_PREFIX.length,RECORD_PREFIX]).map(row=>JSON.parse(row.value));
}
export function conflicts(db:Database){return db.selectObjects('SELECT value FROM settings WHERE substr(key,1,?)=?',[RECORD_PREFIX.length,RECORD_PREFIX]).map(row=>JSON.parse(row.value) as SyncRecord).filter(hasConflict);}
type Transact=(db:Database,ops:Mutation[],remote?:boolean)=>void;
function materialize(db:Database,records:SyncRecord[],write:Transact){
 const ops:Mutation[]=[],linkRecords=db.selectObjects('SELECT value FROM settings WHERE substr(key,1,?)=?',[(RECORD_PREFIX+'link:').length,RECORD_PREFIX+'link:']).map(row=>JSON.parse(row.value) as SyncRecord);
 for(const r of records){const v=r.heads[0].value;
  if(r.kind==='atom'){const before=atom(db,r.id);if(v===null){if(before)ops.push({kind:'delete',id:r.id});}else if(!before||semantic(before)!==semantic(v)){const next={...v as Atom,revision:before?before.revision+1:1};ops.push({kind:'atom',atom:next,expectedRevision:before?.revision});}}
  if(r.kind==='catalog'&&v!==null)ops.push({kind:'setting',key:NOTE_TYPES_KEY,value:v});
 }
 // Rebuild touched edges only after both endpoint atoms have been materialized.
 if(ops.length)write(db,ops,true);
 const edgeOps:Mutation[]=[],desired=new Map<string,Link>();
 for(const r of [...linkRecords].sort((a,b)=>a.id.localeCompare(b.id))){const v=r.heads[0].value as Link|null;if(v&&atom(db,v.from)&&atom(db,v.to)){const tuple=canonical([v.from,v.to,v.relation]);if(!desired.has(tuple))desired.set(tuple,v);}}
 const existing=db.selectObjects('SELECT * FROM links') as Link[];
 for(const l of existing){const wanted=desired.get(canonical([l.from,l.to,l.relation]));if(!wanted||canonical(l)!==canonical(wanted))edgeOps.push({kind:'unlink',id:l.id});}
 for(const l of desired.values())if(!existing.some(before=>canonical(before)===canonical(l)))edgeOps.push({kind:'link',link:l});
 if(edgeOps.length)write(db,edgeOps,true);
}
/** One transaction for versions AND their materialized graph; no partial import. */
export function applyRecords(db:Database,input:unknown,write:Transact){
 if(!Array.isArray(input)||input.length>150000)throw Error('Слишком большая карта для синхронизации.');
 const seen=new Set<string>();for(const r of input){validateRecord(r);if(seen.has(key(r)))throw Error('Повтор записи.');seen.add(key(r));}
 // Bootstrap old local records before comparing a first sync.
 exportRecords(db);db.exec('BEGIN IMMEDIATE');try{
  const changed:SyncRecord[]=[];
  for(const incoming of input as SyncRecord[]){const local=get(db,key(incoming)) as SyncRecord|undefined;const r={...incoming,heads:mergeHeads([...(local?.heads||[]),...incoming.heads])};if(canonical(local)!==canonical(r)){put(db,r);changed.push(r);}}
  // Edges previously blocked by an endpoint deletion can become valid on restore.
  const all=db.selectObjects('SELECT value FROM settings WHERE substr(key,1,?)=?',[RECORD_PREFIX.length,RECORD_PREFIX]).map(r=>JSON.parse(r.value) as SyncRecord);
  materialize(db,[...changed.filter(r=>r.kind!=='link'),...all.filter(r=>r.kind==='link')],write);
  db.exec('COMMIT');return{received:changed.length,conflicts:all.filter(hasConflict).length};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function resolveConflict(db:Database,k:string,expected:string,choice:string,write:Transact){
 db.exec('BEGIN IMMEDIATE');try{
  const r=get(db,k) as SyncRecord|undefined;if(!r||key(r)!==k||canonical(r)!==expected)throw Error('Версии уже изменились. Откройте сравнение ещё раз.');
  const chosen=r.heads.find(h=>h.id===choice),both=choice==='both';if(!chosen&&!both)throw Error('Выберите версию.');
  const kept=chosen??r.heads.find(h=>h.value!==null)??r.heads[0];
  const next={...r,heads:[newHead(db,kept.value,r.heads)]};put(db,next);materialize(db,[next],write);
  if(both&&r.kind==='atom')for(const h of r.heads.filter(h=>h!==kept&&h.value!==null)){
   const source=h.value as Atom,properties={...source.properties};delete properties[FOLDER_DEFINITIONS];
   const copy=makeAtom({...source,id:crypto.randomUUID(),revision:1,title:(source.title+' · другая версия').slice(0,500),properties,x:source.x+180,y:source.y+140});
   // This new independent note gets its own durable sync history.
   write(db,[{kind:'atom',atom:copy}],true);trackLocal(db,new Map([[copy.id,{kind:'atom',id:copy.id}]]));
   const links=db.selectObjects('SELECT * FROM links WHERE "from"=? OR "to"=?',[r.id,r.id]) as Link[];
   for(const l of links){const edge={...l,id:crypto.randomUUID(),from:l.from===r.id?copy.id:l.from,to:l.to===r.id?copy.id:l.to};write(db,[{kind:'link',link:edge}],true);trackLocal(db,new Map([[edge.id,{kind:'link',id:edge.id}]]));}
  }
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}
