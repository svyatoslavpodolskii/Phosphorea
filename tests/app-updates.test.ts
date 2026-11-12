import {it,expect,vi,afterEach} from 'vitest';
const worker=vi.hoisted(()=>({callbacks:{} as any}));
vi.mock('virtual:pwa-register',()=>({registerSW:(options:any)=>{worker.callbacks=options;return vi.fn();}}));
import {appUpdates,type UpdateStatus} from '../src/ui/app-updates';
const disposers:(()=>void)[]=[];
afterEach(()=>{for(const dispose of disposers.splice(0))dispose();vi.unstubAllGlobals();vi.useRealTimers();});
function environment(){
 const values=new Map<string,string>(),doc=new EventTarget(),win=new EventTarget();
 vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)});
 vi.stubGlobal('document',Object.assign(doc,{hidden:false}));vi.stubGlobal('window',win);
 vi.stubGlobal('navigator',{onLine:true,serviceWorker:{getRegistration:async()=>({update:async()=>{},waiting:{}})}});
 return {values,doc};
}
it('postpones without activating a worker and keeps the choice across reloads until a manual check',async()=>{
 environment();let state:UpdateStatus|undefined;const first=appUpdates(s=>state=s);disposers.push(first.dispose);worker.callbacks.onNeedRefresh();expect(state?.available).toBe(true);
 first.postpone();const until=state!.deferredUntil!;expect(until).toBeGreaterThan(Date.now()+86_000_000);first.dispose();
 const second=appUpdates(s=>state=s);disposers.push(second.dispose);worker.callbacks.onNeedRefresh();expect(state?.deferredUntil).toBe(until);
 await second.check();expect(state?.deferredUntil).toBe(0);expect(state?.available).toBe(true);
});
it('expires a deferred update when the app returns to the foreground',()=>{
 vi.useFakeTimers();const {doc}=environment();let state:UpdateStatus|undefined;const updates=appUpdates(s=>state=s);disposers.push(updates.dispose);worker.callbacks.onNeedRefresh();updates.postpone();vi.setSystemTime(Date.now()+86_400_001);doc.dispatchEvent(new Event('visibilitychange'));expect(state?.deferredUntil).toBe(0);
});
