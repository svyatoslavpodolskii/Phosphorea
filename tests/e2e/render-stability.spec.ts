import {writeFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {createHash} from 'node:crypto';
import {test,expect,type Page} from '@playwright/test';
import {makeAtom,makeLink} from '../../src/core/model';
import {importMap,readMap} from './helpers';

test.use({viewport:{width:1280,height:800},deviceScaleFactor:2});
async function snapshot(page:Page){
 const surface=page.locator('canvas.map');const gpu=await surface.getAttribute('data-renderer')==='webgl';
 const buffer=gpu?await surface.screenshot({animations:'disabled'}):Buffer.from((await surface.evaluate(c=>c.toDataURL())).split(',')[1],'base64');
 const {width,height,data:pixels}=PNG.sync.read(buffer);let hash=2166136261;
 const sx=width/1280,sy=height/800;
 for(let y=0;y<height;y+=2)for(let x=0;x<width;x+=2){
  if(x/sx>520&&x/sx<790&&y/sy>280&&y/sy<540)continue;
  const i=(y*width+x)*4;for(let c=0;c<4;c++)hash=Math.imul(hash^pixels[i+c],16777619);
 }
 return {width,height,hash:hash>>>0};
}

test('dense map keeps its pixels and backing resolution on hover, press and release',async({page})=>{
 await page.addInitScript(()=>window.addEventListener('phosphora-theme-change',e=>(window as any).__theme=(e as CustomEvent).detail));
 await page.goto('/');await expect(page.locator('canvas.map')).toBeVisible();await expect(page.locator('canvas.map')).toHaveAttribute('data-nodes','0');
 const atoms=Array.from({length:500},(_,i)=>makeAtom({id:'stable-'+i,title:'Atom '+i,pinned:true,x:(i%30-15)*90,y:(Math.floor(i/30)-8)*90}));
 await importMap(page,{atoms,links:atoms.slice(1).map((a,i)=>makeLink(atoms[i].id,a.id))});await expect(page.locator('canvas.map')).toHaveAttribute('data-layout','idle');
 await page.mouse.move(685,445);await page.waitForTimeout(250);const before=await snapshot(page);
 const backing=await page.locator('canvas.map').evaluate(c=>({width:c.width,height:c.height}));expect(before.width).toBe(backing.width);expect(before.height).toBe(backing.height);
 await page.mouse.down();await page.waitForTimeout(80);expect(await snapshot(page)).toEqual(before);
 await page.mouse.up();await page.waitForTimeout(80);expect(await snapshot(page)).toEqual(before);
 await page.mouse.move(640,400);await page.waitForTimeout(80);expect(await snapshot(page)).toEqual(before);
 await page.mouse.move(685,445);await page.waitForTimeout(80);expect(await snapshot(page)).toEqual(before);
 // Cache invalidation at identical coordinates must preserve the rendered field.
 await page.mouse.move(640,400);await page.mouse.down();await page.mouse.move(665,425,{steps:4});await page.waitForTimeout(80);
 const fingerprint=async()=>createHash('sha256').update(await page.locator('canvas.map').evaluate(c=>c.toDataURL())).digest('hex');
 const incremental=await fingerprint();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('phosphora-theme-change',{detail:(window as any).__theme})));await page.waitForTimeout(100);
 expect(await fingerprint()).toEqual(incremental);
 await page.mouse.up();
});

test('GPU scene renders independently of the gesture canvas and survives context loss',async({page})=>{
 test.setTimeout(60000);
 await page.addInitScript(()=>{
  for(const prototype of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]){
   const get=prototype.getParameter;prototype.getParameter=function(parameter:number){return parameter===37446?'GPU test fixture':get.call(this,parameter);};
  }
 });
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await expect(page.locator('canvas.map')).toHaveAttribute('data-renderer','webgl');
 await importMap(page,{atoms:[makeAtom({title:'GPU atom',pinned:false,x:0,y:0,appearance:{color:'#ff3366'}})],links:[]});
 await expect(page.locator('canvas.map')).toHaveAttribute('data-nodes','1');
 await page.screenshot({path:'artifacts/gpu-map.png',animations:'disabled'});
 const screenshot=PNG.sync.read(await page.locator('canvas.map').screenshot({animations:'disabled'}));let pink=0;
 for(let i=0;i<screenshot.data.length;i+=4)if(screenshot.data[i]>screenshot.data[i+1]*1.3&&screenshot.data[i]>100)pink++;
 expect(pink).toBeGreaterThan(100);
 expect(await page.locator('canvas.map').evaluate(c=>{const pixels=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;return pixels.some((n,i)=>i%4===3&&n>0);})).toBe(false);
 await page.mouse.move(640,400);await page.mouse.down();await page.mouse.move(685,445,{steps:4});await page.mouse.up();
 const moved=(await readMap(page)).atoms[0];expect(moved.x).toBeCloseTo(45,0);expect(moved.y).toBeCloseTo(45,0);
 await page.locator('.gpu-map-host canvas').evaluate(c=>{const extension=(c.getContext('webgl2')||c.getContext('webgl'))!.getExtension('WEBGL_lose_context')!;(window as any).__context=extension;extension.loseContext();});
 await expect(page.locator('canvas.map')).toHaveAttribute('data-renderer','canvas');
 await expect(page.locator('.gpu-map-host')).toBeHidden();await page.evaluate(()=>(window as any).__context.restoreContext());await expect(page.locator('canvas.map')).toHaveAttribute('data-renderer','webgl');await expect(page.locator('.gpu-map-host')).toBeVisible();expect(errors).toEqual([]);
});

test('Canvas fallback remains interactive when WebGL is unavailable',async({page})=>{
 await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:string,...args:any[]):any{return type.includes('webgl')?null:(get as any).call(this,type,...args);};});
 await page.goto('/');await expect(page.locator('canvas.map')).toBeVisible();await page.locator('canvas.map').press('n');
 await page.getByRole('textbox',{name:'Название',exact:true}).fill('Fallback');await page.getByRole('button',{name:'Готово',exact:true}).click();
 await expect(page.locator('canvas.map')).toHaveAttribute('data-renderer','canvas');await expect(page.locator('canvas.map')).toHaveAttribute('data-nodes','1');
});


test('GPU textures stay consistent across zoom and theme cache refresh',async({page})=>{
 await page.addInitScript(()=>{
  window.addEventListener('phosphora-theme-change',e=>(window as any).__theme=(e as CustomEvent).detail);
  for(const prototype of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]){
   const get=prototype.getParameter;prototype.getParameter=function(parameter:number){return parameter===37446?'GPU test fixture':get.call(this,parameter);};
  }
 });
 await page.goto('/');const map=page.locator('canvas.map');await expect(map).toHaveAttribute('data-renderer','webgl');
 await importMap(page,{atoms:[makeAtom({id:'texture-a',title:'First',pinned:true,x:0,y:0,appearance:{icon:'X',size_override:18}}),makeAtom({id:'texture-b',title:'Second',pinned:true,x:2,y:1,appearance:{icon:'O',size_override:18}})],links:[]});
 await expect(map).toHaveAttribute('data-nodes','2');
 const toast=page.locator('.toast button');if(await toast.isVisible())await toast.click();
 for(const key of ['-','-','-','-','+','+','+','+']){
  await map.press(key);await page.waitForTimeout(700);
  const before=await map.screenshot({animations:'disabled'});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('phosphora-theme-change',{detail:(window as any).__theme})));
  await page.waitForTimeout(100);
  const after=await map.screenshot({animations:'disabled'});if(!after.equals(before)){writeFileSync('artifacts/zoom-cache-before.png',before);writeFileSync('artifacts/zoom-cache-after.png',after);console.log('CACHE_MISMATCH',await map.getAttribute('data-zoom'));}expect(createHash('sha256').update(after).digest('hex')).toBe(createHash('sha256').update(before).digest('hex'));
 }
});

test('GPU reuses raster textures when a pan takes an atom off screen and back',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{for(const prototype of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]){const get=prototype.getParameter;prototype.getParameter=function(parameter:number){return parameter===37446?'GPU test fixture':get.call(this,parameter);};}});
 await page.goto('/');const map=page.locator('canvas.map');await expect(map).toHaveAttribute('data-renderer','webgl');await importMap(page,{atoms:[makeAtom({id:'reuse',title:'Retained label',pinned:true,x:0,y:0})],links:[]});
 const gpu=page.locator('.gpu-map-host canvas');await expect(gpu).toHaveAttribute('data-texture-builds',/^[1-9]/);await page.mouse.move(1150,650);await page.mouse.down();const before=await gpu.getAttribute('data-texture-builds');
 await page.mouse.move(50,650,{steps:8});await expect(map).toHaveAttribute('data-camera-x','-1100');await page.mouse.move(1150,650,{steps:8});await expect(map).toHaveAttribute('data-camera-x','0');await expect(gpu).toHaveAttribute('data-texture-builds',before!);await page.mouse.up();
});
