import {test,expect,type Page} from '@playwright/test';
import {openSettings,closeSettings} from './helpers';

const backdrop=(page:Page)=>page.locator('svg.theme-backdrop');
const transforms=(page:Page)=>backdrop(page).locator('pattern').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('patternTransform')));
async function boot(page:Page){await page.goto('/');await page.waitForLoadState('networkidle');await expect(page.locator('canvas.map')).toBeVisible();}
async function setMode(page:Page,mode:string){
 await openSettings(page);await page.getByRole('button',{name:'Плагины →',exact:true}).click();await page.locator('.plugin-row').filter({hasText:'Темы и атмосфера'}).getByRole('button',{name:'Настройки',exact:true}).click();
 await page.getByRole('button',{name:'Настроить тему',exact:true}).click();
 await page.getByLabel('Рисунок фона',{exact:true}).selectOption('night-sky');
 await page.getByLabel('Движение фона',{exact:true}).selectOption(mode);
 await page.getByRole('button',{name:'Сохранить тему',exact:true}).click();
 await closeSettings(page);
 await expect(backdrop(page)).toHaveAttribute('data-mode',mode);
}
async function pan(page:Page){
 const box=(await page.locator('canvas.map').boundingBox())!;
 await page.mouse.move(box.x+box.width*.45,box.y+box.height*.55);
 await page.mouse.down();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.6,{steps:12});await page.mouse.up();
}
async function checkPalette(page:Page){
 const ratios=await page.locator('html').evaluate(root=>{
  const style=getComputedStyle(root),color=(key:string)=>style.getPropertyValue('--theme-'+key).trim();
  const lum=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const contrast=(a:string,b:string)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
  return [...['background','surface','surfaceAlt'].flatMap(bg=>['text','muted','accent','danger','warning'].map(fg=>({pair:fg+'/'+bg,ratio:contrast(color(fg),color(bg))}))),{pair:'onAccent/accent',ratio:contrast(color('onAccent'),color('accent'))}];
 });
 for(const {pair,ratio} of ratios)expect(ratio,pair).toBeGreaterThanOrEqual(4.5);
}

test('four contrast and soft presets apply readable palettes and survive reload',async({page})=>{
 await boot(page);await openSettings(page);await page.getByRole('button',{name:'Плагины →',exact:true}).click();await page.locator('.plugin-row').filter({hasText:'Темы и атмосфера'}).getByRole('button',{name:'Настройки',exact:true}).click();
 for(const [name,id] of [['Тёмная контрастная','dark-contrast'],['Светлая контрастная','light-contrast'],['Мягкая тёмная','soft-dark'],['Мягкая светлая','soft-light']]){
  await page.getByRole('button',{name,exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme',id);await checkPalette(page);
 }
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','soft-light');await checkPalette(page);
});

test('camera modes reuse bounded decoration nodes while panning and zooming',async({page})=>{
 await boot(page);await setMode(page,'static');
 const initial=await transforms(page);
 await pan(page);await page.getByRole('slider',{name:'Масштаб карты',exact:true}).fill('70');
 await expect.poll(()=>page.locator('canvas.map').getAttribute('data-zoom')).not.toBe('1');
 expect(await transforms(page)).toEqual(initial);
 await setMode(page,'world');
 // Retain actual nodes, so replacing the field with an equivalent set also fails.
 await backdrop(page).evaluate(el=>{(globalThis as any).__themePoints=[...el.querySelectorAll('pattern > g')];});
 const world=await transforms(page);
 await pan(page);await expect.poll(()=>transforms(page)).not.toEqual(world);
 const panTransforms=await transforms(page);
 await page.getByRole('slider',{name:'Масштаб карты',exact:true}).fill('70');
 await expect.poll(()=>transforms(page)).not.toEqual(panTransforms);
 const matrices=await transforms(page);expect(new Set(matrices).size).toBe(1);
 await setMode(page,'parallax');const parallax=await transforms(page);
 // Changing a saved theme may remount the backdrop. Only camera changes must reuse it.
 await backdrop(page).evaluate(el=>{(globalThis as any).__themePoints=[...el.querySelectorAll('pattern > g')];});
 await pan(page);await expect.poll(()=>transforms(page)).not.toEqual(parallax);
 expect(new Set(await transforms(page)).size).toBe(3);
 expect(await backdrop(page).locator('pattern > g').count()).toBeLessThanOrEqual(240);
 expect(await backdrop(page).evaluate(el=>{
  const before=(globalThis as any).__themePoints as Element[];
  const after=[...el.querySelectorAll('pattern > g')];
  return before.length===after.length&&before.every((node,i)=>node===after[i]);
 })).toBe(true);
});

test('mode persists through export/import and reduced motion disables decorative movement',async({page})=>{
 await boot(page);await setMode(page,'parallax');await openSettings(page);await page.getByRole('button',{name:'Плагины →',exact:true}).click();await page.locator('.plugin-row').filter({hasText:'Темы и атмосфера'}).getByRole('button',{name:'Настройки',exact:true}).click();
 await page.locator('.theme-files>summary').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Экспорт темы',exact:true}).click();
 const stream=await(await pending).createReadStream();let text='';for await(const chunk of stream!)text+=chunk.toString();
 expect(JSON.parse(text).theme.effects.mode).toBe('parallax');
 await page.getByLabel('Импорт темы',{exact:true}).setInputFiles({name:'motion.json',mimeType:'application/json',buffer:Buffer.from(text)});
 await closeSettings(page);await page.reload();await expect(backdrop(page)).toHaveAttribute('data-mode','parallax');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(backdrop(page)).toHaveAttribute('data-mode','static');
 const before=await transforms(page);await pan(page);expect(await transforms(page)).toEqual(before);
 expect(await backdrop(page).locator('.spark').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await page.emulateMedia({reducedMotion:'no-preference'});await expect(backdrop(page)).toHaveAttribute('data-mode','parallax');
 // Exercise the same listener as a hidden browser tab without relying on headless focus.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(backdrop(page)).toHaveClass(/sleeping/);
 expect(await backdrop(page).locator('.spark').first().evaluate(el=>getComputedStyle(el).animationPlayState)).toBe('paused');
});
