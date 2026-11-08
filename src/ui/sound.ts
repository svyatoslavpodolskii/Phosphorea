import {MotionAudio,roomImpulse,type MotionKind} from './motion-audio';
import type {Plugin} from '../plugins/api';
export type SoundCue='tap'|'detent'|'hold'|'pulse'|'drop'|'move'|'lasso'|'open';
import pluckUrl from '../assets/audio/pluck_001.wav?url';
import glassUrl from '../assets/audio/glass_001.wav?url';
import tickUrl from '../assets/audio/tick_001.wav?url';
const recorded=new Map<string,AudioBuffer>();
let loading:Promise<void>|undefined;
let contactRoom:ConvolverNode|undefined;
function room(ctx:AudioContext){if(!contactRoom){contactRoom=ctx.createConvolver();contactRoom.normalize=false;contactRoom.buffer=roomImpulse(ctx);const wet=ctx.createGain();wet.gain.value=.12;contactRoom.connect(wet).connect(ctx.destination);}return contactRoom;}
async function loadRecorded(){if(!context)return;const ctx=context;loading??=Promise.all([['tap',pluckUrl],['hold',glassUrl],['detent',tickUrl]].map(async([key,url])=>{const response=await fetch(url);if(!response.ok)throw Error('Audio unavailable');recorded.set(key,await ctx.decodeAudioData(await response.arrayBuffer()));})).then(()=>{},()=>{loading=undefined;});await loading;}

let muted=false;try{muted=localStorage.getItem('phosphora:sound-muted')==='true';}catch{}
let palette='soft',enabled=false,volume=.35,context:AudioContext|undefined,motion:MotionAudio|undefined,motionHeld=false,lastZoom=-Infinity;
export function motionSound(kind:MotionKind,speed:number,direction=1){if(!context||context.state!=='running'||muted||!enabled||document.hidden)return;const now=performance.now();if(kind==='zoom')lastZoom=now;else if(now-lastZoom<120)return;try{motion??=new MotionAudio(context);motion.setHeld(motionHeld);motion.update(kind,speed,volume,direction);}catch{}}
export function stopMotionSound(){motionHeld=false;motion?.setHeld(false);motion?.stop();}
const last=new Map<SoundCue,number>();
export const soundInterval=(cue:SoundCue)=>cue==='detent'?160:cue==='move'||cue==='lasso'?110:cue==='open'?180:70;
const buffers=new Map<SoundCue,AudioBuffer>(),listeners=new Set<()=>void>(),voices=new Set<AudioBufferSourceNode>();
export const soundState=()=>({muted,enabled,volume,palette});
export function observeSound(fn:()=>void){listeners.add(fn);fn();return()=>{listeners.delete(fn);};}
function changed(){for(const fn of listeners)fn();}
async function unlock(){if(muted||!enabled||document.hidden)return;try{context??=new AudioContext({latencyHint:'interactive'});if(context.state==='suspended')await context.resume();if(palette==='glass')void loadRecorded();}catch{}}
/** Never replay an old contact once a slow browser/audio device wakes up. */
export function gestureSound(cue:SoundCue){if(context?.state==='running'){playSound(cue);return;}const started=performance.now();void unlock().then(()=>{if(performance.now()-started<120)playSound(cue);});}
export function setMuted(value:boolean){muted=value;try{localStorage.setItem('phosphora:sound-muted',String(value));}catch{}if(value)stopMotionSound();if(value)for(const voice of voices)try{voice.stop();}catch{}changed();if(!value)void unlock().then(()=>playSound('tap'));}
/** Stable partials and soft envelopes, adapted from vmeste's sound garden.
 * No frequency sweep, impact noise or sharp oscillator switch-on. */
export function contactSamples(cue:SoundCue,sampleRate:number){
 if(cue==='move'||cue==='lasso')return new Float32Array(0);
 const sustained=cue==='hold'||cue==='pulse',duration=sustained?.58:cue==='detent'?.045:.16;
 const samples=new Float32Array(Math.ceil(sampleRate*duration));
 const frequency=sustained?220:cue==='detent'?880:cue==='drop'?440:523.251;
 const attack=sustained?.065:cue==='detent'?.004:.009;
 for(let i=0;i<samples.length;i++){const t=i/sampleRate,progress=t/duration;
  const envelope=(1-Math.exp(-t/attack))*Math.exp(-t/(duration*.23))*(1-progress)**2;
  samples[i]=(Math.sin(2*Math.PI*frequency*t)+.12*Math.sin(4*Math.PI*frequency*t)+.04*Math.sin(6*Math.PI*frequency*t))*envelope*(cue==='pulse'?.095:sustained?.16:.23);
 }return samples;
}
export async function previewSound(cue:SoundCue){await unlock();if(palette==='glass')await loadRecorded();playSound(cue);}
export async function prepareSound(){await unlock();}
export function playSound(cue:SoundCue){const now=performance.now();if(cue==='move'||cue==='lasso')return;if(!context||context.state!=='running'||muted||!enabled||!volume||document.hidden||now-(last.get(cue)??-Infinity)<soundInterval(cue))return;last.set(cue,now);
 try{const recordedKey=cue==='pulse'?'hold':cue==='drop'||cue==='open'?'tap':cue;let buffer=palette==='glass'?recorded.get(recordedKey):undefined;buffer??=buffers.get(cue);if(!buffer){const samples=contactSamples(cue,context.sampleRate);buffer=context.createBuffer(1,samples.length,context.sampleRate);buffer.getChannelData(0).set(samples);buffers.set(cue,buffer);}
  if(voices.size>=3)return;const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=volume*(palette==='glass'?.22:1)*(cue==='pulse'?.6:1);source.connect(gain).connect(context.destination);if(palette==='soft')gain.connect(room(context));voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();};source.start();
 }catch{}
}
export function installSoundFeedback(){let start:{id:number;x:number;y:number;time:number;canvas:boolean;moved:boolean}|null=null;let pointerContact=-Infinity;const canvasPointers=new Set<number>();
 const actionable=(target:Element)=>target.closest('button,[role=button],[role=option],[role=menuitem],summary,select,input[type=checkbox],label:has(input[type=checkbox])')&&!target.closest('[data-sound=off],:disabled');
 const down=(e:PointerEvent)=>{if(e.button!==0)return;const target=e.target as Element,canvas=target.matches('canvas.map');if(canvas)canvasPointers.add(e.pointerId);start={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),canvas,moved:canvasPointers.size>1};sample={x:e.clientX,y:e.clientY,time:start.time};motionHeld=canvasPointers.size>0;motion?.setHeld(motionHeld);if(canvas){void unlock();}else if(actionable(target)){pointerContact=performance.now();gestureSound('tap');}else void unlock();};
 const click=(e:MouseEvent)=>{if(actionable(e.target as Element)&&(!e.detail||performance.now()-pointerContact>700))gestureSound('tap');};
 const up=(e:PointerEvent)=>{canvasPointers.delete(e.pointerId);motionHeld=canvasPointers.size>0;motion?.setHeld(motionHeld);if(start?.id!==e.pointerId){if(start)start.moved=true;return;}if(start.canvas&&!start.moved&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<8&&performance.now()-start.time<450)gestureSound('tap');start=null;};
 let sample={x:0,y:0,time:0};const move=(e:PointerEvent)=>{if(!start?.canvas)return;if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>=8)start.moved=true;const now=performance.now(),distance=Math.hypot(e.clientX-sample.x,e.clientY-sample.y),dt=now-sample.time;if(start.moved&&sample.time>=start.time&&dt>0&&distance>1)motionSound((e.target as HTMLElement).dataset.gesture==='lasso'?'lasso':'pan',Math.min(1,distance/Math.max(8,dt)));sample={x:e.clientX,y:e.clientY,time:now};};
 const cancel=()=>{start=null;canvasPointers.clear();stopMotionSound();};
 const key=(e:KeyboardEvent)=>{if(['Enter',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)&&(e.target as Element).closest('button,[role=slider],input[type=range],select'))void unlock();};
 const visibility=()=>{if(document.hidden)cancel();};
 const change=(e:Event)=>{if(performance.now()-pointerContact>700&&(e.target as Element).matches('select,input[type=checkbox]'))gestureSound('tap');};
 document.addEventListener('visibilitychange',visibility);document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointermove',move,true);document.addEventListener('pointercancel',cancel,true);document.addEventListener('click',click,true);document.addEventListener('change',change,true);document.addEventListener('keydown',key,true);
 return()=>{stopMotionSound();document.removeEventListener('visibilitychange',visibility);document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointermove',move,true);document.removeEventListener('pointercancel',cancel,true);document.removeEventListener('click',click,true);document.removeEventListener('change',change,true);document.removeEventListener('keydown',key,true);};
}
export const soundPlugin:Plugin={manifest:{id:'builtin.sound',name:'Звуковой отклик',description:'Мягкие касания, звучащие волны и воздушное движение. Два варианта с прослушиванием.',version:'1.0.0',apiVersion:1,permissions:['settings'],settings:[{key:'volume',label:'Громкость отклика',type:'range',min:0,max:1,step:.05,default:.35},{key:'palette',label:'Звучание касаний',type:'select',default:'soft',options:[{value:'soft',label:'Мягкие ноты · vmeste'},{value:'glass',label:'Стекло · Kenney'}]}]},async activate(api){let alive=true,revision=0;async function refresh(){const version=++revision,v=await api.settings.get<number>('volume'),p=await api.settings.get<string>('palette');if(alive&&version===revision){volume=typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(1,v)):.35;palette=p==='glass'?'glass':'soft';enabled=true;if(palette==='glass')void unlock();changed();}}const off=api.events.on('preferences:plugin-setting',e=>e.plugin==='builtin.sound'?refresh():undefined);try{await refresh();}catch(error){off();throw error;}return()=>{alive=false;revision++;enabled=false;stopMotionSound();off();for(const voice of voices)try{voice.stop();}catch{}changed();};}};
