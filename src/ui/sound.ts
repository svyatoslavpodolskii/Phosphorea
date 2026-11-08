import {MotionAudio,roomImpulse,type MotionKind} from './motion-audio';
import type {Plugin} from '../plugins/api';
export type SoundCue='tap'|'detent'|'hold'|'pulse'|'drop'|'move'|'lasso'|'open';
const rooms=new Map<boolean,ConvolverNode>();
function room(ctx:AudioContext,originalClick=false){let node=rooms.get(originalClick);if(!node){node=ctx.createConvolver();node.normalize=false;node.buffer=roomImpulse(ctx,originalClick);const wet=ctx.createGain();wet.gain.value=.17;node.connect(wet).connect(ctx.destination);rooms.set(originalClick,node);}return node;}
let muted=true;try{muted=localStorage.getItem('phosphora:sound-muted')!=='false';}catch{}
let enabled=false,volume=.35,context:AudioContext|undefined,motion:MotionAudio|undefined,motionHeld=false,lastZoom=-Infinity;
export function motionSound(kind:MotionKind,speed:number,direction=1){if(!context||context.state!=='running'||muted||!enabled||document.hidden)return;const now=performance.now();if(kind==='zoom')lastZoom=now;else if(now-lastZoom<120)return;try{motion??=new MotionAudio(context);motion.setHeld(motionHeld);motion.update(kind,speed,volume,direction);}catch{}}
export function stopMotionSound(){motionHeld=false;motion?.setHeld(false);motion?.stop();}
const last=new Map<SoundCue,number>();
export const soundInterval=(cue:SoundCue)=>cue==='detent'?160:cue==='move'||cue==='lasso'?110:cue==='open'?180:70;
const buffers=new Map<SoundCue,AudioBuffer>(),listeners=new Set<()=>void>(),voices=new Set<AudioBufferSourceNode>();
export const soundState=()=>({muted,enabled,volume});
export function observeSound(fn:()=>void){listeners.add(fn);fn();return()=>{listeners.delete(fn);};}
function changed(){for(const fn of listeners)fn();}
async function unlock(){if(muted||!enabled||document.hidden)return;try{context??=new AudioContext({latencyHint:'interactive'});if(context.state==='suspended')await context.resume();}catch{}}
/** Never replay an old contact once a slow browser/audio device wakes up. */
export function gestureSound(cue:SoundCue){if(context?.state==='running'){playSound(cue);return;}const started=performance.now();void unlock().then(()=>{if(performance.now()-started<120)playSound(cue);});}
export function setMuted(value:boolean){muted=value;try{localStorage.setItem('phosphora:sound-muted',String(value));}catch{}if(value)stopMotionSound();if(value)for(const voice of voices)try{voice.stop();}catch{}changed();if(!value)void unlock().then(()=>playSound('tap'));}
/** Mechanical transients and a diffused, non-tonal pressure wave. */
export function contactSamples(cue:SoundCue,sampleRate:number){
 if(cue==='move'||cue==='lasso')return new Float32Array(0);
 const wave=cue==='hold'||cue==='pulse',duration=wave?1.25:cue==='detent'?.024:.045,samples=new Float32Array(Math.ceil(sampleRate*duration));
 let seed=cue==='detent'?71:41,low=0,waveLow=0,waveSlow=0,tapLow=0,tapSlow=0;
 for(let i=0;i<samples.length;i++){const t=i/sampleRate;
  if(wave){
   seed=(seed*1664525+1013904223)>>>0;const noise=seed/4294967296*2-1;
   waveLow+=(1-Math.exp(-2*Math.PI*1050/sampleRate))*(noise-waveLow);waveSlow+=(1-Math.exp(-2*Math.PI*210/sampleRate))*(noise-waveSlow);
   const envelope=(1-Math.exp(-t/.055))*Math.exp(-t/.22)*(1-t/duration)**2;
   samples[i]=(waveLow-waveSlow)*envelope*(cue==='pulse'?.17:.26);
  }
  else{
   // A mechanical escapement: two tiny broadband contacts with a damped metal
   // body, not a pitched note or a low-frequency impact.
   seed=(seed*1664525+1013904223)>>>0;const noise=seed/4294967296*2-1;low=.45*low+.55*noise;tapLow+=.16*(noise-tapLow);tapSlow+=.025*(noise-tapSlow);let value=0;
   for(const [at,weight] of [[0,1],[cue==='detent'?.005:.009,.42]]){const q=t-at;if(q<0)continue;const envelope=Math.min(1,q/.0007)*Math.exp(-q/.0035);value+=(cue==='detent'?((noise-low)*.85+.15*Math.sin(2*Math.PI*2400*q)*Math.exp(-q/.0015)):(tapLow-tapSlow))*envelope*weight;}
   samples[i]=value*.15*(1-t/duration);
  }
 }return samples;
}
export async function previewSound(cue:SoundCue){await unlock();playSound(cue);}
export async function prepareSound(){await unlock();}
export function playSound(cue:SoundCue){const now=performance.now();if(cue==='move'||cue==='lasso')return;if(!context||context.state!=='running'||muted||!enabled||!volume||document.hidden||now-(last.get(cue)??-Infinity)<soundInterval(cue))return;last.set(cue,now);
 try{let buffer=buffers.get(cue);if(!buffer){const samples=contactSamples(cue,context.sampleRate);buffer=context.createBuffer(1,samples.length,context.sampleRate);buffer.getChannelData(0).set(samples);buffers.set(cue,buffer);}
  if(voices.size>=3)return;const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=volume*(cue==='pulse'?.65:1);source.connect(gain).connect(context.destination);const send=context.createGain();send.gain.value=cue==='hold'||cue==='pulse'?2.5:cue==='detent'?1:.3;gain.connect(send).connect(room(context,cue==='detent'));voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();send.disconnect();};source.start();
 }catch{}
}
export function installSoundFeedback(){let start:{id:number;x:number;y:number;time:number;canvas:boolean;moved:boolean}|null=null;let pointerContact=-Infinity;const canvasPointers=new Set<number>();
 const actionable=(target:Element)=>target.closest('button,[role=button],[role=option],[role=menuitem],summary,select,input[type=checkbox],label:has(input[type=checkbox])')&&!target.closest('[data-sound=off],:disabled');
 const down=(e:PointerEvent)=>{if(e.button!==0)return;const target=e.target as Element,canvas=target.matches('canvas.map');if(canvas)canvasPointers.add(e.pointerId);start={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),canvas,moved:canvasPointers.size>1};sample={x:e.clientX,y:e.clientY,time:start.time};motionHeld=canvasPointers.size>0;motion?.setHeld(motionHeld);if(canvas){void unlock();}else if(actionable(target)){pointerContact=performance.now();gestureSound('tap');}else void unlock();};
 const click=(e:MouseEvent)=>{if(actionable(e.target as Element)&&(!e.detail||performance.now()-pointerContact>700))gestureSound('tap');};
 const up=(e:PointerEvent)=>{canvasPointers.delete(e.pointerId);motionHeld=canvasPointers.size>0;motion?.setHeld(motionHeld);if(start?.id!==e.pointerId){if(start)start.moved=true;return;}if(start.canvas&&!start.moved&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<8&&performance.now()-start.time<450)gestureSound('tap');start=null;};
 let sample={x:0,y:0,time:0};const move=(e:PointerEvent)=>{if(!start?.canvas||canvasPointers.size!==1||start.id!==e.pointerId)return;if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>=8)start.moved=true;const now=performance.now(),distance=Math.hypot(e.clientX-sample.x,e.clientY-sample.y),dt=now-sample.time;if(start.moved&&sample.time>=start.time&&dt>0&&distance>1)motionSound((e.target as HTMLElement).dataset.gesture==='lasso'?'lasso':'pan',Math.min(1,distance/Math.max(8,dt)));sample={x:e.clientX,y:e.clientY,time:now};};
 const cancel=()=>{start=null;canvasPointers.clear();stopMotionSound();};
 const key=(e:KeyboardEvent)=>{if(['Enter',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)&&(e.target as Element).closest('button,[role=slider],input[type=range],select'))void unlock();};
 const visibility=()=>{if(document.hidden)cancel();};
 const change=(e:Event)=>{if(performance.now()-pointerContact>700&&(e.target as Element).matches('select,input[type=checkbox]'))gestureSound('tap');};
 document.addEventListener('visibilitychange',visibility);document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointermove',move,true);document.addEventListener('pointercancel',cancel,true);document.addEventListener('click',click,true);document.addEventListener('change',change,true);document.addEventListener('keydown',key,true);
 return()=>{stopMotionSound();document.removeEventListener('visibilitychange',visibility);document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointermove',move,true);document.removeEventListener('pointercancel',cancel,true);document.removeEventListener('click',click,true);document.removeEventListener('change',change,true);document.removeEventListener('keydown',key,true);};
}
export const soundPlugin:Plugin={manifest:{id:'builtin.sound',name:'Звуковой отклик',description:'Механические щелчки, глубокие волны и тихое пространственное движение. Звук включается кнопкой на карте.',version:'1.0.0',apiVersion:1,permissions:['settings'],settings:[{key:'volume',label:'Громкость отклика',type:'range',min:0,max:1,step:.05,default:.35}]},async activate(api){let alive=true,revision=0;async function refresh(){const version=++revision,v=await api.settings.get<number>('volume');if(alive&&version===revision){volume=typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(1,v)):.35;enabled=true;changed();}}const off=api.events.on('preferences:plugin-setting',e=>e.plugin==='builtin.sound'?refresh():undefined);try{await refresh();}catch(error){off();throw error;}return()=>{alive=false;revision++;enabled=false;stopMotionSound();off();for(const voice of voices)try{voice.stop();}catch{}changed();};}};
