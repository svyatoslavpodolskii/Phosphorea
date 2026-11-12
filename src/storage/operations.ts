import {transitionState,validateAtom,validateLink,type Mutation,type Atom,type Snapshot} from '../core/model';
import type {Database} from './schema';
import {localChanges,trackLocal} from '../sync/storage';
/** Only retry explicit SQLite lock failures after transact has rolled back.
 * Validation, revision conflicts and I/O failures must reach the caller unchanged. */
export async function transactWithRetry(db:Database,ops:Mutation[]){
 const delays=[40,120];
 for(let attempt=0;;attempt++){
  try{return transact(db,ops);}catch(error){
   const code=typeof error==='object'&&error!==null?(error as {resultCode?:number}).resultCode:undefined;
   const primary=typeof code==='number'?code&0xff:undefined;
   if((primary!==5&&primary!==6)||attempt>=delays.length)throw error; // SQLITE_BUSY / SQLITE_LOCKED
   await new Promise<void>(resolve=>setTimeout(resolve,delays[attempt]));
  }
 }
}
export function snapshot(db:Database):Snapshot {
 const aliases=new Map<string,string[]>();
 for(const r of db.selectObjects('SELECT * FROM aliases')) {const list=aliases.get(r.atom_id)||[];list.push(r.alias);aliases.set(r.atom_id,list);}
 return {atoms:db.selectObjects('SELECT * FROM atoms').map(r=>({...r,paused:Boolean(r.paused),pinned:Boolean(r.pinned),spatial:JSON.parse(r.spatial),properties:JSON.parse(r.properties),appearance:JSON.parse(r.appearance),aliases:aliases.get(r.id)||[]} as Atom)),links:db.selectObjects('SELECT * FROM links')};
}
export function transact(db:Database,ops:Mutation[],remote=false) {
 if(!Array.isArray(ops)||ops.length>100_000) throw Error('Слишком большая транзакция.');
 if(!remote)db.exec('BEGIN IMMEDIATE');
 try {const changes=remote?null:localChanges(db,ops);for(const op of ops) {
 if(op.kind==='atom') {
 validateAtom(op.atom);const a=transitionState(undefined,op.atom);
 const revision=db.selectValue('SELECT revision FROM atoms WHERE id=?',[a.id]);
 if(op.expectedRevision!==undefined ? revision!==op.expectedRevision : revision!==undefined) throw Error('Атом уже изменён. Откройте его заново перед сохранением.');
 db.exec({sql:`INSERT INTO atoms(id,type,title,content,state,importance,created_at,updated_at,properties,appearance,x,y,revision,pinned,spatial,paused) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET type=excluded.type,title=excluded.title,content=excluded.content,state=excluded.state,importance=excluded.importance,updated_at=excluded.updated_at,properties=excluded.properties,appearance=excluded.appearance,x=excluded.x,y=excluded.y,revision=excluded.revision,pinned=excluded.pinned,spatial=excluded.spatial,paused=excluded.paused`,bind:[a.id,a.type,a.title,a.content,a.state,a.importance,a.created_at,a.updated_at,JSON.stringify(a.properties),JSON.stringify(a.appearance),a.x,a.y,a.revision,Number(a.pinned),JSON.stringify(a.spatial),Number(a.paused)]});
 db.exec({sql:'DELETE FROM aliases WHERE atom_id=?',bind:[a.id]});
 for(const alias of new Set(a.aliases.map(x=>x.trim()).filter(Boolean))) db.exec({sql:'INSERT INTO aliases VALUES(?,?)',bind:[a.id,alias]});
 } else if(op.kind==='link') {validateLink(op.link); const l=op.link;db.exec({sql:'INSERT INTO links VALUES(?,?,?,?,?,?) ON CONFLICT("from","to",relation) DO NOTHING',bind:[l.id,l.from,l.to,l.relation,l.source,l.created_at]});}
 else if(op.kind==='unlink') db.exec({sql:'DELETE FROM links WHERE id=?',bind:[op.id]});
 else if(op.kind==='delete') db.exec({sql:'DELETE FROM atoms WHERE id=?',bind:[op.id]});
 else if(op.kind==='positions') {if(op.positions.length>5000)throw Error('Слишком много перемещений.');for(const p of op.positions){if(![p.x,p.y].every(Number.isFinite)||Math.abs(p.x)>1e7||Math.abs(p.y)>1e7||p.resistance!==undefined&&(!Number.isFinite(p.resistance)||p.resistance<0||p.resistance>10000))throw Error('Некорректное перемещение.');db.exec({sql:'UPDATE atoms SET x=?,y=?,spatial=COALESCE(?,spatial) WHERE id=?'+(op.manual?'':' AND pinned=0'),bind:[p.x,p.y,p.resistance===undefined?null:JSON.stringify({resistance:p.resistance}),p.id]});}}
 else if(op.kind==='setting') {if(op.key==='note-assets'){if(!Array.isArray(op.value)||op.value.length>100000||op.value.some((id:any)=>typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id)))throw Error('Invalid attachment index');op.value=[...new Set([...JSON.parse(db.selectValue('SELECT value FROM settings WHERE key=?',[op.key])||'[]'),...op.value])];}if(typeof op.key!=='string'||op.key.length>300||JSON.stringify(op.value).length>(op.key==='backups'?100_000_000:10_000_000)) throw Error('Некорректная настройка.');db.exec({sql:'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',bind:[op.key,JSON.stringify(op.value)]});}
 else throw Error('Неизвестная операция.');
 } if(changes)trackLocal(db,changes);if(!remote)db.exec('COMMIT'); }catch(e){if(!remote)try{db.exec('ROLLBACK');}catch(rollbackError){throw new AggregateError([e,rollbackError],'Не удалось отменить запись. Перезапустите приложение перед повторным сохранением.');}throw e;}
}
