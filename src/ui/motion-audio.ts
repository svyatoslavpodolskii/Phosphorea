export type MotionKind='zoom'|'pan'|'lasso';
export function roomImpulse(context:BaseAudioContext){
 const rate=context.sampleRate,buffer=context.createBuffer(2,Math.ceil(rate*.42),rate);let seed=701;
 for(let ch=0;ch<2;ch++){const data=buffer.getChannelData(ch);for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;const t=i/rate;data[i]=t<.012?0:(seed/4294967296*2-1)*Math.exp(-t/.065)*.055;}}
 return buffer;
}
function hold(param:AudioParam,now:number){if(typeof param.cancelAndHoldAtTime==='function')param.cancelAndHoldAtTime(now);else{const value=param.value;param.cancelScheduledValues(now);param.setValueAtTime(value,now);}}
export function motionParameters(kind:MotionKind,speed:number,direction=1){
 const intensity=Math.min(1,Math.max(0,Number.isFinite(speed)?speed:0));
 return {gain:Math.sqrt(intensity)*(kind==='zoom'?.018:kind==='lasso'?.014:.011),frequency:kind==='zoom'?1100+intensity*3400:kind==='lasso'?2000+intensity*1200:3000+intensity*700,high:kind==='zoom'?450:kind==='lasso'?1250:800,wet:kind==='zoom'?.35:kind==='lasso'?.22:.12,attack:kind==='zoom'?.09:.07,release:kind==='zoom'?.16:.10,pan:kind==='zoom'?Math.sign(direction)*.10:0};
}
/** One loop per gesture. AudioParam automation runs on the audio thread, not
 * a succession of per-pointer samples. No oscillator/low-frequency impact. */
export class MotionAudio {
 private buffer:AudioBuffer;
 private impulse:AudioBuffer;
 private voice?:{source:AudioBufferSourceNode;high:BiquadFilterNode;filter:BiquadFilterNode;gain:GainNode;pan:StereoPannerNode;reverb:ConvolverNode;wet:GainNode};
 private idle:ReturnType<typeof setTimeout>|undefined;
 private held=false;
 setHeld(value:boolean){this.held=value;clearTimeout(this.idle);if(!value&&this.voice)this.idle=setTimeout(()=>this.stop(),300);}
 constructor(private context:AudioContext){
  const rate=context.sampleRate;let seed=179;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296*2-1;};
  this.buffer=context.createBuffer(1,rate*2,rate);const data=this.buffer.getChannelData(0),overlap=Math.round(rate*.04),raw=Float32Array.from({length:data.length+overlap},()=>random()*.5);data.set(raw.subarray(0,data.length));
  for(let i=0;i<overlap;i++){const t=i/(overlap-1),mix=t*t*(3-2*t);data[i]=raw[data.length+i]*(1-mix)+raw[i]*mix;}
  for(let i=0;i<data.length;i++)data[i]*=.86+.10*Math.sin(Math.PI*2*i/data.length)+.04*Math.sin(Math.PI*6*i/data.length);
  // Short diffuse room, not an echo. The dry signal still follows the finger.
  this.impulse=roomImpulse(context);
 }
 update(kind:MotionKind,speed:number,volume:number,direction=1){
  const p=motionParameters(kind,speed,direction);if(p.gain<.002||volume<=0)return;
  if(!this.voice){const source=this.context.createBufferSource(),high=this.context.createBiquadFilter(),filter=this.context.createBiquadFilter(),gain=this.context.createGain(),pan=this.context.createStereoPanner(),reverb=this.context.createConvolver(),wet=this.context.createGain();source.buffer=this.buffer;source.loop=true;high.type='highpass';high.frequency.value=850;high.Q.value=.5;filter.type='lowpass';filter.frequency.value=p.frequency;filter.Q.value=.4;gain.gain.value=0;reverb.normalize=false;reverb.buffer=this.impulse;wet.gain.value=.2;source.connect(high).connect(filter).connect(gain).connect(pan).connect(this.context.destination);pan.connect(reverb).connect(wet).connect(this.context.destination);this.voice={source,high,filter,gain,pan,reverb,wet};source.start();}
  const now=this.context.currentTime,v=this.voice;
  hold(v.gain.gain,now);v.gain.gain.setTargetAtTime(p.gain*volume,now,p.attack);v.gain.gain.setTargetAtTime(0,now+.12,p.release);
  hold(v.high.frequency,now);v.high.frequency.setTargetAtTime(p.high,now,.08);hold(v.wet.gain,now);v.wet.gain.setTargetAtTime(p.wet,now,.1);
  hold(v.filter.frequency,now);v.filter.frequency.setTargetAtTime(p.frequency,now,.08);hold(v.pan.pan,now);v.pan.pan.setTargetAtTime(p.pan,now,.08);
  clearTimeout(this.idle);if(!this.held)this.idle=setTimeout(()=>this.stop(),300);
 }
 stop(){clearTimeout(this.idle);this.idle=undefined;const v=this.voice;if(!v)return;this.voice=undefined;const now=this.context.currentTime;hold(v.gain.gain,now);v.gain.gain.setTargetAtTime(0,now,.04);v.source.onended=()=>{v.source.disconnect();v.high.disconnect();v.filter.disconnect();v.gain.disconnect();v.pan.disconnect();v.reverb.disconnect();v.wet.disconnect();};try{v.source.stop(now+.28);}catch{}}
}
