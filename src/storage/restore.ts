import {migrate,type Database} from './schema';
import {snapshot} from './operations';
import {validateAtom,validateLink} from '../core/model';
const tables=['atoms','aliases','links','settings','plugin_data','schema_metadata'];
/** Only the staged database is migrated. Current data changes in one transaction. */
export function restoreDatabase(current:Database,staged:Database){
 staged.exec('PRAGMA trusted_schema=OFF');
 if(staged.selectObjects("SELECT name FROM sqlite_master WHERE type IN ('view','trigger')").length)throw Error('Недопустимые объекты в копии.');
 const sourceTables=staged.selectObjects("SELECT name FROM sqlite_master WHERE type='table'").map(r=>r.name);
 if(sourceTables.length!==tables.length||sourceTables.some(t=>!tables.includes(t)))throw Error('Неизвестная структура копии.');
 migrate(staged);
 for(const table of tables){
  const columns=(database:Database)=>database.selectObjects(`PRAGMA table_info("${table}")`).map(r=>r.name).sort().join(',');
  if(columns(current)!==columns(staged))throw Error('Столбцы копии не соответствуют версии приложения.');
 }
 const data=snapshot(staged);for(const atom of data.atoms)validateAtom(atom);for(const link of data.links)validateLink(link);
 const rows=new Map(tables.map(table=>[table,staged.selectObjects(`SELECT * FROM "${table}"`)]));
 for(const table of ['settings','plugin_data'])for(const row of rows.get(table)!)JSON.parse(row.value);
 // A backup belongs to one workspace, never to the device-wide catalog.
 const catalog=current.selectValue("SELECT value FROM settings WHERE key='workspace-catalog'");
 current.exec('BEGIN IMMEDIATE');
 try{
  for(const table of ['links','aliases','atoms','settings','plugin_data','schema_metadata'])current.exec(`DELETE FROM "${table}"`);
  for(const table of tables){
   const columns=current.selectObjects(`PRAGMA table_info("${table}")`).map(r=>r.name as string);
   const sql=`INSERT INTO "${table}" (${columns.map(c=>'"'+c+'"').join(',')}) VALUES (${columns.map(()=>'?').join(',')})`;
   for(const row of rows.get(table)!){if(table==='settings'&&row.key==='workspace-catalog')continue;current.exec({sql,bind:columns.map(c=>row[c])});}
  }
  if(catalog!==undefined)current.exec({sql:'INSERT INTO settings VALUES(?,?)',bind:['workspace-catalog',catalog]});
  // A restore is a new branch even on the same physical device. Never reuse
  // counters from a copied/older database to overwrite unseen offline edits.
  current.exec({sql:'DELETE FROM settings WHERE key=?',bind:['sync:local-actor']});
  current.exec({sql:'DELETE FROM settings WHERE substr(key,1,?)=?',bind:['sync:trusted:'.length,'sync:trusted:']});
  if(current.selectObjects('PRAGMA foreign_key_check').length)throw Error('Нарушены связи в копии.');
  current.exec('COMMIT');
 }catch(e){current.exec('ROLLBACK');throw e;}
}
