type ScriptTiming={duration:number;forcedStyleAndLayoutDuration?:number;sourceFunctionName?:string;sourceURL?:string;sourceCharPosition?:number;invokerType?:string};
interface BrowserFrame extends PerformanceEntry {renderStart?:number;styleAndLayoutStart?:number;blockingDuration?:number;scripts?:ScriptTiming[]}
const round=(x:number)=>Math.round(x*100)/100;
/** Bounded, local-only timing samples. No note or interaction coordinates. */
export class FrameMetrics {
 private duration=new Float32Array(120);
 private interval=new Float32Array(120);
 private queueWait=new Float32Array(120);
 private modes=new Uint8Array(120);
 private wall=new Float64Array(120);
 private reasons:string[]=Array(120).fill('');
 private stalls:ReturnType<FrameMetrics['describeStall']>[]=[];
 private count=0;private index=0;private previous=0;
 private observer?:PerformanceObserver;private observers=0;
 private browserTimingSupported=false;
 idle(){this.previous=0;}
 record(now:number,ms:number,cameraOnly:boolean,reason='scene',wall=now,queueWait=0){
  if(!Number.isFinite(now)||!Number.isFinite(ms)||ms<0)return;
  const gap=this.previous?now-this.previous:0;this.previous=now;
  this.queueWait[this.index]=Math.max(0,queueWait);this.duration[this.index]=ms;this.interval[this.index]=gap>0&&gap<=1000?gap:0;this.modes[this.index]=cameraOnly?1:0;this.wall[this.index]=wall;this.reasons[this.index]=cameraOnly?'retained':reason;
  this.index=(this.index+1)%120;this.count=Math.min(120,this.count+1);
 }
 private describeStall(e:BrowserFrame){
  const end=e.startTime+e.duration;
  return {durationMs:round(e.duration),blockingMs:round(e.blockingDuration||0),renderMs:round(e.renderStart?end-e.renderStart:0),renderTailMs:round(e.styleAndLayoutStart?end-e.styleAndLayoutStart:0),scripts:(e.scripts||[]).slice().sort((a,b)=>b.duration-a.duration).slice(0,5).map(s=>{
   // Deliberately omit URLs, selectors, event arguments and DOM attribution.
   const file=(s.sourceURL||'').split(/[?#]/)[0].split('/').at(-1)||'';
   return {durationMs:round(s.duration),forcedLayoutMs:round(s.forcedStyleAndLayoutDuration||0),function:(s.sourceFunctionName||'').slice(0,80),file:/^[\w.-]+\.m?js$/.test(file)?file:'',position:s.sourceCharPosition??-1,type:s.invokerType||''};
  })};
 }
 captureBrowserFrame(e:BrowserFrame){
  if(!Number.isFinite(e.duration)||e.duration<50)return;
  const end=e.startTime+e.duration;
  let relevant=false;for(let i=0;i<this.count;i++)if(this.wall[i]>=e.startTime&&this.wall[i]<=end){relevant=true;break;}
  if(!relevant)return;
  this.stalls.push(this.describeStall(e));if(this.stalls.length>12)this.stalls.shift();
 }
 observe(){
  this.observers++;
  if(!this.observer&&typeof PerformanceObserver!=='undefined'&&PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')){
   try{this.observer=new PerformanceObserver(list=>{for(const e of list.getEntries())this.captureBrowserFrame(e as BrowserFrame);});this.observer.observe({type:'long-animation-frame'});this.browserTimingSupported=true;}catch{this.observer?.disconnect();this.observer=undefined;}
  }
  return()=>{if(--this.observers===0){this.observer?.disconnect();this.observer=undefined;}};
 }
 snapshot(){
  const summary=(values:number[])=>{values.sort((a,b)=>a-b);return values.length?{samples:values.length,median:round(values[Math.floor(values.length*.5)]),p95:round(values[Math.min(values.length-1,Math.floor(values.length*.95))]),max:round(values.at(-1)!)}:null;};
  const reasons:Record<string,number>={},camera:number[]=[],scene:number[]=[];
  for(let i=0;i<this.count;i++){const reason=this.reasons[i];reasons[reason]=(reasons[reason]||0)+1;(this.modes[i]?camera:scene).push(this.duration[i]);}
  return {samples:this.count,cameraOnlyFrames:Array.from(this.modes.slice(0,this.count)).reduce((a,b)=>a+b,0),prepareMs:summary(Array.from(this.duration.slice(0,this.count))),cameraPrepareMs:summary(camera),scenePrepareMs:summary(scene),queueWaitMs:summary(Array.from(this.queueWait.slice(0,this.count))),intervalMs:summary(Array.from(this.interval.slice(0,this.count)).filter(v=>v>0)),reasons,browserTimingSupported:this.browserTimingSupported,browserStalls:this.stalls.slice()};
 }
}
export const cameraMetrics=new FrameMetrics();
