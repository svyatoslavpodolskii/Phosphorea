import {test,expect,type Page} from '@playwright/test';
import {importMap,readMap,focus,openSettings,closeSettings} from '../e2e/helpers';
import {makeAtom} from '../../src/core/model';
async function sync(page:Page){await page.getByRole('button',{name:'Устройства и синхронизация',exact:true}).click();await expect(page.getByRole('heading',{name:'Ваши устройства'})).toBeVisible();}
async function imported(page:Page){await page.getByRole('button',{name:'Выбрать хранилище',exact:true}).click();await page.getByRole('button',{name:/Основное · 2/}).click();await expect(page.locator('footer')).toBeVisible();}
test('persistent bilateral sync keeps workspaces and coordinates, shares plugins and reconnects after reload',async({browser})=>{
 const a=await browser.newContext(),b=await browser.newContext(),pa=await a.newPage(),pb=await b.newPage(),errors:string[]=[];
 for(const p of [pa,pb]){p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>localStorage.setItem('phosphorea:tour-v1','seen'));}
 await pa.goto('http://127.0.0.1:4312/');await pb.goto('http://127.0.0.1:4313/');
 await importMap(pa,{atoms:[makeAtom({id:'laptop-note',title:'Laptop note',x:320,y:-180,content:'Computer text'})],links:[]});
 await importMap(pb,{atoms:[makeAtom({id:'phone-note',title:'Phone note',x:-240,y:360,content:'Phone text'})],links:[]});
 await sync(pa);await expect(pa.getByRole('button',{name:/Показать QR/})).toBeEnabled();await pa.getByRole('button',{name:/Показать QR/}).click();await pa.getByRole('button',{name:'Скопировать ссылку',exact:true}).click();
 // Read the app-generated invitation through its explicit link fallback.
 const textarea=pa.getByRole('textbox',{name:'Ссылка для другого устройства'});
 if(!await textarea.count())await pa.context().grantPermissions(['clipboard-read','clipboard-write']);
 const link=await textarea.count()?await textarea.inputValue():await pa.evaluate(()=>navigator.clipboard.readText());
 await sync(pb);await expect(pb.getByRole('button',{name:'Подключиться по ссылке',exact:true})).toBeEnabled();await pb.getByRole('button',{name:'Подключиться по ссылке',exact:true}).click();await pb.getByRole('textbox',{name:'Ссылка подключения'}).fill(link);await pb.getByRole('button',{name:'Подключиться',exact:true}).click();
 for(const p of [pa,pb])await expect(p.getByRole('button',{name:'Да, совпадают',exact:true})).toBeVisible();
 for(const p of [pa,pb])await p.getByRole('button',{name:'Да, совпадают',exact:true}).click();
 for(const p of [pa,pb]){await expect(p.getByRole('heading',{name:'Карты синхронизированы',exact:true})).toBeVisible();await p.getByRole('button',{name:'Закрыть синхронизацию'}).click();}
 expect((await readMap(pa)).atoms.map(a=>a.id)).toEqual(['laptop-note']);expect((await readMap(pb)).atoms.map(a=>a.id)).toEqual(['phone-note']);
 await imported(pb);expect((await readMap(pb)).atoms[0]).toMatchObject({id:'laptop-note',x:320,y:-180});
 await focus(pa,'Laptop note');await pa.getByRole('button',{name:'Markdown',exact:true}).click();await pa.getByRole('textbox',{name:'Текст',exact:true}).fill('Live update from computer');await pa.getByRole('button',{name:'Готово',exact:true}).click();
 await expect.poll(async()=>(await readMap(pb)).atoms[0]?.content,{timeout:20000}).toBe('Live update from computer');
 await focus(pb,'Laptop note');await pb.getByRole('button',{name:'Markdown',exact:true}).click();await pb.getByRole('textbox',{name:'Текст',exact:true}).fill('Reply from phone');await pb.getByRole('button',{name:'Готово',exact:true}).click();
 await expect.poll(async()=>(await readMap(pa)).atoms[0]?.content,{timeout:20000}).toBe('Reply from phone');
 await pb.reload();await expect(pb.locator('footer')).toBeVisible();await pa.reload();await expect(pa.locator('footer')).toBeVisible();
 await focus(pa,'Laptop note');await pa.getByRole('button',{name:'Markdown',exact:true}).click();await pa.getByRole('textbox',{name:'Текст',exact:true}).fill('After reopening both apps');await pa.getByRole('button',{name:'Готово',exact:true}).click();
 await expect.poll(async()=>(await readMap(pb)).atoms[0]?.content,{timeout:30000}).toBe('After reopening both apps');
 expect((await readMap(pb)).atoms[0]).toMatchObject({x:320,y:-180});
 await openSettings(pa);await pa.getByRole('button',{name:'Плагины →',exact:true}).click();const row=pa.locator('.plugin-row').filter({hasText:'Волшебное лассо'});await row.getByRole('button',{name:'Выключить',exact:true}).click();await closeSettings(pa);
 await expect.poll(async()=>{await openSettings(pb);await pb.getByRole('button',{name:'Плагины →',exact:true}).click();const disabled=await pb.locator('.plugin-row').filter({hasText:'Волшебное лассо'}).getByRole('button',{name:'Включить',exact:true}).count();await closeSettings(pb);return disabled;},{timeout:20000}).toBe(1);
 const phoneTheme=await pb.locator('html').getAttribute('data-theme');
 await openSettings(pa);await pa.getByRole('button',{name:'Плагины →',exact:true}).click();await pa.locator('.plugin-row').filter({hasText:'Темы и атмосфера'}).getByRole('button',{name:'Настройки',exact:true}).click();await pa.getByRole('button',{name:'Светлая',exact:true}).click();await closeSettings(pa);
 await pa.waitForTimeout(2500);expect(await pb.locator('html').getAttribute('data-theme')).toBe(phoneTheme);
 await sync(pb);await pb.locator('.sync-preferences summary').click();await pb.getByLabel('Синхронизировать оформление').check();await pb.getByRole('button',{name:'Закрыть синхронизацию'}).click();
 await expect.poll(()=>pb.locator('html').getAttribute('data-theme'),{timeout:20000}).toBe(await pa.locator('html').getAttribute('data-theme'));
 await sync(pb);await pb.locator('.sync-preferences summary').click();await pb.getByRole('combobox',{name:'Получать плагины на это устройство'}).click();await pb.getByRole('option',{name:'Свои плагины',exact:true}).click();await pb.getByRole('button',{name:'Закрыть синхронизацию'}).click();
 await openSettings(pa);await pa.getByRole('button',{name:'Плагины →',exact:true}).click();await pa.locator('.plugin-row').filter({hasText:'Волшебное лассо'}).getByRole('button',{name:'Включить',exact:true}).click();await closeSettings(pa);
 await focus(pa,'Laptop note');await pa.getByRole('button',{name:'Markdown',exact:true}).click();await pa.getByRole('textbox',{name:'Текст',exact:true}).fill('Notes still sync with local plugins');await pa.getByRole('button',{name:'Готово',exact:true}).click();
 await expect.poll(async()=>(await readMap(pb)).atoms[0]?.content,{timeout:20000}).toBe('Notes still sync with local plugins');
 await openSettings(pb);await pb.getByRole('button',{name:'Плагины →',exact:true}).click();await expect(pb.locator('.plugin-row').filter({hasText:'Волшебное лассо'}).getByRole('button',{name:'Включить',exact:true})).toBeVisible();await closeSettings(pb);
 await sync(pb);await pb.locator('.sync-preferences summary').click();await pb.getByRole('combobox',{name:'Получать плагины на это устройство'}).click();await pb.getByRole('option',{name:'Плагины и настройки',exact:true}).click();await pb.getByRole('button',{name:'Закрыть синхронизацию'}).click();
 await expect.poll(async()=>{await openSettings(pb);await pb.getByRole('button',{name:'Плагины →',exact:true}).click();const count=await pb.locator('.plugin-row').filter({hasText:'Волшебное лассо'}).getByRole('button',{name:'Выключить',exact:true}).count();await closeSettings(pb);return count;},{timeout:20000}).toBe(1);
 expect(errors).toEqual([]);await a.close();await b.close();
});
