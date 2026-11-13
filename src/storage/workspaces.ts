import type {Database} from './schema';
import {profileSetting} from '../sync/profile';
export const EXCLUDED_SCOPES='sync:excluded-scopes';
export interface Workspace {id:string;name:string}
export interface WorkspaceCatalog {current:string;items:Workspace[]}
/** The catalog and deletion journal share one durable transaction. */
export function removeWorkspace(db:Database,id:string,deletedScope?:string):WorkspaceCatalog{
 const next=catalog(db);
 if(!next.items.some(w=>w.id===id))throw Error('Хранилище не найдено.');
 if(next.items.length<2)throw Error('Нельзя удалить последнее хранилище. Сначала создайте новое.');
 next.items=next.items.filter(w=>w.id!==id);
 if(next.current===id)next.current=next.items[0].id;
 db.exec('BEGIN IMMEDIATE');
 try{
  const scope=deletedScope?JSON.stringify(deletedScope):id==='default'?db.selectValue("SELECT value FROM settings WHERE key='sync:scope-id'"):undefined;
  if(scope){const excluded=JSON.parse(db.selectValue('SELECT value FROM settings WHERE key=?',[EXCLUDED_SCOPES])||'[]');db.exec({sql:'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',bind:[EXCLUDED_SCOPES,JSON.stringify([...new Set([...excluded,JSON.parse(scope)])])]});}
  if(id==='default'){
   db.exec('DELETE FROM atoms');db.exec('DELETE FROM plugin_data');
   for(const {key} of db.selectObjects('SELECT key FROM settings'))if(!profileSetting(key)&&!['workspace-catalog','workspace-deletions',EXCLUDED_SCOPES,'sync:device-name','sync:visual','sync:plugins','sync:local-actor','sync:profile-ready'].includes(key)&&!key.startsWith('sync:trusted:')&&!key.startsWith('sync:record:setting:'))db.exec({sql:'DELETE FROM settings WHERE key=?',bind:[key]});
  }else{
   const pending=JSON.parse(db.selectValue("SELECT value FROM settings WHERE key='workspace-deletions'")||'[]') as string[];
   db.exec({sql:'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',bind:['workspace-deletions',JSON.stringify([...new Set([...pending,id])])]});
  }
  db.exec({sql:'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',bind:['workspace-catalog',JSON.stringify(next)]});
  db.exec('COMMIT');return next;
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function catalog(db:Database):WorkspaceCatalog{const raw=db.selectValue('SELECT value FROM settings WHERE key=?',['workspace-catalog']);return raw===undefined?{current:'default',items:[{id:'default',name:'Основное'}]}:JSON.parse(raw);}
export function changeWorkspace(db:Database,action:'create'|'rename'|'select',nameOrId:string,id?:string):WorkspaceCatalog{
 const next=catalog(db);
 if(action==='select'){if(!next.items.some(w=>w.id===nameOrId))throw Error('Хранилище не найдено.');next.current=nameOrId;}
 else{const name=nameOrId.trim();if(!name||name.length>80)throw Error('Введите название от 1 до 80 символов.');if(next.items.some(w=>w.id!==id&&w.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw Error('Хранилище с таким названием уже есть.');if(action==='create')next.items.push({id:crypto.randomUUID(),name});else{const item=next.items.find(w=>w.id===id);if(!item)throw Error('Хранилище не найдено.');item.name=name;}}
 db.exec('BEGIN IMMEDIATE');try{db.exec({sql:'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',bind:['workspace-catalog',JSON.stringify(next)]});db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return next;
}
