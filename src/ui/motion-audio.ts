export type MotionKind='zoom'|'pan'|'lasso';
/** Different source materials, not the same white noise with three EQ presets. */
export function motionSamples(kind:MotionKind,rate:number,channel=0){
 const grainStep=Math.max(1,Math.round(rate*.008)),length=Math.ceil(rate*1.5),overlap=Math.ceil(rate*.06),raw=new Float32Array(length+overlap);let seed=(kind==='pan'?179:kind==='zoom'?811:1373)+channel*97,low=0,slow=0,grain=.7,target=.7;
 for(let i=0;i<raw.length;i++){seed=(seed*1664525+1013904223)>>>0;const white=seed/4294967296*2-1;low+= (kind==='zoom'?.075:kind==='lasso'?.35:.42)*(white-low);slow+=.014*(white-slow);if(i%grainStep===0)target=.25+.75*Math.abs(white);grain+=.004*(target-grain);raw[i]=kind==='pan'?((low-slow)*.6+(white-low)*.08)*grain:kind==='zoom'?(low-slow)*1.4:(low-slow)*.6;}
 const data=raw.slice(0,length);for(let i=0;i<overlap;i++){const t=i/(overlap-1),mix=t*t*(3-2*t);data[i]=raw[length+i]*(1-mix)+raw[i]*mix;}
 if(kind==='lasso')for(let i=0;i<length;i++)data[i]*=.7+.3*Math.sin(Math.PI*6*i/length+channel*.7)**2;
 return data;
}
export function roomImpulse(context:BaseAudioContext,originalClick=false){
 const rate=context.sampleRate,buffer=context.createBuffer(2,Math.ceil(rate*(originalClick?.42:.85)),rate);let seed=701;
 if(originalClick){for(let ch=0;ch<2;ch++){const data=buffer.getChannelData(ch);for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;const t=i/rate;data[i]=t<.012?0:(seed/4294967296*2-1)*Math.exp(-t/.065)*.055;}}return buffer;}
 for(let ch=0;ch<2;ch++){const data=buffer.getChannelData(ch);let low=0;for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;const t=i/rate;low+=.3*(seed/4294967296*2-1-low);data[i]=t<.016?0:low*Math.exp(-t/.14)*.055;}}
 return buffer;
}
function hold(param:AudioParam,now:number){if(typeof param.cancelAndHoldAtTime==='function')param.cancelAndHoldAtTime(now);else{const value=param.value;param.cancelScheduledValues(now);param.setValueAtTime(value,now);}}
export function motionParameters(kind:MotionKind,speed:number,direction=1){
 const intensity=Math.min(1,Math.max(0,Number.isFinite(speed)?speed:0));
 return {gain:Math.pow(intensity,.65)*(kind==='zoom'?.018:kind==='lasso'?.016:.018),frequency:kind==='zoom'?420+intensity*600:kind==='lasso'?1500+intensity*750:4200+intensity*800,high:kind==='zoom'?200:kind==='lasso'?900:1650,wet:kind==='zoom'?.38:kind==='lasso'?.26:.035,attack:.12,release:kind==='zoom'?.22:.16,pan:kind==='zoom'?Math.sign(direction)*.12:0};
}
/** One loop per gesture. AudioParam automation runs on the audio thread, not
 * a succession of per-pointer samples. No oscillator/low-frequency impact. */
export class MotionAudio {
 private buffers=new Map<MotionKind,AudioBuffer>();
 private impulse:AudioBuffer;
 private voice?:{kind:MotionKind;source:AudioBufferSourceNode;high:BiquadFilterNode;filter:BiquadFilterNode;gain:GainNode;pan:StereoPannerNode;reverb:ConvolverNode;wet:GainNode};
 private idle:ReturnType<typeof setTimeout>|undefined;
 private held=false;
 setHeld(value:boolean){this.held=value;clearTimeout(this.idle);if(!value&&this.voice)this.idle=setTimeout(()=>this.stop(),300);}
 constructor(private context:AudioContext){
  // Short diffuse room, not an echo. The dry signal still follows the finger.
  this.impulse=roomImpulse(context);
 }
 update(kind:MotionKind,speed:number,volume:number,direction=1){
  const p=motionParameters(kind,speed,direction);if(p.gain<.002||volume<=0)return;
  if(this.voice&&this.voice.kind!==kind)this.stop();
  if(!this.voice){let buffer=this.buffers.get(kind);if(!buffer){buffer=this.context.createBuffer(2,Math.ceil(this.context.sampleRate*1.5),this.context.sampleRate);for(let ch=0;ch<2;ch++)buffer.getChannelData(ch).set(motionSamples(kind,this.context.sampleRate,ch));this.buffers.set(kind,buffer);}const source=this.context.createBufferSource(),high=this.context.createBiquadFilter(),filter=this.context.createBiquadFilter(),gain=this.context.createGain(),pan=this.context.createStereoPanner(),reverb=this.context.createConvolver(),wet=this.context.createGain();source.buffer=buffer;source.loop=true;high.type='highpass';high.frequency.value=p.high;high.Q.value=.5;filter.type=kind==='lasso'?'bandpass':'lowpass';filter.frequency.value=p.frequency;filter.Q.value=kind==='lasso'?.65:.4;gain.gain.value=0;reverb.normalize=false;reverb.buffer=this.impulse;wet.gain.value=p.wet;source.connect(high).connect(filter).connect(gain).connect(pan).connect(this.context.destination);pan.connect(reverb).connect(wet).connect(this.context.destination);this.voice={kind,source,high,filter,gain,pan,reverb,wet};source.start();}
  const now=this.context.currentTime,v=this.voice;
  hold(v.gain.gain,now);v.gain.gain.setTargetAtTime(p.gain*volume,now,p.attack);v.gain.gain.setTargetAtTime(0,now+.12,p.release);
  hold(v.high.frequency,now);v.high.frequency.setTargetAtTime(p.high,now,.08);hold(v.wet.gain,now);v.wet.gain.setTargetAtTime(p.wet,now,.1);
  hold(v.filter.frequency,now);v.filter.frequency.setTargetAtTime(p.frequency,now,.08);hold(v.pan.pan,now);v.pan.pan.setTargetAtTime(p.pan,now,.08);
  clearTimeout(this.idle);if(!this.held)this.idle=setTimeout(()=>this.stop(),300);
 }
 stop(){clearTimeout(this.idle);this.idle=undefined;const v=this.voice;if(!v)return;this.voice=undefined;const now=this.context.currentTime;hold(v.gain.gain,now);v.gain.gain.setTargetAtTime(0,now,.09);v.source.onended=()=>{v.source.disconnect();v.high.disconnect();v.filter.disconnect();v.gain.disconnect();v.pan.disconnect();v.reverb.disconnect();v.wet.disconnect();};try{v.source.stop(now+.55);}catch{}}
}
