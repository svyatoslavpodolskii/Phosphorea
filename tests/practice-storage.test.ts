import {it,expect} from 'vitest';
import {PracticeStorage} from '../src/core/practice-storage';
import {makeAtom} from '../src/core/model';
import {releasesSince,currentRelease} from '../src/ui/releases';
it('keeps practice drafts isolated and rolls back invalid transactions',async()=>{
 const first=new PracticeStorage(),second=new PracticeStorage(),atom=makeAtom({title:'Practice'});
 await first.transaction([{kind:'atom',atom},{kind:'setting',key:'editor-checkpoint-v1',value:{draft:atom}}]);
 expect((await second.snapshot()).atoms).toEqual([]);expect(await second.getSetting('editor-checkpoint-v1')).toBeUndefined();
 atom.title='Changed outside';expect((await first.snapshot()).atoms[0].title).toBe('Practice');
 await expect(first.transaction([{kind:'delete',id:atom.id},{kind:'atom',atom:{...atom,title:''}}])).rejects.toThrow();expect((await first.snapshot()).atoms).toHaveLength(1);
 first.close();expect((await first.snapshot()).atoms).toEqual([]);expect(await first.getSetting('editor-checkpoint-v1')).toBeUndefined();
});
it('lists every missed release using numeric version order',()=>{
 const missed=releasesSince('0.9.3').map(r=>r.version);
 expect(missed.slice(-5)).toEqual(['0.10.0','0.9.7','0.9.6','0.9.5','0.9.4']);
 expect(missed[0]).toBe(currentRelease.version);
 const afterMinor=releasesSince('0.9.7').map(r=>r.version);
 expect(afterMinor).not.toContain('0.9.7');
 expect(afterMinor).toEqual([...afterMinor].sort(new Intl.Collator('en',{numeric:true}).compare).reverse());
 expect(afterMinor.at(-1)).toBe('0.10.0');
 expect(releasesSince(currentRelease.version)).toEqual([]);
 expect(releasesSince(null).length).toBeGreaterThan(1);
});
