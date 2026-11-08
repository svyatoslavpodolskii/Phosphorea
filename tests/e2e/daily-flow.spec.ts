import {sourceText} from './helpers';
import {test,expect} from '@playwright/test';
import {openSettings,closeSettings,readMap,importMap} from './helpers';
import {makeAtom,makeLink} from '../../src/core/model';
test.use({viewport:{width:390,height:844}});

test('search capture in Now survives reload as a draft, commits once and keeps its lens',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());await page.goto('/');await expect(page.locator('canvas.map')).toBeVisible();
 await page.getByRole('button',{name:'Сейчас',exact:true}).click();await page.getByRole('button',{name:'Открыть поиск',exact:true}).click();await page.getByRole('textbox',{name:'Поиск',exact:true}).fill('Quick daily thought');await page.locator('.search-create').click();
 await expect(page.getByRole('textbox',{name:'Название',exact:true})).toHaveValue('Quick daily thought');await expect(page.getByRole('combobox',{name:'Состояние',exact:true})).toContainText('Сейчас');await (await sourceText(page)).fill('Unfinished text survives a mobile restart');await page.waitForTimeout(650);
 await page.reload();await expect(page.getByRole('dialog',{name:'Редактор атома',exact:true})).toBeVisible();await expect(page.getByRole('textbox',{name:'Название',exact:true})).toHaveValue('Quick daily thought');await expect((await sourceText(page))).toHaveValue('Unfinished text survives a mobile restart');await page.getByRole('button',{name:'Готово',exact:true}).click();await expect(page.getByRole('dialog',{name:'Редактор атома',exact:true})).toBeHidden();await expect(page.getByRole('button',{name:'Сейчас',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.reload();await expect(page.locator('canvas.map')).toBeVisible();await expect(page.getByRole('dialog',{name:'Редактор атома',exact:true})).toHaveCount(0);const data=await readMap(page);expect(data.atoms).toHaveLength(1);expect(data.atoms[0]).toMatchObject({title:'Quick daily thought',state:'now',content:'Unfinished text survives a mobile restart'});expect(errors).toEqual([]);
});

test('discarded text does not return and update checking is available',async({page})=>{
 page.on('dialog',dialog=>dialog.accept());await page.goto('/');await expect(page.locator('canvas.map')).toBeVisible();await page.locator('canvas.map').press('n');await page.getByRole('textbox',{name:'Название',exact:true}).fill('Discard this');await page.waitForTimeout(500);await page.locator('.note-metadata > summary').click();await page.getByRole('button',{name:'Удалить черновик',exact:true}).click();await expect(page.getByRole('dialog',{name:'Редактор атома',exact:true})).toBeHidden();await page.reload();await expect(page.locator('canvas.map')).toBeVisible();await expect(page.getByRole('dialog',{name:'Редактор атома',exact:true})).toHaveCount(0);await openSettings(page);await expect(page.getByRole('button',{name:'Проверить обновление',exact:true})).toBeVisible();await closeSettings(page);
});

test('drag through overlapping bodies preserves every unheld position after release',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');const atoms=[makeAtom({id:'held',title:'Held',x:-90,y:0}),makeAtom({id:'still',title:'Still',x:90,y:0}),makeAtom({id:'island',title:'Island',x:0,y:240})];await importMap(page,{atoms,links:[makeLink('held','still')]});const canvas=page.locator('canvas.map');await expect(canvas).toHaveAttribute('data-nodes','3');const box=(await canvas.boundingBox())!;
 await page.mouse.move(box.x+box.width/2-90,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+88,box.y+box.height/2,{steps:30});await page.mouse.up();await page.waitForTimeout(600);const saved=await readMap(page);expect(saved.atoms.find(a=>a.id==='still')).toMatchObject({x:90,y:0});expect(saved.atoms.find(a=>a.id==='island')).toMatchObject({x:0,y:240});expect(saved.atoms.find(a=>a.id==='held')!.x).toBeCloseTo(88,0);
});
