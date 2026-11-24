import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {makeAtom,makeLink} from '../../src/core/model';
import {importMap,readMap} from '../e2e/helpers';
for(const count of [20,1000])test(`${count} atoms: mobile native pinch`,async({browser,browserName})=>{
 test.skip(browserName!=='chromium');
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2.75,isMobile:true,hasTouch:true,storageState:{cookies:[],origins:[{origin:'http://127.0.0.1:4173',localStorage:[{name:'phosphorea:tour-v1',value:'seen'}]}]}});
 const page=await context.newPage();await page.goto('http://127.0.0.1:4173/?profile=1');
 const columns=Math.ceil(Math.sqrt(count)),atoms=Array.from({length:count},(_,i)=>makeAtom({id:'pinch-'+i,title:'Thought '+i,pinned:true,x:(i%columns-columns/2)*125,y:(Math.floor(i/columns)-columns/2)*115}));
 await importMap(page,{atoms,links:atoms.slice(1).map((a,i)=>makeLink(atoms[i].id,a.id))},60000);
 const map=page.locator('canvas.map');await expect(map).toHaveAttribute('data-renderer-pending','false',{timeout:30000});await expect(map).toHaveAttribute('data-transition','idle');await expect(map).toHaveAttribute('data-layout','idle');
 const session=await context.newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:4});await session.send('Profiler.enable');await session.send('Profiler.start');
 await page.evaluate(()=>{const w=window as any;w.pinchFrames=[];w.pinchDraw=[];w.pinchRunning=true;let previous=performance.now();const tick=()=>{if(!w.pinchRunning)return;const now=performance.now();w.pinchFrames.push(now-previous);previous=now;w.pinchDraw.push(Number(document.querySelector('canvas.map')!.getAttribute('data-render-ms')));requestAnimationFrame(tick);};requestAnimationFrame(tick);});
 for(let cycle=0;cycle<3;cycle++){
  const points=(distance:number)=>[{id:1,x:195-distance/2,y:420},{id:2,x:195+distance/2,y:420}];
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(70)});
  for(let i=0;i<60;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(70+180*Math.sin(Math.PI*i/60))});await page.waitForTimeout(16);}
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 const {profile}=await session.send('Profiler.stop');
 const metrics=await page.evaluate(()=>{const w=window as any;w.pinchRunning=false;const summary=(values:number[])=>{const s=values.slice(5).sort((a,b)=>a-b);return {median:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)]};};return {frames:summary(w.pinchFrames),draw:summary(w.pinchDraw),backend:document.querySelector('canvas.map')!.getAttribute('data-renderer')};});
 const samples=new Map<number,number>();for(const id of profile.samples||[])samples.set(id,(samples.get(id)||0)+1);const hot=profile.nodes.map(n=>({name:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber,samples:samples.get(n.id)||0})).sort((a,b)=>b.samples-a.samples).slice(0,30);
 await mkdir('artifacts/performance',{recursive:true});await writeFile(`artifacts/performance/${process.env.PERF_LABEL||'current'}-pinch-${count}.json`,JSON.stringify({metrics,hot},null,2));console.log(JSON.stringify({count,...metrics,hot:hot.slice(0,8)}));
 expect(metrics.draw.p95).toBeLessThan(1000);await session.send('Emulation.setCPUThrottlingRate',{rate:1});const saved=await readMap(page);expect(saved.atoms.map(a=>[a.id,a.x,a.y]).sort()).toEqual(atoms.map(a=>[a.id,a.x,a.y]).sort());await context.close();
});
