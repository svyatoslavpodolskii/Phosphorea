export type MotionKind='zoom'|'pan'|'lasso';
function hold(param:AudioParam,now:number){if(typeof param.cancelAndHoldAtTime==='function')param.cancelAndHoldAtTime(now);else{param.cancelScheduledValues(now);param.setValueAtTime(param.value,now);}}
export function motionParameters(kind:MotionKind,speed:number,direction=1){
 const intensity=Math.min(1,Math.max(0,Number.isFinite(speed)?speed:0));
 return {gain:Math.sqrt(intensity)*(kind==='zoom'?.12:kind==='lasso'?.035:.025),frequency:(kind==='zoom'?1250:850)+intensity*(kind==='zoom'?2800:1000)+(direction<0?-180:180),pan:kind==='zoom'?Math.sign(direction)*.12:0};
}
/** One loop per gesture. AudioParam automation runs on the audio thread, not
 * a succession of per-pointer samples. No oscillator/low-frequency impact. */
export class MotionAudio {
 private buffer:AudioBuffer;
 private voice?:{source:AudioBufferSourceNode;high:BiquadFilterNode;filter:BiquadFilterNode;gain:GainNode;pan:StereoPannerNode};
 private idle:ReturnType<typeof setTimeout>|undefined;
 private held=false;
 setHeld(value:boolean){this.held=value;clearTimeout(this.idle);if(!value&&this.voice)this.idle=setTimeout(()=>this.stop(),300);}
 constructor(private context:AudioContext){const rate=context.sampleRate;this.buffer=context.createBuffer(1,rate*2,rate);const data=this.buffer.getChannelData(0);let seed=179;for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*.5;}}
 update(kind:MotionKind,speed:number,volume:number,direction=1){
  const p=motionParameters(kind,speed,direction);if(p.gain<.002||volume<=0)return;
  if(!this.voice){const source=this.context.createBufferSource(),high=this.context.createBiquadFilter(),filter=this.context.createBiquadFilter(),gain=this.context.createGain(),pan=this.context.createStereoPanner();source.buffer=this.buffer;source.loop=true;high.type='highpass';high.frequency.value=600;high.Q.value=.5;filter.type='lowpass';filter.frequency.value=p.frequency;filter.Q.value=.5;gain.gain.value=0;source.connect(high).connect(filter).connect(gain).connect(pan).connect(this.context.destination);this.voice={source,high,filter,gain,pan};source.start();}
  const now=this.context.currentTime,v=this.voice;
  hold(v.gain.gain,now);v.gain.gain.setTargetAtTime(p.gain*volume,now,.035);v.gain.gain.setTargetAtTime(0,now+.09,.045);
  hold(v.filter.frequency,now);v.filter.frequency.setTargetAtTime(p.frequency,now,.045);hold(v.pan.pan,now);v.pan.pan.setTargetAtTime(p.pan,now,.06);
  clearTimeout(this.idle);if(!this.held)this.idle=setTimeout(()=>this.stop(),300);
 }
 stop(){clearTimeout(this.idle);this.idle=undefined;const v=this.voice;if(!v)return;this.voice=undefined;const now=this.context.currentTime;hold(v.gain.gain,now);v.gain.gain.setTargetAtTime(0,now,.025);v.source.onended=()=>{v.source.disconnect();v.high.disconnect();v.filter.disconnect();v.gain.disconnect();v.pan.disconnect();};try{v.source.stop(now+.15);}catch{}}
}
