import {it,expect,vi} from 'vitest';
import {cacheDownload,downloadModel,MODEL_FILES,modelFileUrl} from '../src/audio/download';
function cache(){const entries=new Map<string,Response>();return {entries,match:async(url:string)=>entries.get(url)?.clone(),delete:async(url:string)=>entries.delete(url),put:async(url:string,response:Response)=>{entries.set(url,new Response(await response.arrayBuffer(),{headers:response.headers}));}};}
it('downloads model files sequentially, reports bytes, and reuses completed files on retry',async()=>{
 const store=cache(),progress=vi.fn();let active=0,max=0;const fetcher=vi.fn(async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,1));active--;return new Response(new Uint8Array([1,2,3]),{headers:{'content-length':'3'}});});vi.stubGlobal('fetch',fetcher);
 try{await downloadModel(store as unknown as Cache,'Xenova/whisper-tiny',progress);expect(fetcher).toHaveBeenCalledTimes(MODEL_FILES.length);expect(max).toBe(1);expect(progress.mock.calls.some(c=>c[0]===3&&c[1]===3)).toBe(true);await downloadModel(store as unknown as Cache,'Xenova/whisper-tiny',progress);expect(fetcher).toHaveBeenCalledTimes(MODEL_FILES.length);}finally{vi.unstubAllGlobals();}
});
it('does not retain a truncated file and retries instead of marking a model ready',async()=>{
 const store=cache(),url=modelFileUrl('Xenova/whisper-tiny',MODEL_FILES[5]);vi.stubGlobal('fetch',async()=>new Response(new Uint8Array([1]),{headers:{'content-length':'20'}}));
 try{await expect(cacheDownload(store as unknown as Cache,url,()=>{})).rejects.toThrow('Incomplete');expect(store.entries.has(url)).toBe(false);}finally{vi.unstubAllGlobals();}
});

it('ends a stalled request instead of leaving the download indicator running forever',async()=>{
 vi.useFakeTimers();const store=cache();vi.stubGlobal('fetch',(_url:string,options:RequestInit)=>new Promise((_resolve,reject)=>options.signal!.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))));
 try{const result=cacheDownload(store as unknown as Cache,'https://example.org/stalled.onnx',()=>{});const rejected=expect(result).rejects.toMatchObject({name:'AbortError'});await vi.advanceTimersByTimeAsync(45001);await rejected;expect(store.entries.size).toBe(0);}finally{vi.useRealTimers();vi.unstubAllGlobals();}
});
