import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
test('render the actual motion engine offline: smooth air without a bass impact',async({page})=>{
 const source=ts.transpileModule(readFileSync('src/ui/motion-audio.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 await page.goto('/');const result=await page.evaluate(async code=>{
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));try{const {MotionAudio}=await import(url),offline=new OfflineAudioContext(1,96000,48000);let now=0;const context=new Proxy(offline,{get(target,key){if(key==='currentTime')return now;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}}),motion=new MotionAudio(context);motion.setHeld(true);
   for(let i=0;i<=60;i++){now=i/60;motion.update('zoom',.05+.95*Math.sin(Math.PI*i/60)**2,1,1);}now=1.05;motion.stop();const buffer=await offline.startRendering(),data=buffer.getChannelData(0),low=new Float64Array(4);let lowEnergy=0,total=0,peak=0;
   // A steeper measurement filter isolates sub-bass; a single pole also counts
   // the desired 200–1000 Hz body as bass because of its shallow roll-off.
   const alpha=1-Math.exp(-2*Math.PI*80/48000);for(let i=0;i<data.length;i++){for(let j=0;j<low.length;j++)low[j]+=alpha*((j?low[j-1]:data[i])-low[j]);lowEnergy+=low[3]*low[3];total+=data[i]*data[i];peak=Math.max(peak,Math.abs(data[i]));}return{samples:[...data],peak,lowRatio:lowEnergy/Math.max(1e-12,total)};
  }finally{URL.revokeObjectURL(url);}
 },source);expect(result.peak).toBeGreaterThan(.0001);expect(result.peak).toBeLessThan(.05);expect(result.lowRatio).toBeLessThan(.05);
 const wav=Buffer.alloc(44+result.samples.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(48000,24);wav.writeUInt32LE(96000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(result.samples.length*2,40);result.samples.forEach((v,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/zoom-air-preview.wav',wav);
});
