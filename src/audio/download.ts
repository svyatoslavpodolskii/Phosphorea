/** Stream directly into CacheStorage: installing must not instantiate ONNX sessions. */
export const MODEL_FILES=['config.json','tokenizer.json','tokenizer_config.json','preprocessor_config.json','generation_config.json','onnx/encoder_model_quantized.onnx','onnx/decoder_model_merged_quantized.onnx'];
export const modelFileUrl=(model:string,file:string)=>`https://huggingface.co/${model}/resolve/main/${file}`;
export async function cacheDownload(cache:Cache,url:string,progress:(loaded:number,total:number)=>void){
 if(await cache.match(url)){progress(0,0);return;}
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
 const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(),45000);};arm();
 try{
  progress(0,0);const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error(`HTTP ${response.status}`);
  if(!response.body)throw Error('Empty download response');
  const encoded=response.headers.get('content-encoding'),total=(!encoded||encoded==='identity')?Number(response.headers.get('content-length'))||0:0;let loaded=0,lastProgress=0;const reader=response.body.getReader();
  const body=new ReadableStream<Uint8Array>({async pull(stream){try{const chunk=await reader.read();arm();if(chunk.done){if(total&&/\.(onnx|wasm)(?:\?|$)/.test(url)&&loaded!==total)throw Error('Incomplete model file');progress(loaded,total);stream.close();return;}loaded+=chunk.value.byteLength;if(Date.now()-lastProgress>=100){lastProgress=Date.now();progress(loaded,total);}stream.enqueue(chunk.value);}catch(e){stream.error(e);}},cancel(reason){controller.abort();return reader.cancel(reason);}});
  await cache.put(url,new Response(body,{headers:response.headers}));
  if(!loaded)throw Error('Empty model file');
 }catch(error){controller.abort();await cache.delete(url);throw error;}finally{clearTimeout(timer!);}
}
export async function downloadModel(cache:Cache,model:string,progress:(loaded:number,total:number,index:number,count:number)=>void){
 for(let i=0;i<MODEL_FILES.length;i++)await cacheDownload(cache,modelFileUrl(model,MODEL_FILES[i]),(loaded,total)=>progress(loaded,total,i,MODEL_FILES.length));
}
