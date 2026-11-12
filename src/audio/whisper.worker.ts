import {pipeline,env} from '@huggingface/transformers';
import {checkedModel,modelCache} from './models';
const wasmUrl=new URL('../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm',import.meta.url).href;
const runtimeKey=(url:string)=>location.origin+'/.__phosphoreya-whisper/'+new URL(url).pathname.split('/').pop();
const moduleUrl=new URL('../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs',import.meta.url).href;
self.onmessage=async({data})=>{try{
 const model=checkedModel(data.model),cache=await caches.open(modelCache(model));env.allowLocalModels=false;env.useBrowserCache=false;env.useCustomCache=true;env.customCache=cache;env.allowRemoteModels=true;if(data.kind!=='install')self.fetch=async()=>{throw Error('Model file is not cached. Download the model again.');};
 const runtime=await caches.open('phosphoreya-whisper-runtime');for(const url of [wasmUrl,moduleUrl]){if(!await runtime.match(runtimeKey(url))){if(data.kind!=='install')throw Error('Движок не сохранён. Загрузите модель ещё раз.');self.postMessage({kind:'progress',text:'Загружаем движок распознавания…'});const response=await fetch(url);if(!response.ok)throw Error('Не удалось загрузить движок.');await runtime.put(runtimeKey(url),response);}}
 const wasm=await (await runtime.match(runtimeKey(wasmUrl)))!.blob(),module=await (await runtime.match(runtimeKey(moduleUrl)))!.blob();const wasmBlob=URL.createObjectURL(wasm),moduleBlob=URL.createObjectURL(new Blob([module],{type:'text/javascript'}));
 const backend=env.backends.onnx.wasm!;backend.numThreads=1;backend.proxy=false;backend.wasmPaths={wasm:wasmBlob,mjs:moduleBlob};
 const transcriber:any=await pipeline('automatic-speech-recognition',model,{dtype:'q8',device:'wasm',progress_callback:(event:any)=>self.postMessage({kind:'progress',text:event.file||'Подготавливаем модель…',progress:event.progress})});
 if(data.kind==='install'){self.postMessage({kind:'done',text:''});return;}
 const pcm=new Float32Array(data.audio);const total=Math.max(1,Math.ceil(pcm.length/16000/25));let completed=0;
 const result=await transcriber(pcm,{chunk_length_s:30,stride_length_s:5,task:'transcribe',...(!model.endsWith('.en')&&data.language!=='auto'?{language:data.language}:{}),chunk_callback:()=>self.postMessage({kind:'progress',text:'Расшифровываем на устройстве…',progress:Math.min(99,++completed/total*100)})});
 self.postMessage({kind:'done',text:result.text||''});
 }catch(error){self.postMessage({kind:'error',error:(error as Error).message});}};
