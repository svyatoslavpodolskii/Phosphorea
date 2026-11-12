import {test,expect} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {makeAtom,makeLink} from '../../src/core/model';
import {importMap} from '../e2e/helpers';
for(const count of (process.env.PERF_LARGE?[5000]:[20,1000]))test(`${count} atoms: measured zoom and pan`,async({page,browserName})=>{
 await page.setViewportSize({width:1280,height:800});if(process.env.PERF_CANVAS)await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind:string,...args:any[]):any{return kind.includes('webgl')?null:(original as any).call(this,kind,...args);};});await page.goto('/?profile=1');
 const columns=Math.ceil(Math.sqrt(count)),atoms=Array.from({length:count},(_,i)=>makeAtom({id:'perf-'+i,title:'Thought '+i,pinned:true,x:(i%columns-columns/2)*125,y:(Math.floor(i/columns)-columns/2)*115}));
 await importMap(page,{atoms,links:atoms.slice(1).map((a,i)=>makeLink(atoms[i].id,a.id))},60000);
 const map=page.locator('canvas.map');await expect(map).toHaveAttribute('data-renderer-pending','false',{timeout:30000});await expect.poll(async()=>Number(await map.getAttribute('data-nodes')),{timeout:60000}).toBeGreaterThan(0);await expect(map).toHaveAttribute('data-layout','idle');await expect(map).toHaveAttribute('data-transition','idle');
 if(process.env.PERF_NO_BACKGROUND)await page.addStyleTag({content:'.theme-backdrop{display:none!important}'});
 if(browserName==='chromium'){const session=await page.context().newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:4});}
 const metrics=await page.evaluate(async()=>{
  const map=document.querySelector('canvas.map')!,rect=map.getBoundingClientRect(),frames:number[]=[],draw:number[]=[];let previous=performance.now();
  for(let i=0;i<100;i++){
   map.dispatchEvent(new WheelEvent('wheel',{deltaY:i<50?5:-5,clientX:rect.width/2,clientY:rect.height/2,bubbles:true,cancelable:true}));
   await new Promise<void>(resolve=>requestAnimationFrame(()=>{const now=performance.now();frames.push(now-previous);previous=now;draw.push(Number(map.getAttribute('data-render-ms'))||0);resolve();}));
  }
  const summary=(values:number[])=>{const sorted=values.slice(5).sort((a,b)=>a-b);return {median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:Math.max(...sorted)};};
  return {frames:summary(frames),draw:summary(draw),backend:map.getAttribute('data-renderer'),nodes:map.getAttribute('data-nodes')};
 });
 console.log(JSON.stringify({browserName,count,...metrics}));await mkdir('artifacts/performance',{recursive:true});await writeFile(`artifacts/performance/${process.env.PERF_LABEL||'current'}-${browserName}-${count}.json`,JSON.stringify(metrics,null,2));
 expect(metrics.draw.p95).toBeLessThan(1000);
});
