import type {Plugin} from '../plugins/api';
export type SoundCue='tap'|'detent'|'hold'|'drop'|'move'|'lasso'|'open';
let muted=false;try{muted=localStorage.getItem('phosphora:sound-muted')==='true';}catch{}
let enabled=false,volume=.35,context:AudioContext|undefined;
const last=new Map<SoundCue,number>();
export const soundInterval=(cue:SoundCue)=>cue==='detent'?160:cue==='move'||cue==='lasso'?110:cue==='open'?180:70;
const buffers=new Map<SoundCue,AudioBuffer>(),listeners=new Set<()=>void>(),voices=new Set<AudioBufferSourceNode>();
export const soundState=()=>({muted,enabled,volume});
export function observeSound(fn:()=>void){listeners.add(fn);fn();return()=>{listeners.delete(fn);};}
function changed(){for(const fn of listeners)fn();}
async function unlock(){if(muted||!enabled||document.hidden)return;try{context??=new AudioContext({latencyHint:'interactive'});if(context.state==='suspended')await context.resume();}catch{}}
/** Never replay an old contact once a slow browser/audio device wakes up. */
export function gestureSound(cue:SoundCue){if(context?.state==='running'){playSound(cue);return;}const started=performance.now();void unlock().then(()=>{if(performance.now()-started<120)playSound(cue);});}
export function setMuted(value:boolean){muted=value;try{localStorage.setItem('phosphora:sound-muted',String(value));}catch{}if(value)for(const voice of voices)try{voice.stop();}catch{}changed();if(!value)void unlock().then(()=>playSound('tap'));}
export function contactSamples(cue:SoundCue,sampleRate:number){const soft=cue==='move'||cue==='lasso',duration=soft?.042:cue==='detent'?.024:cue==='hold'?.038:cue==='drop'?.045:cue==='open'?.045:.032;const samples=new Float32Array(Math.ceil(sampleRate*duration));let seed=41,low=0;for(let i=0;i<samples.length;i++){seed=(seed*1664525+1013904223)>>>0;low=low*.88+(seed/4294967296*2-1)*.12;const t=i/sampleRate,envelope=Math.min(1,t/.0035)*Math.exp(-t/(duration*.18));samples[i]=(low*.75+Math.sin(t*Math.PI*2*(cue==='detent'?280:cue==='open'?190:210))*.25)*envelope*(soft?.065:cue==='detent'?.16:.24);}return samples;}
/** A short, low wooden contact: no network, media autoplay or persistent oscillator. */
export function playSound(cue:SoundCue){const now=performance.now();if(!context||context.state!=='running'||muted||!enabled||!volume||document.hidden||now-(last.get(cue)??-Infinity)<soundInterval(cue))return;last.set(cue,now);
 try{let buffer=buffers.get(cue);if(!buffer){const samples=contactSamples(cue,context.sampleRate);buffer=context.createBuffer(1,samples.length,context.sampleRate);buffer.getChannelData(0).set(samples);buffers.set(cue,buffer);}
  if(voices.size>=3)return;const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=volume;source.connect(gain).connect(context.destination);voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();};source.start();
 }catch{}
}
export function installSoundFeedback(){let start:{x:number;y:number;time:number;canvas:boolean}|null=null;let pointerContact=-Infinity,openingPending=true;
 const actionable=(target:Element)=>target.closest('button,[role=button],[role=option],[role=menuitem],summary,select,input[type=checkbox],label:has(input[type=checkbox])')&&!target.closest('[data-sound=off],:disabled');
 const down=(e:PointerEvent)=>{if(e.button!==0)return;const target=e.target as Element;start={x:e.clientX,y:e.clientY,time:performance.now(),canvas:target.matches('canvas.map')};if(actionable(target)||start.canvas){pointerContact=performance.now();gestureSound(openingPending?'open':'tap');openingPending=false;}else void unlock();};
 const click=(e:MouseEvent)=>{if(actionable(e.target as Element)&&(!e.detail||performance.now()-pointerContact>700))gestureSound('tap');};
 const up=(e:PointerEvent)=>{if(start?.canvas&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>10)playSound((e.target as HTMLElement).dataset.gesture==='lasso'?'hold':'drop');start=null;};
 const move=(e:PointerEvent)=>{if(!start?.canvas||Math.hypot(e.clientX-start.x,e.clientY-start.y)<12)return;playSound((e.target as HTMLElement).dataset.gesture==='lasso'?'lasso':'move');};
 const cancel=()=>{start=null;};
 const key=(e:KeyboardEvent)=>{if(['Enter',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)&&(e.target as Element).closest('button,[role=slider],select'))void unlock();};
 const change=(e:Event)=>{if(performance.now()-pointerContact>700&&(e.target as Element).matches('select,input[type=checkbox]'))gestureSound('tap');};
 document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointermove',move,true);document.addEventListener('pointercancel',cancel,true);document.addEventListener('click',click,true);document.addEventListener('change',change,true);document.addEventListener('keydown',key,true);
 return()=>{document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointermove',move,true);document.removeEventListener('pointercancel',cancel,true);document.removeEventListener('click',click,true);document.removeEventListener('change',change,true);document.removeEventListener('keydown',key,true);};
}
export const soundPlugin:Plugin={manifest:{id:'builtin.sound',name:'Звуковой отклик',description:'Тихие тактильные щелчки. Кнопка звука всегда под рукой на карте.',version:'1.0.0',apiVersion:1,permissions:['settings'],settings:[{key:'volume',label:'Громкость отклика',type:'range',min:0,max:1,step:.05,default:.35}]},async activate(api){let alive=true,revision=0;async function refresh(){const version=++revision,v=await api.settings.get<number>('volume');if(alive&&version===revision){volume=typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(1,v)):.35;enabled=true;changed();}}const off=api.events.on('preferences:plugin-setting',e=>e.plugin==='builtin.sound'?refresh():undefined);try{await refresh();}catch(error){off();throw error;}return()=>{alive=false;revision++;enabled=false;off();for(const voice of voices)try{voice.stop();}catch{}changed();};}};
