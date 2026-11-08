import {test,expect} from '@playwright/test';
import {makeAtom} from '../../src/core/model';
import {importMap} from './helpers';
test.use({viewport:{width:390,height:844}});
test('two fingers emit zoom material without alternating loud pan sources',async({page,context,browserName})=>{
 test.skip(browserName!=='chromium','Real multi-touch is injected through CDP');
 await page.addInitScript(()=>{localStorage.setItem('phosphora:sound-muted','false');const Native=window.AudioContext;(window as any).__motionBands=[];window.AudioContext=class extends Native{filters:BiquadFilterNode[]=[];createBiquadFilter(){const node=super.createBiquadFilter();this.filters.push(node);return node;}createBufferSource(){const source=super.createBufferSource(),start=source.start.bind(source);source.start=((...args:Parameters<AudioBufferSourceNode['start']>)=>{if(source.loop)(window as any).__motionBands.push(this.filters.filter(f=>f.type==='highpass').at(-1)?.frequency.value);start(...args);}) as typeof source.start;return source;}};});
 await page.goto('/');await importMap(page,{atoms:[makeAtom({title:'Опора',pinned:true})],links:[]});await page.waitForTimeout(800);await page.evaluate(()=>(window as any).__motionBands=[]);
 const cdp=await context.newCDPSession(page),touch=(type:string,points:{x:number;y:number;id:number}[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({...p,radiusX:2,radiusY:2,force:1}))});
 await touch('touchStart',[{id:1,x:140,y:390},{id:2,x:250,y:450}]);for(let i=1;i<=8;i++)await touch('touchMove',[{id:1,x:140-i*5,y:390-i*2},{id:2,x:250+i*5,y:450+i*2}]);await touch('touchEnd',[]);
 await expect.poll(()=>page.evaluate(()=>(window as any).__motionBands.length)).toBeGreaterThan(0);expect(await page.evaluate(()=>(window as any).__motionBands.every((hz:number)=>hz===200))).toBe(true);
});
