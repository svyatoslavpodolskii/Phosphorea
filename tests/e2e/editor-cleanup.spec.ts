import {sourceText} from './helpers';
import {test,expect} from '@playwright/test';
import {makeAtom} from '../../src/core/model';
import {closeSettings,focus,importMap,openSettings,readMap} from './helpers';

for(const mobile of [false,true])test(`editor primary controls and draft cancellation on ${mobile?'mobile':'desktop'}`,async({page})=>{
 await page.setViewportSize({width:mobile?390:1280,height:844});
 await page.goto('/');
 await expect(page.locator('canvas.map')).toBeVisible();
 await page.locator('canvas.map').press('n');
 const editor=page.getByRole('dialog',{name:'Редактор атома'});
 await expect(editor.getByRole('combobox',{name:'Тип',exact:true})).toBeVisible();
 await expect(editor.getByRole('combobox',{name:'Состояние'})).toContainText('Обычные');
 await expect(editor.getByRole('combobox',{name:'Состояние'})).toHaveAttribute('aria-expanded','false');
 await expect(editor.getByRole('toolbar',{name:'Форматирование текста'})).toBeVisible();
 await editor.getByRole('textbox',{name:'Название',exact:true}).fill('Discard this session');
 await (await sourceText(page)).fill('Unsaved body');
 await expect(editor.getByRole('status')).toHaveText('Черновик сохранён на устройстве');
 await editor.getByRole('button',{name:'Отмена',exact:true}).click();
 await expect(editor).toBeHidden();
 await page.reload();
 await expect(page.locator('canvas.map')).toHaveAttribute('data-nodes','0');
 await expect(editor).toBeHidden();
 await page.locator('canvas.map').press('n');
 await editor.getByRole('textbox',{name:'Название',exact:true}).fill('Keep this session');
 await (await sourceText(page)).fill('Original body');
 await editor.getByRole('button',{name:'Готово',exact:true}).click();
 await expect(editor).toBeHidden();
 await focus(page,'Keep this session');
 await expect(editor.getByRole('textbox',{name:'Визуальный текст',exact:true})).toContainText('Original body');
 await expect(editor.getByRole('toolbar')).toBeVisible();
 await editor.getByRole('button',{name:'Markdown',exact:true}).click();
 await (await sourceText(page)).fill('Changed body');
 await editor.getByRole('button',{name:'Меню заметки',exact:true}).click();
 await expect(editor.getByRole('button',{name:'Отложить',exact:true})).toHaveCount(0);await editor.getByRole('combobox',{name:'Состояние',exact:true}).click();await editor.getByRole('option',{name:'Архив',exact:true}).click();
 await editor.getByRole('button',{name:'Удалить заметку',exact:true}).click();
 await editor.locator('.confirm').getByRole('button',{name:'Отмена',exact:true}).click();
 await editor.locator('.note-heading').getByRole('button',{name:'Отмена',exact:true}).click();
 await expect(editor).toBeHidden();
 const snapshot=await readMap(page);
 expect(snapshot.atoms).toHaveLength(1);
 expect(snapshot.atoms[0]).toMatchObject({title:'Keep this session',content:'Original body',state:'normal',paused:false});
 await page.reload();
 await expect(page.locator('canvas.map')).toHaveAttribute('data-nodes','1');
 await expect(editor).toBeHidden();
});

test('legacy task type is preserved but cannot be chosen for other atoms',async({page})=>{
 await page.goto('/');
 await importMap(page,{atoms:[makeAtom({id:'legacy-task',title:'Legacy task',type:'task',content:'Legacy content',pinned:true})],links:[]});
 await openSettings(page);
 await page.getByRole('button',{name:'Плагины →',exact:true}).click();
 const templates=page.locator('.plugin-row').filter({hasText:'Типы заметок'});
 const enable=templates.getByRole('button',{name:'Включить',exact:true});
 if(await enable.count())await enable.click();
 await closeSettings(page);
 await focus(page,'Legacy task');
 const editor=page.getByRole('dialog',{name:'Редактор атома'});
 const type=editor.getByRole('combobox',{name:'Тип',exact:true});
 await expect(type).toContainText('Задача (устаревший тип)');
 await expect(type).toHaveAttribute('aria-expanded','false');

 await expect(editor.getByRole('textbox',{name:'Визуальный текст',exact:true})).toContainText('Legacy content');
 await editor.getByRole('textbox',{name:'Название',exact:true}).fill('Legacy task retained');
 await editor.getByRole('button',{name:'Готово',exact:true}).click();
 expect((await readMap(page)).atoms[0].type).toBe('task');
 await page.locator('canvas.map').press('n');
 await type.click();await expect(editor.getByRole('option',{name:'Задача (устаревший тип)',exact:true})).toHaveCount(0);
 await expect(editor.getByRole('option',{name:'Человек',exact:true})).toHaveCount(1);await type.press('Escape');
 await editor.getByRole('button',{name:'Отмена',exact:true}).click();
});

test('legacy pause can be resumed without offering new postponement',async({page})=>{
 await page.setViewportSize({width:1280,height:720});
 await page.goto('/');
 await importMap(page,{atoms:[makeAtom({title:'Pause me',state:'now',paused:true,pinned:true})],links:[]});
 const menu=page.getByRole('dialog',{name:'Действия с атомом'});
 const open=async()=>{
  await page.locator('canvas.map').click({position:{x:640,y:360},button:'right'});
  await expect(menu).toBeVisible();
 };
 // The map uses the viewport centre for a single atom.
 await open();
 await expect(menu.locator('.state-shortcuts').getByRole('button',{name:'Обычные',exact:true})).toBeVisible();
 await expect(menu.locator('.state-shortcuts').getByRole('button',{name:/Отложить|Пауза|Возобновить/})).toHaveCount(0);
 await expect(menu.getByRole('button',{name:'Отложить',exact:true})).toHaveCount(0);await menu.getByRole('button',{name:'Закрыть меню атома',exact:true}).click();
 expect((await readMap(page)).atoms[0]).toMatchObject({state:'now',paused:true});
 await open();
 await menu.getByRole('button',{name:'Возобновить',exact:true}).click();
 expect((await readMap(page)).atoms[0]).toMatchObject({state:'now',paused:false});
});
