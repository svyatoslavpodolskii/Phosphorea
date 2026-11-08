import {it,expect} from 'vitest';
import {writeFileSync,mkdirSync} from 'node:fs';
import {contactSamples,soundPlugin,soundState,type SoundCue} from '../src/ui/sound';
import {validateManifest,type PluginAPI} from '../src/plugins/api';
it('contact cues have bounded peaks, short duration and a silent onset/tail',()=>{
 const rate=48000,cues:SoundCue[]=['tap','detent','hold','drop'],blocks:Float32Array[]=[];
 for(const cue of cues){const samples=contactSamples(cue,rate);expect(samples.length/rate).toBeLessThanOrEqual(.046);expect(Math.abs(samples[0])).toBe(0);expect(Math.max(...samples.map(Math.abs))).toBeLessThan(.32);expect(Math.abs(samples.at(-1)!)).toBeLessThan(.003);blocks.push(samples,new Float32Array(rate*.22));}
 const samples=Float32Array.from(blocks.flatMap(b=>[...b])),wav=Buffer.alloc(44+samples.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);samples.forEach((v,i)=>wav.writeInt16LE(Math.round(v*.35*32767),44+i*2));mkdirSync('artifacts/design-audit',{recursive:true});writeFileSync('artifacts/design-audit/tactile-feedback.wav',wav);
});
it('a late volume read cannot revive a disabled sound plugin',async()=>{
 let handler:((e:any)=>unknown)|undefined,delayed=false,release:(value:number)=>void=()=>{};const api={settings:{get:async()=>delayed?new Promise<number>(r=>release=r):.25},events:{on:(_e:string,fn:(e:any)=>unknown)=>{handler=fn;return()=>handler=undefined;}}} as unknown as PluginAPI;validateManifest(soundPlugin.manifest);const stop=await soundPlugin.activate(api);expect(soundState().volume).toBe(.25);delayed=true;const pending=handler!({plugin:'builtin.sound'});if(typeof stop==='function')stop();release(.9);await pending;expect(soundState().enabled).toBe(false);expect(soundState().volume).toBe(.25);
});
