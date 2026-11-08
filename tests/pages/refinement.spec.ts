import {test,expect} from '@playwright/test';
import {makeAtom} from '../../src/core/model';
import {importMap,readMap} from '../e2e/helpers';
test.use({viewport:{width:390,height:844},hasTouch:async({browserName},use)=>use(browserName==='chromium')});
test('first visit offers a tour, completes without editing data and can replay',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/Phosphorea/');await expect(page.getByRole('dialog',{name:'Знакомство с Phosphorea'})).toBeVisible();
 await page.screenshot({path:'artifacts/refinement-089-welcome.png'});
 await page.getByRole('button',{name:'Начать тур',exact:true}).click();
 for(let i=0;i<8;i++){
  const card=page.getByRole('dialog',{name:'Тур по карте'});await expect(card).toBeVisible();
  const b=(await card.boundingBox())!;expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(391);expect(b.y+b.height).toBeLessThanOrEqual(845);
  if(i===1)await page.screenshot({path:'artifacts/refinement-089-tour.png'});
  await page.getByRole('button',{name:i===7?'Готово':'Дальше',exact:true}).click();
 }
 await expect(page.locator('footer')).toContainText('0 атомов');await expect(page.locator('.zoom-control')).toHaveClass(/wheel/);
 await page.reload();await expect(page.locator('footer')).toBeVisible();await expect(page.locator('.tour-layer')).toHaveCount(0);
 await page.getByRole('button',{name:'Меню карты',exact:true}).click();await page.getByRole('button',{name:'Настройки и резервные копии',exact:true}).click();
 await expect(page.getByRole('link',{name:/Сообщить об ошибке/})).toHaveAttribute('href','https://t.me/Svyatoslav_Podolskii');
 await page.waitForTimeout(350);await page.screenshot({path:'artifacts/refinement-089-settings.png'});await page.getByRole('button',{name:'Тур по карте',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Знакомство с Phosphorea'})).toBeVisible();await page.getByRole('button',{name:'Не сейчас',exact:true}).click();expect(errors).toEqual([]);
});
test('drag tray toggles pinning without changing the note state or position',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('phosphorea:tour-v1','seen'));await page.goto('/Phosphorea/');
 await importMap(page,{atoms:[makeAtom({id:'pin-note',title:'Pin note',pinned:true})],links:[]});
 for(const action of ['unpin','pin']){
  await expect(page.locator('canvas.map')).toHaveAttribute('data-nodes','1');
  await expect(page.locator('canvas.map')).toHaveAttribute('data-transition','idle');
  const p=await page.locator('canvas.map').evaluate(el=>({x:195+Number(el.dataset.cameraX),y:422+Number(el.dataset.cameraY)}));
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.waitForTimeout(620);
  const zone=page.locator(`[data-atom-state=${action}]`);await expect(zone).toBeVisible();
  const b=(await zone.boundingBox())!;await page.screenshot({path:`artifacts/refinement-089-${action}-tray.png`});
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await page.mouse.up();
  await expect(page.locator('.state-drop-tray')).toHaveCount(0);
  const data=await readMap(page);expect(data.atoms[0]).toMatchObject({id:'pin-note',pinned:action==='pin',state:'normal',x:0,y:0});
 }
});
test('menu activation has one contact sound and mobile search keeps its vertical anchor',async({page,browserName})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('phosphorea:tour-v1','seen');const Native=window.AudioContext;(window as any).__cues=[];
  window.AudioContext=class extends Native{createBufferSource(){const source=super.createBufferSource(),start=source.start.bind(source);source.start=((...args:Parameters<AudioBufferSourceNode['start']>)=>{if(!source.loop)(window as any).__cues.push(source.buffer?.duration);start(...args);}) as typeof source.start;return source;}};
 });
 await page.goto('/Phosphorea/');await page.getByRole('button',{name:'Включить звук',exact:true}).click();await page.waitForTimeout(800);
 await page.evaluate(()=>(window as any).__cues=[]);const menu=page.getByRole('button',{name:'Меню карты',exact:true});if(browserName==='chromium')await menu.tap();else await menu.click();await page.waitForTimeout(300);
 expect(await page.evaluate(()=>(window as any).__cues.length)).toBe(1);await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Открыть поиск',exact:true}).click();await page.waitForTimeout(350);
 const before=(await page.locator('header .search').boundingBox())!;await page.getByRole('button',{name:'Закрыть поиск',exact:true}).click();
 await page.waitForTimeout(110);const during=(await page.locator('header .search').boundingBox())!;expect(Math.abs(during.y-before.y)).toBeLessThan(1);
 await page.waitForTimeout(300);const after=(await page.locator('header .search').boundingBox())!;expect(Math.abs(after.y-before.y)).toBeLessThan(1);expect(after.width).toBeLessThan(46);
 await page.screenshot({path:'artifacts/refinement-089-field.png'});
});
