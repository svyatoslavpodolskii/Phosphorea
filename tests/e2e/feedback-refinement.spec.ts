import {test,expect} from '@playwright/test';
import {openSettings,closeSettings,importMap} from './helpers';
import {makeAtom} from '../../src/core/model';
test.use({viewport:{width:390,height:844}});

test('direct appearance returns directly to settings; contrast lenses stay readable after press and hover',async({page})=>{
 await page.goto('/');await openSettings(page);await page.getByRole('button',{name:'Оформление',exact:false}).click();await expect(page.getByRole('button',{name:'← Настройки',exact:true})).toBeVisible();await page.getByRole('button',{name:'Чёрный бархат',exact:true}).click();await page.getByRole('button',{name:'← Настройки',exact:true}).click();await expect(page.locator('.settings-links>button')).toHaveCount(3);await closeSettings(page);
 const nav=page.getByRole('navigation',{name:'Линзы карты'});
 for(const name of ['Сейчас','Архив','Обычные']){const button=nav.getByRole('button',{name,exact:true});await button.click();await button.hover();const colors=await button.evaluate(el=>{const style=getComputedStyle(el),ctx=document.createElement('canvas').getContext('2d')!;ctx.fillStyle=style.color;ctx.fillRect(0,0,1,1);const fg=[...ctx.getImageData(0,0,1,1).data];ctx.fillStyle=style.backgroundColor;ctx.fillRect(0,0,1,1);return{fg,bg:[...ctx.getImageData(0,0,1,1).data]};});const lum=(c:number[])=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);expect((lum(colors.bg)+.05)/(lum(colors.fg)+.05)).toBeGreaterThanOrEqual(4.5);expect(colors.bg[0]).toBeGreaterThan(220);}
 await page.screenshot({path:'artifacts/feedback-contrast-mobile.png'});
});

test('map has no viewport outline, header symbols align and saving does not morph on camera writes',async({page})=>{
 await page.goto('/');const map=page.locator('canvas.map');await map.focus();expect(await map.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('none');const a=(await page.locator('.save-status svg').boundingBox())!,b=(await page.locator('.sound-toggle svg').boundingBox())!;expect(a.width).toBe(b.width);expect(Math.abs(a.y-b.y)).toBeLessThan(1);const shape=await page.locator('.save-status svg').innerHTML();await map.press('ArrowRight');await expect(page.locator('.save-status svg')).toHaveJSProperty('innerHTML',shape);await expect(page.locator('.save-status svg')).not.toHaveClass(/saving/);
});

test('animation plugin can be disabled persistently and respects reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-ui-motion','on');await openSettings(page);await page.getByRole('button',{name:'Плагины →',exact:true}).click();await page.locator('.plugin-row').filter({hasText:'Анимации'}).getByRole('button',{name:'Выключить',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-ui-motion','off');await closeSettings(page);await page.reload();await expect(page.locator('canvas.map')).toBeVisible();await expect(page.locator('.map-scene')).toHaveCSS('transform','none');await openSettings(page);await page.getByRole('button',{name:'Плагины →',exact:true}).click();await expect(page.locator('.plugin-row').filter({hasText:'Анимации'}).getByRole('button',{name:'Включить',exact:true})).toBeVisible();
});

test('an already unlocked contact sounds on pointer down before release',async({page})=>{
 await page.addInitScript(()=>{const Native=window.AudioContext;(window as any).__contacts=[];window.AudioContext=class extends Native{createBufferSource(){const source=super.createBufferSource(),start=source.start.bind(source);source.start=((...args:Parameters<AudioBufferSourceNode['start']>)=>{(window as any).__contacts.push(performance.now());start(...args);}) as typeof source.start;return source;}};});
 await page.goto('/');await page.getByRole('button',{name:'Меню карты',exact:true}).click();await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>(window as any).__contacts.length)).toBeGreaterThan(0);const count=await page.evaluate(()=>(window as any).__contacts.length);const box=(await page.getByRole('button',{name:'Открыть поиск',exact:true}).boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await expect.poll(()=>page.evaluate(()=>(window as any).__contacts.length)).toBeGreaterThan(count);await page.mouse.up();
});

test('drawing a lasso uses one continuous loop and preserves selection',async({page})=>{
 await page.addInitScript(()=>{const Native=window.AudioContext;(window as any).__lassoGrains=0;window.AudioContext=class extends Native{createBufferSource(){const source=super.createBufferSource(),start=source.start.bind(source);source.start=((...args:Parameters<AudioBufferSourceNode['start']>)=>{if(document.querySelector<HTMLElement>('canvas.map')?.dataset.gesture==='lasso'&&source.loop)(window as any).__lassoGrains++;start(...args);}) as typeof source.start;return source;}};});
 await page.goto('/');await importMap(page,{atoms:[makeAtom({title:'Левая',x:-60,pinned:true}),makeAtom({title:'Правая',x:60,pinned:true})],links:[]});await page.keyboard.down('Shift');await page.mouse.move(90,300);await page.mouse.down();for(const [x,y] of [[300,300],[300,540],[90,540],[90,300]]){await page.mouse.move(x,y,{steps:8});await page.waitForTimeout(120);}await page.mouse.up();await page.keyboard.up('Shift');await expect(page.locator('canvas.map')).toHaveAttribute('data-selection-count','2');expect(await page.evaluate(()=>(window as any).__lassoGrains)).toBe(1);await page.screenshot({path:'artifacts/feedback-lasso-mobile.png'});
});
