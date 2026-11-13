import {test,expect} from '@playwright/test';
import {focus,importMap,readMap,sourceText} from './helpers';
import {makeAtom} from '../../src/core/model';

test('visual typing, formatting, checklist, source mode and cancel',async({page})=>{
 await page.goto('/');await expect(page.locator('canvas.map')).toBeVisible();await page.locator('canvas.map').press('n');
 await page.getByRole('textbox',{name:'Название',exact:true}).fill('Visual note');
 const visual=page.getByRole('textbox',{name:'Визуальный текст',exact:true});
 await expect(visual).toBeVisible();await visual.fill('Hello world');
 await visual.press('Control+a');await page.getByRole('button',{name:'Жирный',exact:true}).click();
 await expect(visual.locator('strong')).toHaveText('Hello world');
 await page.getByRole('button',{name:'Готово',exact:true}).click();
 expect((await readMap(page)).atoms[0].content).toContain('**Hello world**');
 await focus(page,'Visual note');await page.getByRole('button',{name:'Обычный',exact:true}).click();
 await expect(visual.locator('strong')).toHaveText('Hello world');
 await visual.press('Control+End');await visual.press('Enter');await page.getByRole('button',{name:'Чек-лист',exact:true}).click();await page.keyboard.type('Check me');
 await expect(visual.getByRole('checkbox')).toHaveCount(1);await visual.getByRole('checkbox').check();
 const source=await sourceText(page);await expect(source).toHaveValue(/\[x\].*Check me/);
 await page.getByRole('button',{name:'Отмена',exact:true}).click();
 expect((await readMap(page)).atoms[0].content).toContain('**Hello world**');
 expect((await readMap(page)).atoms[0].content).not.toContain('Check me');
});

test('visual edits preserve untouched Markdown, wiki references and unsupported blocks',async({page})=>{
 await page.goto('/');
 const original='Editable paragraph\r\n\r\n[[Target|Alias]]\r\n\r\n| A | B |\r\n| - | - |\r\n| x | y |\r\n\r\n<div data-custom="yes">Unknown HTML</div>\r\n';
 await importMap(page,{atoms:[makeAtom({title:'Source preservation',content:original}),makeAtom({title:'Target'})],links:[]});
 await focus(page,'Source preservation');await page.getByRole('button',{name:'Обычный',exact:true}).click();
 const visual=page.getByRole('textbox',{name:'Визуальный текст',exact:true});
 await expect(visual.locator('[data-source-block]')).toHaveCount(1);
 await expect(visual.locator('table')).toHaveCount(1);
 await expect(visual.locator('[data-wiki-reference]')).toHaveText('Alias');
 await visual.locator('p').first().click();await page.keyboard.press('Home');await page.keyboard.type('Changed ');
 await page.getByRole('button',{name:'Готово',exact:true}).click();
 const saved=(await readMap(page)).atoms.find(a=>a.title==='Source preservation')!.content;
 expect(saved).toContain('Changed Editable paragraph');
 expect(saved).toContain(original.slice(original.indexOf('[[Target')));
 await focus(page,'Source preservation');await page.getByRole('textbox',{name:'Название',exact:true}).fill('Title only');await page.getByRole('button',{name:'Готово',exact:true}).click();
 expect((await readMap(page)).atoms.find(a=>a.title==='Title only')!.content).toBe(saved);
});

test('blank paragraphs survive save and reload, and a fresh note does not inherit italic',async({page})=>{
 await page.goto('/');await expect(page.locator('canvas.map')).toBeVisible();await page.locator('canvas.map').press('n');
 const title=page.getByRole('textbox',{name:'\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435',exact:true}),visual=page.getByRole('textbox',{name:'\u0412\u0438\u0437\u0443\u0430\u043b\u044c\u043d\u044b\u0439 \u0442\u0435\u043a\u0441\u0442',exact:true});await title.fill('Paragraph spacing');await visual.fill('First');await visual.press('End');await visual.press('Enter');await visual.press('Enter');await visual.press('Enter');await page.keyboard.type('Last');await expect(visual.locator('p')).toHaveCount(4);await page.getByRole('button',{name:'Markdown',exact:true}).click();await page.getByRole('button',{name:'\u041e\u0431\u044b\u0447\u043d\u044b\u0439',exact:true}).click();await expect(visual.locator('p')).toHaveCount(4);
 const colors=await visual.evaluate(el=>({body:getComputedStyle(el.querySelector('p')!).color,normal:getComputedStyle(el).color}));expect(colors.body).toBe(colors.normal);
 await page.getByRole('button',{name:'\u0413\u043e\u0442\u043e\u0432\u043e',exact:true}).click();const saved=(await readMap(page)).atoms[0].content;expect(saved).toMatch(/First\n{4}Last/);
 await focus(page,'Paragraph spacing');await expect(visual.locator('p')).toHaveCount(4);await visual.press('Control+End');await visual.press('Control+i');await page.keyboard.type(' italic');await expect(visual.locator('em')).toHaveText(' italic');await page.getByRole('button',{name:'\u0413\u043e\u0442\u043e\u0432\u043e',exact:true}).click();
 await expect(page.locator('.note-editor')).not.toBeVisible();await page.locator('canvas.map').press('n');await title.fill('Fresh');const icon=await page.locator('.draft-indicator svg').innerHTML();await visual.fill('Plain');await expect(visual.locator('em')).toHaveCount(0);await expect(page.locator('.draft-indicator svg')).toHaveJSProperty('innerHTML',icon);await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/editor-quiet-save-mobile.png'});
});
