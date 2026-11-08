import {it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {migrate,type Database} from '../src/storage/schema';
import {snapshot,transact} from '../src/storage/operations';
import {exportRecords,applyRecords,conflicts,resolveConflict,initializeActor} from '../src/sync/storage';
import {canonical,key,mergeHeads,hasConflict,type Head} from '../src/sync/records';
import {makeAtom,makeLink} from '../src/core/model';
import {generateIdentity,createHello,establish,sign,verify,parseInvitation,b64,peerId} from '../src/sync/crypto';
import {restoreDatabase} from '../src/storage/restore';
function database(){const raw=new DatabaseSync(':memory:');const db:Database={exec(q){if(typeof q==='string')raw.exec(q);else raw.prepare(q.sql).run(...q.bind||[]);},selectValue(q,b=[]){const row=raw.prepare(q).get(...b);return row?Object.values(row)[0]:undefined;},selectObjects(q,b=[]){return raw.prepare(q).all(...b);}};migrate(db);return db;}
const send=(from:Database,to:Database)=>applyRecords(to,structuredClone(exportRecords(from)),transact);
const edit=(db:Database,id:string,content:string)=>{const before=snapshot(db).atoms.find(a=>a.id===id)!;transact(db,[{kind:'atom',atom:{...before,content,revision:before.revision+1},expectedRevision:before.revision}]);};
it('exchanges both directions and preserves equal-revision independent offline edits',()=>{
 const a=database(),b=database(),note=makeAtom({title:'Diary',pinned:true});transact(a,[{kind:'atom',atom:note}]);send(a,b);send(b,a);
 edit(a,note.id,'Computer edit');edit(b,note.id,'Phone edit');send(a,b);send(b,a);
 for(const db of [a,b]){const list=conflicts(db);expect(list).toHaveLength(1);expect(list[0].heads.map(h=>(h.value as any).content).sort()).toEqual(['Computer edit','Phone edit']);}
 expect(exportRecords(a)).toEqual(exportRecords(b));
 const r=conflicts(a)[0];resolveConflict(a,key(r),canonical(r),'both',transact);send(a,b);send(b,a);
 expect(conflicts(a)).toHaveLength(0);expect(conflicts(b)).toHaveLength(0);expect(snapshot(b).atoms.map(a=>a.content).sort()).toEqual(['Computer edit','Phone edit']);
});
it('keeps an edit when a different device deleted the note, and transfers an explicit resolution',()=>{
 const a=database(),b=database(),note=makeAtom({title:'Keep me'});transact(a,[{kind:'atom',atom:note}]);send(a,b);send(b,a);
 transact(a,[{kind:'delete',id:note.id}]);edit(b,note.id,'Offline text');send(a,b);send(b,a);const r=conflicts(b)[0];expect(r.heads.some(h=>h.value===null)).toBe(true);
 const keep=r.heads.find(h=>h.value!==null)!;resolveConflict(b,key(r),canonical(r),keep.id,transact);send(b,a);expect(snapshot(a).atoms[0].content).toBe('Offline text');expect(conflicts(a)).toHaveLength(0);
});
it('does not revive deleted notes or their edges on repeat exchange',()=>{
 const a=database(),b=database(),x=makeAtom({title:'X'}),y=makeAtom({title:'Y'});transact(a,[{kind:'atom',atom:x},{kind:'atom',atom:y},{kind:'link',link:makeLink(x.id,y.id)}]);send(a,b);send(b,a);transact(a,[{kind:'delete',id:x.id}]);
 for(let i=0;i<3;i++){send(a,b);send(b,a);}expect(snapshot(b).atoms.map(a=>a.id)).toEqual([y.id]);expect(snapshot(b).links).toHaveLength(0);expect(conflicts(b)).toHaveLength(0);
});
it('records manual positioning and rejects corrupted imports without partial data',()=>{
 const a=database(),b=database(),n=makeAtom({title:'Move'});transact(a,[{kind:'atom',atom:n}]);send(a,b);transact(a,[{kind:'positions',positions:[{id:n.id,x:210,y:-90}],manual:true}]);send(a,b);expect(snapshot(b).atoms[0]).toMatchObject({x:210,y:-90});
 const before=snapshot(b),records=structuredClone(exportRecords(a));(records[0].heads[0].value as any).title='';expect(()=>applyRecords(b,records,transact)).toThrow();expect(snapshot(b)).toEqual(before);
});
it('does not silently resolve another version when continuing to edit a conflict',()=>{
 const a=database(),b=database(),n=makeAtom({title:'Conflict'});transact(a,[{kind:'atom',atom:n}]);send(a,b);send(b,a);edit(a,n.id,'A');edit(b,n.id,'B');send(a,b);send(b,a);edit(a,n.id,'Continued');send(a,b);
 expect(conflicts(b)).toHaveLength(1);expect(conflicts(b)[0].heads.some(h=>(h.value as any)?.content==='Continued')).toBe(true);
 const old=conflicts(b)[0];edit(b,n.id,'Another');expect(()=>resolveConflict(b,key(old),canonical(old),'both',transact)).toThrow('Версии уже изменились');
});
it('join is commutative, associative and idempotent even for identical text',()=>{
 const actor=()=>crypto.randomUUID(),a=actor(),b=actor(),c=actor();const h=(clock:Record<string,number>,content:string):Head=>({id:crypto.randomUUID(),clock,value:makeAtom({id:'same',title:'Note',content,created_at:'2026-01-01',updated_at:'2026-01-01'}),device:'Device',at:'2026-01-01'});
 const one=h({[a]:1},'same'),two=h({[b]:1},'same'),three=h({[a]:1,[c]:1},'changed');
 expect(mergeHeads([one,two])).toEqual(mergeHeads([two,one]));expect(mergeHeads([one,one])).toEqual([one]);expect(mergeHeads([...mergeHeads([one,two]),three])).toEqual(mergeHeads([one,...mergeHeads([two,three])]));expect(hasConflict({kind:'atom',id:'same',heads:[one,two]})).toBe(false);
});
it('derives matching emoji, authenticates identities and rejects tampering, replay and wrong QR secrets',async()=>{
 const a=await generateIdentity(),b=await generateIdentity(),ha=await createHello(a,'A'),hb=await createHello(b,'B');
 expect(a.privateKey.extractable).toBe(false);const [ca,cb]=await Promise.all([establish(ha,hb.hello,'host','secret'),establish(hb,ha.hello,'guest','secret')]);expect(ca.emojis).toEqual(cb.emojis);expect(ca.emojis).toHaveLength(6);
 await verify(a.publicKey,ca.transcript,await sign(a,ca.transcript));await expect(verify(b.publicKey,ca.transcript,await sign(a,ca.transcript))).rejects.toThrow();
 const sealed=await ca.seal({text:'Private diary'});expect(new TextDecoder().decode(sealed)).not.toContain('Private diary');expect(await cb.open(sealed)).toEqual({text:'Private diary'});await expect(cb.open(sealed)).rejects.toThrow('Повтор');
 const wrong=await establish(hb,ha.hello,'guest','another secret');await expect(wrong.open(await ca.seal({text:'secret'}))).rejects.toThrow();
 const damaged=await ca.seal({text:'secret'});new Uint8Array(damaged)[20]^=1;const fresh=await establish(hb,ha.hello,'guest','secret');await expect(fresh.open(damaged)).rejects.toThrow();
});
it('rejects expired and malformed invitations',()=>{
 const good={v:1,key:'a'.repeat(43),peer:peerId('a'.repeat(43)),secret:b64(new Uint8Array(32)),expires:Date.now()+300000};const url=(v:unknown)=>'https://example.test/#pair='+b64(new TextEncoder().encode(JSON.stringify(v)));
 expect(parseInvitation(url(good)).key).toBe(good.key);expect(()=>parseInvitation(url({...good,expires:1}))).toThrow();expect(()=>parseInvitation('javascript:alert(1)')).toThrow();
});
it('removes observed aliases of concurrently created identical links without resurrection',()=>{
 const a=database(),b=database(),x=makeAtom({title:'X'}),y=makeAtom({title:'Y'});transact(a,[{kind:'atom',atom:x},{kind:'atom',atom:y}]);send(a,b);send(b,a);
 transact(a,[{kind:'link',link:makeLink(x.id,y.id)}]);transact(b,[{kind:'link',link:makeLink(x.id,y.id)}]);send(a,b);send(b,a);expect(snapshot(a).links).toEqual(snapshot(b).links);
 transact(a,[{kind:'unlink',id:snapshot(a).links[0].id}]);for(let i=0;i<3;i++){send(a,b);send(b,a);}expect(snapshot(a).links).toHaveLength(0);expect(snapshot(b).links).toHaveLength(0);
});
it('a local edit after untracked ambient physics still descends from its received version',()=>{
 const a=database(),b=database(),n=makeAtom({title:'Received'});transact(a,[{kind:'atom',atom:n}]);send(a,b);transact(b,[{kind:'positions',positions:[{id:n.id,x:30,y:40}],manual:false}]);edit(b,n.id,'Edited on phone');send(b,a);expect(conflicts(a)).toHaveLength(0);expect(snapshot(a).atoms[0].content).toBe('Edited on phone');
});
it('reuses the writer across restarts but rotates it on another browser or restored branch',()=>{
 const db=database(),n=makeAtom({title:'Durable'});initializeActor(db,'browser-a');transact(db,[{kind:'atom',atom:n}]);const first=exportRecords(db)[0].heads[0];initializeActor(db,'browser-a');edit(db,n.id,'After restart');const second=exportRecords(db)[0].heads[0];expect(Object.keys(second.clock)).toEqual(Object.keys(first.clock));
 initializeActor(db,'browser-b');edit(db,n.id,'Another device');expect(Object.keys(exportRecords(db)[0].heads[0].clock)).toHaveLength(2);
 db.exec({sql:'DELETE FROM settings WHERE key=?',bind:['sync:local-actor']});initializeActor(db,'browser-b');edit(db,n.id,'Restored branch');expect(Object.keys(exportRecords(db)[0].heads[0].clock)).toHaveLength(3);
});
it('full restore preserves causal history but cannot import device trust or reuse a copied writer',()=>{
 const source=database(),target=database(),n=makeAtom({title:'Backup history'});initializeActor(source,'browser-a');transact(source,[{kind:'atom',atom:n},{kind:'setting',key:'sync:trusted:browser-a',value:[{id:'unverified'}]}]);const before=exportRecords(source);
 restoreDatabase(target,source);expect(exportRecords(target)).toEqual(before);expect(target.selectValue('SELECT value FROM settings WHERE key=?',['sync:trusted:browser-a'])).toBeUndefined();initializeActor(target,'browser-a');edit(target,n.id,'After restore');expect(Object.keys(exportRecords(target)[0].heads[0].clock)).toHaveLength(2);
});
it('all random fingerprints map to valid PeerJS identifiers including adjacent URL-safe separators',()=>{
 for(let i=0;i<1000;i++)expect(peerId(b64(crypto.getRandomValues(new Uint8Array(32))))).toMatch(/^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/);
});
