import {test,expect} from '@playwright/test';
import {openSettings,closeSettings,importMap,readMap,focus,sourceText} from './helpers';
import {makeAtom} from '../../src/core/model';
test('workspace tools initialise without reactive errors',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>{errors.push(e.stack||e.message);console.log('PAGE ERROR',e.stack);});page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
 await page.goto('/');await expect(page.locator('main')).toHaveClass(/app-ready/);await openSettings(page);await expect(page.getByRole('button',{name:'Что нового',exact:true})).toBeVisible();expect(errors).toEqual([]);
});
test('desktop shortcut opens centred search; editor is spacious and centred',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/');await importMap(page,{atoms:[makeAtom({title:'Find this thought',pinned:true})],links:[]});
 await page.keyboard.press('Control+k');await expect(page.getByRole('textbox',{name:'Поиск',exact:true})).toBeFocused();
 const search=(await page.locator('.search-open').boundingBox())!;expect(Math.abs(search.x+search.width/2-720)).toBeLessThan(2);expect(search.width).toBeGreaterThan(600);
 await page.getByRole('textbox',{name:'Поиск',exact:true}).fill('Find');await page.keyboard.press('Enter');
 await expect(page.getByRole('dialog',{name:'Редактор атома'})).toBeVisible();const box=(await page.locator('.note-editor').boundingBox())!;expect(box.width).toBeGreaterThan(850);expect(Math.abs(box.x+box.width/2-720)).toBeLessThan(3);
 await page.screenshot({path:'artifacts/centred-editor.png',animations:'disabled'});
 await page.getByRole('button',{name:'Готово',exact:true}).click();await page.keyboard.press('Control+k');await page.keyboard.press('Escape');await expect(page.locator('.search-open')).toHaveCount(0);
});
test('editor remembers expansion, contains its scroll and edits Markdown tables',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/');
 await importMap(page,{atoms:[makeAtom({title:'Table note',content:'| Name | Value |\n| --- | --- |\n| Original | 42 |\n\n'+('Paragraph\n\n'.repeat(60))})],links:[]});
 await expect(page.locator('.zoom-controls')).toHaveCount(0);await expect(page.locator('.zoom-control')).toHaveCount(1);
 await focus(page,'Table note');await page.getByRole('button',{name:'Развернуть редактор',exact:true}).click();
 const table=page.locator('.rich-text table');await expect(table).toBeVisible();await table.locator('td').first().click();await page.keyboard.type('Edited ');
 const fields=page.locator('.note-fields');await fields.evaluate(el=>el.scrollTop=el.scrollHeight);
 const outer=(await page.locator('.note-editor').boundingBox())!,inner=(await fields.boundingBox())!;
 expect(inner.y).toBeGreaterThan(outer.y);expect(inner.y+inner.height).toBeLessThan(outer.y+outer.height);
 await page.screenshot({path:'artifacts/editor-contained-scroll.png',animations:'disabled'});
 await page.getByRole('button',{name:'Готово',exact:true}).click();await focus(page,'Table note');
 await expect(page.locator('.note-editor')).toHaveClass(/expanded/);await expect(table).toContainText('Edited');
 await page.getByRole('button',{name:'Готово',exact:true}).click();await page.reload();await focus(page,'Table note');await expect(page.locator('.note-editor')).toHaveClass(/expanded/);
});

test('interactive learning uses real editing and never writes practice thoughts into the diary',async({page})=>{
 await page.setViewportSize({width:1280,height:900});await page.goto('/');await importMap(page,{atoms:[makeAtom({title:'My private note',content:'Keep me',pinned:true})],links:[]});
 await openSettings(page);await page.getByRole('button',{name:'Тур по карте',exact:true}).click();await page.getByRole('button',{name:'Попробовать',exact:true}).click();
 const practice=page.locator('.practice'),map=practice.locator('canvas.map');await expect(map).toBeVisible();await map.focus();await map.press('n');
 await page.getByRole('textbox',{name:'Название',exact:true}).fill('My practice thought');await (await sourceText(page)).fill('This stays in memory');await page.getByRole('button',{name:'Готово',exact:true}).click();
 await expect(practice.getByRole('button',{name:'Дальше',exact:true})).toBeEnabled();await practice.getByRole('button',{name:'Дальше',exact:true}).click();await expect(practice).toHaveAttribute('data-step','1');
 await map.hover();await page.mouse.wheel(0,-160);await expect(practice.getByRole('button',{name:'Дальше',exact:true})).toBeEnabled();
 await practice.getByRole('button',{name:'Дальше',exact:true}).click();await expect(map).toHaveAttribute('data-nodes','2');
 await page.mouse.move(550,380);await page.mouse.down();await page.waitForTimeout(520);await page.mouse.move(740,470,{steps:12});await page.waitForTimeout(550);await page.mouse.up();await expect(practice.getByRole('button',{name:'Дальше',exact:true})).toBeEnabled();
 await practice.getByRole('button',{name:'Дальше',exact:true}).click();
 await page.keyboard.down('Shift');await page.mouse.move(430,300);await page.mouse.down();await page.mouse.move(850,300,{steps:8});await page.mouse.move(850,550,{steps:8});await page.mouse.move(430,550,{steps:8});await page.mouse.move(430,300,{steps:8});await page.mouse.up();await page.keyboard.up('Shift');await expect(practice.getByRole('button',{name:'Дальше',exact:true})).toBeEnabled();
 await practice.getByRole('button',{name:'Дальше',exact:true}).click();await map.click({position:{x:740,y:470},button:'right'});await practice.locator('.practice-menu').getByRole('button',{name:'Сейчас',exact:true}).click();await expect(practice.getByRole('button',{name:'Дальше',exact:true})).toBeEnabled();
 await practice.getByRole('button',{name:'Дальше',exact:true}).click();await practice.getByRole('button',{name:'Поиск в учебной карте'}).click();await practice.getByRole('textbox',{name:'Найти учебную мысль'}).fill('practice');await practice.locator('.practice-search').getByRole('button',{name:'My practice thought',exact:true}).click();await expect(practice.getByRole('button',{name:'Дальше',exact:true})).toBeEnabled();
 await practice.getByRole('button',{name:'Дальше',exact:true}).click();await practice.locator('.practice-themes button').last().click();await expect(practice.getByRole('button',{name:'К моей карте',exact:true})).toBeEnabled();
 await page.screenshot({path:'artifacts/interactive-learning.png',animations:'disabled'});await practice.getByRole('button',{name:'Завершить обучение',exact:true}).click();
 expect((await readMap(page)).atoms.map(a=>a.title)).toEqual(['My private note']);
});
