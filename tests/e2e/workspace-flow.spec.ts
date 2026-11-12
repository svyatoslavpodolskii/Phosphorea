import {test,expect} from '@playwright/test';
import {openSettings,closeSettings,importMap,readMap,focus,sourceText} from './helpers';
import {makeAtom} from '../../src/core/model';
import {FOLDER_DEFINITIONS,FOLDER_MEMBERSHIP} from '../../src/graph/folders';

test('soft lenses retain archived notes while folder contours follow foreground content',async({page})=>{
 await page.goto('/');const a=makeAtom({id:'normal-root',title:'Work',pinned:true,properties:{[FOLDER_DEFINITIONS]:[{id:'work',name:'Work',color:'#75aee8',roots:['normal-root']}]}}),b=makeAtom({id:'archived-member',title:'Archived work',pinned:true,x:180,state:'archived',properties:{[FOLDER_MEMBERSHIP]:{work:1}}}),c=makeAtom({id:'archive-root',title:'Old diary',pinned:true,x:-180,state:'archived',properties:{[FOLDER_DEFINITIONS]:[{id:'old',name:'Old',color:'#b398dd',roots:['archive-root']}]}});
 await importMap(page,{atoms:[a,b,c],links:[]});await expect(page.locator('canvas.map')).toHaveAttribute('data-nodes','3');await expect(page.locator('.folder-territories path')).toHaveCount(1);
 await page.screenshot({path:'artifacts/folders-layout097.png',animations:'disabled'});
 await page.locator('footer nav').getByRole('button',{name:'Архив',exact:true}).click();await expect(page.locator('canvas.map')).toHaveAttribute('data-nodes','3');await expect(page.locator('.folder-territories path')).toHaveCount(2);
 await page.locator('footer nav').getByRole('button',{name:'Сейчас',exact:true}).click();await expect(page.locator('canvas.map')).toHaveAttribute('data-nodes','3');await expect(page.locator('.folder-territories path')).toHaveCount(0);
 await page.getByRole('button',{name:'Old 1',exact:true}).click();await expect(page.locator('footer nav').getByRole('button',{name:'Архив',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('workspace tools initialise without reactive errors',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>{errors.push(e.stack||e.message);console.log('PAGE ERROR',e.stack);});page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
 await page.goto('/');await expect(page.locator('main')).toHaveClass(/app-ready/);await openSettings(page);await expect(page.getByRole('button',{name:'Что нового',exact:true})).toBeVisible();expect(errors).toEqual([]);
});

test('mobile search is centred and thumb reachable; double tapping the wheel restores overview',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await importMap(page,{atoms:[makeAtom({title:'Mobile thought'})],links:[]});
 const trigger=page.getByRole('button',{name:'Открыть поиск',exact:true});expect((await trigger.boundingBox())!.y).toBeGreaterThan(500);await trigger.click();
 const box=(await page.locator('.search-open').boundingBox())!;expect(Math.abs(box.x+box.width/2-195)).toBeLessThan(1);
 await expect(page.getByRole('textbox',{name:'Поиск',exact:true})).toBeFocused();await expect(page.getByRole('button',{name:'Меню карты',exact:true})).toBeHidden();
 await page.screenshot({path:'artifacts/mobile-search-097.png',animations:'disabled'});await page.getByRole('button',{name:'Закрыть поиск',exact:true}).click();
 const wheel=page.locator('.rotary');await wheel.press('End');await expect(wheel).toHaveAttribute('aria-valuenow','100');await wheel.dblclick();await expect.poll(async()=>Number(await wheel.getAttribute('aria-valuenow'))).toBeLessThan(2);
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

test('search exits in place before its compact button returns',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:900});await page.goto('/');await expect(page.locator('main')).toHaveClass(/app-ready/);
 await page.keyboard.press('Control+k');const before=(await page.locator('.search-open').boundingBox())!;await page.getByRole('button',{name:'Закрыть поиск',exact:true}).click();
 const closing=page.locator('.search-closing');await expect(closing).toHaveCount(1);const box=(await closing.boundingBox())!;expect(Math.abs(box.x+box.width/2-before.x-before.width/2)).toBeLessThan(2);
 await expect(closing).toHaveCount(0);await page.keyboard.press('Control+k');await expect(page.getByRole('textbox',{name:'Поиск',exact:true})).toBeFocused();
});

test('a touch pinch flick continues beyond the released scale and a new touch grabs it',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:390,height:844});await page.goto('/');await importMap(page,{atoms:[makeAtom({title:'Kinetic',pinned:true})],links:[]});
 const map=page.locator('canvas.map');await expect(map).toHaveAttribute('data-transition','idle');const initial=Number(await map.getAttribute('data-zoom')),cdp=await page.context().newCDPSession(page);
 const points=(distance:number)=>[{x:195-distance/2,y:350,id:1},{x:195+distance/2,y:350,id:2}];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(100)});
 for(let i=1;i<=6;i++){await page.waitForTimeout(16);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(100+i*5)});}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(async()=>Number(await map.getAttribute('data-zoom'))).toBeGreaterThan(initial*1.3*1.05);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:80,y:300,id:3}]});await page.waitForTimeout(40);const stopped=Number(await map.getAttribute('data-zoom'));await page.waitForTimeout(100);expect(Number(await map.getAttribute('data-zoom'))).toBeCloseTo(stopped,4);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
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
 await page.getByRole('button',{name:'Готово',exact:true}).click();await expect(page.locator('.note-editor')).toHaveCount(0);await page.waitForFunction(()=>!history.state?.phosphoraSurface);await page.reload();await focus(page,'Table note');await expect(page.locator('.note-editor')).toHaveClass(/expanded/);
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
