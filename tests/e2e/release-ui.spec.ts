import {test,expect} from '@playwright/test';
import {openSettings,closeSettings,importMap,focus} from './helpers';
import type {Page} from '@playwright/test';
async function settled(page:Page){if(!await page.locator('.scrim').count())return;await expect.poll(()=>page.locator('.scrim').last().evaluate(el=>getComputedStyle(el).opacity)).toBe('1');await expect.poll(()=>page.locator('.editor').last().evaluate(el=>getComputedStyle(el).opacity)).toBe('1');}
import {makeAtom} from '../../src/core/model';

test('release history appears once after an upgrade and remains available in settings',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.addInitScript(()=>{if(!localStorage.getItem('release-test-started')){localStorage.setItem('phosphorea:release-seen','0.9.3');localStorage.setItem('release-test-started','yes');}});
 await page.goto('/');
 const notes=page.getByRole('dialog',{name:'Больше ясности, меньше прерываний'});
 await expect(notes).toBeVisible();await settled(page);await page.screenshot({path:'artifacts/release-desktop.png'});
 await notes.getByRole('button',{name:'Продолжить',exact:true}).click();
 await page.reload();await expect(page.locator('main')).toHaveClass(/app-ready/);await expect(notes).toHaveCount(0);
 await openSettings(page);await page.getByRole('button',{name:'Что нового',exact:true}).click();await expect(notes).toBeVisible();
 await notes.getByRole('button',{name:'Предыдущие версии'}).click();await expect(notes.getByText('Заметки путешествуют вместе с вами')).toBeVisible();
 await page.keyboard.press('Escape');await expect(notes).toHaveCount(0);
});

test('desktop surfaces fit short and wide windows; mobile release notes remain readable',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1366,height:768});await page.goto('/');
 const note=makeAtom({title:'Рабочая заметка с длинным названием для проверки desktop-интерфейса',content:'- [ ] #task Подготовить релиз\n- [ ] #task Проверить вёрстку\n\nТекст заметки. '.repeat(12),pinned:true});
 await importMap(page,{atoms:[note],links:[]});
 await openSettings(page);await expect(page.getByRole('button',{name:'Что нового',exact:true})).toBeVisible();await settled(page);await page.screenshot({path:'artifacts/settings-desktop.png',animations:'disabled'});
 const overflow=()=>page.locator('.editor').evaluateAll(nodes=>nodes.map(el=>({width:el.clientWidth,scroll:el.scrollWidth,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom})));
 for(const item of await overflow()){expect(item.scroll).toBeLessThanOrEqual(item.width+1);expect(item.top).toBeGreaterThanOrEqual(0);expect(item.bottom).toBeLessThanOrEqual(768);}
 await closeSettings(page);await focus(page,note.title);await expect(page.getByRole('textbox',{name:'Название',exact:true})).toBeVisible();await settled(page);await page.screenshot({path:'artifacts/editor-desktop.png',animations:'disabled'});
 for(const item of await overflow()){expect(item.scroll).toBeLessThanOrEqual(item.width+1);expect(item.top).toBeGreaterThanOrEqual(0);expect(item.bottom).toBeLessThanOrEqual(768);}
 await page.getByRole('button',{name:'Готово',exact:true}).click();
 await page.getByRole('button',{name:'Канбан',exact:true}).click();await expect(page.locator('.board-lanes')).toBeVisible();await settled(page);await page.screenshot({path:'artifacts/kanban-desktop.png',animations:'disabled'});
 expect(await page.locator('.kanban').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.getByRole('button',{name:'Поле',exact:true}).click();
 await page.setViewportSize({width:1024,height:600});await openSettings(page);
 await page.getByRole('button',{name:'Плагины →',exact:true}).click();await settled(page);await page.screenshot({path:'artifacts/plugins-desktop-short.png'});
 for(const item of await overflow()){expect(item.scroll).toBeLessThanOrEqual(item.width+1);expect(item.top).toBeGreaterThanOrEqual(0);expect(item.bottom).toBeLessThanOrEqual(600);}
 await closeSettings(page);await page.setViewportSize({width:390,height:844});await openSettings(page);await page.getByRole('button',{name:'Что нового',exact:true}).click();
 await settled(page);await page.screenshot({path:'artifacts/release-mobile.png'});
 const panel=page.locator('.release-notes');expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await expect(panel.getByRole('button',{name:'Продолжить',exact:true})).toBeInViewport();
 expect(errors).toEqual([]);
});
