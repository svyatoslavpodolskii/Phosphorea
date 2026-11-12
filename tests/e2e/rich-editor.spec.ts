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
