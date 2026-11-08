import {it,expect} from 'vitest';
import {createDaily,daily} from '../src/plugins/daily';
import {makeAtom,makeLink,type Atom,type Link} from '../src/core/model';
import {validateManifest,type PluginAPI} from '../src/plugins/api';
it('starts with a single daily note and no calendar setup',async()=>{
 const h=harness({});await createDaily(h.api,new Date(2026,8,17));
 expect(h.atoms).toHaveLength(1);expect(h.links).toHaveLength(0);
 expect(h.atoms[0].properties.dailyDate).toBe('2026-09-17');expect(h.atoms[0].state).toBe('normal');
});
it('places a daily near the camera in free space without linking an unrelated note',async()=>{
 const h=harness({});h.atoms.push(makeAtom({id:'unrelated',title:'Unrelated',x:1200,y:500}));
 const day=await createDaily(h.api,new Date(2026,10,8),undefined,undefined,{x:1200,y:500});
 expect(Math.hypot(day.x-1200,day.y-500)).toBeGreaterThan(160);expect(Math.hypot(day.x-1200,day.y-500)).toBeLessThan(400);expect(h.links).toHaveLength(0);expect(day.state).toBe('normal');
});
it('rapid daily commands share one creation and open the same day',async()=>{
 const h=harness({years:true,months:true,weeks:true});let run:(()=>unknown)|undefined;
 h.api.commands={add:(command:any)=>{run=command.run;}} as PluginAPI['commands'];
 await daily.activate(h.api);
 await Promise.all([run!(),run!(),run!()]);
 expect(h.atoms.filter(a=>a.properties.dailyDate)).toHaveLength(1);
 expect(h.atoms).toHaveLength(4);expect(h.links).toHaveLength(3);
});
it('last weeks stay inside their month and February respects leap years',async()=>{
 const h=harness({years:true,months:true,weeks:true});
 await createDaily(h.api,new Date(2028,1,29));
 await createDaily(h.api,new Date(2028,2,1));
 const feb=h.atoms.find(a=>a.properties.calendarKey==='2028-02-w5')!;
 const march=h.atoms.find(a=>a.properties.calendarKey==='2028-03-w1')!;
 expect(feb.title).toContain('29–29');expect(march.title).toContain('1–7');
 for(const [week,month] of [[feb,'2028-02'],[march,'2028-03']] as const){
  const parent=h.atoms.find(a=>a.properties.calendarKey===month)!;
  expect(h.links.some(l=>l.from===parent.id&&l.to===week.id)).toBe(true);
 }
});
function harness(settings:Record<string,unknown>){const atoms:Atom[]=[],links:Link[]=[];const api={atoms:{list:async()=>structuredClone(atoms),create:async(input:any)=>{const a=makeAtom(input);atoms.push(a);return a;}},links:{list:async()=>structuredClone(links),create:async(from:string,to:string)=>{const l=makeLink(from,to);links.push(l);return l;}},settings:{get:async(key:string)=>settings[key]},graph:{focus:()=>{}}} as unknown as PluginAPI;return{api,atoms,links};}
it('all calendar levels are optional, and repeated commands preserve existing notes',async()=>{
 for(const years of [false,true])for(const months of [false,true])for(const weeks of [false,true]){const h=harness({years,months,weeks});const a=await createDaily(h.api,new Date(2026,8,12));expect(new Set(h.atoms.map(a=>a.id)).size).toBe(1+Number(years)+Number(months)+Number(weeks));expect(new Set(h.links.map(l=>l.id)).size).toBe(Number(years)+Number(months)+Number(weeks));a.content='Keep my text';expect((await createDaily(h.api,new Date(2026,8,12))).content).toBe('Keep my text');expect(a.properties.dailyDate).toBe('2026-09-12');}
});
it('reuses month containers, orders newly created days, and formats local dates',async()=>{const h=harness({years:true,months:true,dayFormat:'{YYYY}-{MM}-{DD}'});const second=await createDaily(h.api,new Date(2026,1,2)),first=await createDaily(h.api,new Date(2026,1,1));expect(first.x).toBeLessThan(second.x);expect(first.title).toBe('2026-02-01');expect(new Set(h.atoms.map(a=>a.id)).size).toBe(4);validateManifest(daily.manifest);expect(()=>validateManifest({...daily.manifest,settings:[{key:'x',type:'boolean',default:'bad' as any,label:'x'}]})).toThrow();});
