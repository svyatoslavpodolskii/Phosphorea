/** Bounded, local-only timing samples. No note or interaction coordinates. */
export class FrameMetrics {
 private duration=new Float32Array(120);
 private interval=new Float32Array(120);
 private modes=new Uint8Array(120);
 private count=0;private index=0;private previous=0;
 idle(){this.previous=0;}
 record(now:number,ms:number,cameraOnly:boolean){
  if(!Number.isFinite(now)||!Number.isFinite(ms)||ms<0)return;
  const gap=this.previous?now-this.previous:0;this.previous=now;
  this.duration[this.index]=ms;this.interval[this.index]=gap>0&&gap<=1000?gap:0;this.modes[this.index]=cameraOnly?1:0;
  this.index=(this.index+1)%120;this.count=Math.min(120,this.count+1);
 }
 snapshot(){
  const summary=(values:number[])=>{values.sort((a,b)=>a-b);const round=(x:number)=>Math.round(x*100)/100;return values.length?{samples:values.length,median:round(values[Math.floor(values.length*.5)]),p95:round(values[Math.min(values.length-1,Math.floor(values.length*.95))]),max:round(values.at(-1)!)}:null;};
  return {samples:this.count,cameraOnlyFrames:Array.from(this.modes.slice(0,this.count)).reduce((a,b)=>a+b,0),prepareMs:summary(Array.from(this.duration.slice(0,this.count))),intervalMs:summary(Array.from(this.interval.slice(0,this.count)).filter(v=>v>0))};
 }
}
export const cameraMetrics=new FrameMetrics();
