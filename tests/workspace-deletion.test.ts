import {it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {migrate,type Database} from '../src/storage/schema';
import {changeWorkspace,catalog,removeWorkspace} from '../src/storage/workspaces';
import {transact,snapshot} from '../src/storage/operations';
import {makeAtom,makeLink} from '../src/core/model';
it('deletes root contents and attachments atomically while retaining the catalog and other workspaces',()=>{
 const raw=new DatabaseSync(':memory:');const db:Database={exec(q){if(typeof q==='string')raw.exec(q);else raw.prepare(q.sql).run(...q.bind||[]);},selectValue(q,b=[]){const row=raw.prepare(q).get(...b);return row?Object.values(row)[0]:undefined;},selectObjects(q,b=[]){return raw.prepare(q).all(...b);}};
 try{migrate(db);const a=makeAtom({title:'A',aliases:['Alias']}),b=makeAtom({title:'B'});transact(db,[{kind:'atom',atom:a},{kind:'atom',atom:b},{kind:'link',link:makeLink(a.id,b.id)},{kind:'setting',key:'attachment',value:'bytes'},{kind:'setting',key:'sync:scope-id',value:'scope-root'},{kind:'setting',key:'sync:trusted:test',value:[{id:'paired'}]},{kind:'setting',key:'disabled-builtins',value:['builtin.audio']}]);
  expect(()=>removeWorkspace(db,'default')).toThrow();expect(snapshot(db).atoms).toHaveLength(2);
  const next=changeWorkspace(db,'create','Other');const other=next.items[1].id;
  expect(removeWorkspace(db,'default')).toEqual({current:other,items:[{id:other,name:'Other'}]});
  expect(JSON.parse(db.selectValue("SELECT value FROM settings WHERE key='sync:excluded-scopes'"))).toEqual(['scope-root']);
  expect(JSON.parse(db.selectValue("SELECT value FROM settings WHERE key='sync:trusted:test'"))).toEqual([{id:'paired'}]);expect(JSON.parse(db.selectValue("SELECT value FROM settings WHERE key='disabled-builtins'"))).toEqual(['builtin.audio']);
  expect(snapshot(db)).toEqual({atoms:[],links:[]});expect(db.selectValue("SELECT value FROM settings WHERE key='attachment'")).toBeUndefined();
  expect(db.selectValue('SELECT count(*) FROM aliases')).toBe(0);expect(()=>removeWorkspace(db,other)).toThrow();expect(catalog(db).current).toBe(other);
  const third=changeWorkspace(db,'create','Third').items[1].id;removeWorkspace(db,other,'scope-other');expect(JSON.parse(db.selectValue("SELECT value FROM settings WHERE key='sync:excluded-scopes'"))).toEqual(['scope-root','scope-other']);
  expect(catalog(db).current).toBe(third);expect(JSON.parse(db.selectValue("SELECT value FROM settings WHERE key='workspace-deletions'"))).toEqual([other]);
 }finally{raw.close();}
});
