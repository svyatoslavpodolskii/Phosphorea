import {it,expect} from 'vitest';
import {noteTypes,NOTE_TYPES_KEY} from '../src/core/note-types';
import {exportBackup,parseBackup,importBackup} from '../src/core/backup';
import {makeAtom,type Mutation} from '../src/core/model';
import type {Core} from '../src/core/core';
it('catalog has a safe base type, validates IDs and preserves templates',()=>{
 expect(noteTypes(undefined).some(t=>t.id==='hub')).toBe(false);
 expect(noteTypes([{id:'custom-a',name:'Сон',content:'## Утро',icon:'icon:idea'}]).map(t=>t.id)).toEqual(['note','custom-a']);
 expect(()=>noteTypes([{id:'bad:id',name:'X'}])).toThrow();
 expect(()=>noteTypes([{id:'a',name:'X'},{id:'a',name:'Y'}])).toThrow();
});
it('JSON exports and imports custom types with notes in one transaction without replacing existing definitions',async()=>{
 const custom={id:'custom-dream',name:'Сон',content:'## Сон',icon:'icon:idea',appearance:{color:'#e9b482'}},atom=makeAtom({title:'Сон',type:custom.id,content:'Текст'});
 const data=parseBackup(exportBackup({atoms:[atom],links:[]},[custom]));expect(data.noteTypes).toContainEqual(custom);
 let operations:Mutation[]=[];const existing={id:'note',name:'Моя заметка',icon:'icon:note'};
 const core={data:{atoms:[],links:[]},storage:{getSetting:async()=>[existing]},commit:async(ops:Mutation[])=>{operations=ops;},emit:()=>{}} as unknown as Core;
 expect(await importBackup(core,data)).toBe(1);expect(operations.some(op=>op.kind==='atom'&&op.atom.id===atom.id)).toBe(true);
 const setting=operations.find(op=>op.kind==='setting'&&op.key===NOTE_TYPES_KEY);expect(setting?.kind==='setting'&&setting.value).toEqual([existing,custom]);
});
it('older JSON copies still import without changing type settings',()=>{const old={format:'phosphored',version:1,data:{atoms:[],links:[]}};expect(parseBackup(JSON.stringify(old)).noteTypes).toBeUndefined();});
