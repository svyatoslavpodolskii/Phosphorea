import {it,expect} from 'vitest';
import {writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {contactSamples,soundPlugin,soundState,soundInterval,type SoundCue} from '../src/ui/sound';
import {validateManifest,type PluginAPI} from '../src/plugins/api';
it('new users get full master volume while explicit user levels remain supported',async()=>{const api={settings:{get:async()=>undefined},events:{on:()=>()=>{}}} as unknown as PluginAPI;const stop=await soundPlugin.activate(api);expect(soundState().volume).toBe(1);expect(soundPlugin.manifest.settings?.find(f=>f.key==='volume')?.default).toBe(1);if(typeof stop==='function')stop();});
it('the wave has a slow attack instead of an initial air shot',()=>{const wave=contactSamples('hold',48000),peak=Math.max(...wave.map(Math.abs)),onset=Math.max(...wave.slice(0,Math.round(48000*.075)).map(Math.abs));expect(onset).toBeLessThan(peak*.15);});
it('keeps the accepted wheel click sample unchanged',()=>{const samples=contactSamples('detent',48000);expect(createHash('sha256').update(Buffer.from(samples.buffer)).digest('hex')).toBe('da1ce66479b81c90585359d9b4744e2824fea4a6f5ad3e656649b0ffd5056910');});
it('the hold wave has no sustained 140 Hz hum and the tap is quieter than the accepted detent',()=>{
 const wave=contactSamples('hold',48000),lag=Math.round(48000/140);let cross=0,a=0,b=0;for(let i=lag;i<18000;i++){cross+=wave[i]*wave[i-lag];a+=wave[i]**2;b+=wave[i-lag]**2;}expect(Math.abs(cross/Math.sqrt(a*b))).toBeLessThan(.3);
 const peak=(cue:SoundCue)=>Math.max(...contactSamples(cue,48000).map(Math.abs));expect(peak('tap')).toBeLessThan(peak('detent')*.7);
});
it('contact cues have bounded peaks, short duration and a silent onset/tail',()=>{
 const rate=48000,cues:SoundCue[]=['tap','detent','hold','pulse','drop'],blocks:Float32Array[]=[];
 for(const cue of cues){const samples=contactSamples(cue,rate);expect(samples.length/rate).toBeLessThanOrEqual(1.901);expect(Math.abs(samples[0])).toBe(0);expect(Math.max(...samples.map(Math.abs))).toBeLessThan(.32);expect(Math.abs(samples.at(-1)!)).toBeLessThan(.003);blocks.push(samples,new Float32Array(rate*.22));}
 const samples=Float32Array.from(blocks.flatMap(b=>[...b])),wav=Buffer.alloc(44+samples.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);samples.forEach((v,i)=>wav.writeInt16LE(Math.round(v*.35*32767),44+i*2));mkdirSync('artifacts/design-audit',{recursive:true});writeFileSync('artifacts/design-audit/tactile-feedback.wav',wav);
});
it('movement has no repeated contact samples and holds have a separate deep wave',()=>{expect(soundInterval('detent')).toBeGreaterThanOrEqual(150);expect(contactSamples('move',48000)).toHaveLength(0);expect(contactSamples('lasso',48000)).toHaveLength(0);expect(contactSamples('hold',48000).length).toBeGreaterThan(contactSamples('tap',48000).length*3);});
it('repeating waves are quieter than the initial hold and use the same non-tonal material',()=>{const hold=contactSamples('hold',48000),pulse=contactSamples('pulse',48000);expect(pulse.length).toBe(hold.length);expect(Math.max(...pulse.map(Math.abs))).toBeLessThan(Math.max(...hold.map(Math.abs)));for(let i=0;i<hold.length;i+=100)expect(pulse[i]).toBeCloseTo(hold[i]*.075/.12,5);});

it('a late volume read cannot revive a disabled sound plugin',async()=>{
 let handler:((e:any)=>unknown)|undefined,delayed=false,release:(value:number)=>void=()=>{};const api={settings:{get:async(key:string)=>key==='palette'?'soft':delayed?new Promise<number>(r=>release=r):.25},events:{on:(_e:string,fn:(e:any)=>unknown)=>{handler=fn;return()=>handler=undefined;}}} as unknown as PluginAPI;validateManifest(soundPlugin.manifest);const stop=await soundPlugin.activate(api);expect(soundState().volume).toBe(.25);delayed=true;const pending=handler!({plugin:'builtin.sound'});if(typeof stop==='function')stop();release(.9);await pending;expect(soundState().enabled).toBe(false);expect(soundState().volume).toBe(.25);
});
