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
 // Deleting the received workspace is local: a trusted reconnect must not resurrect it.
 await pb.getByRole('button',{name:'\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0445\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435',exact:true}).click();
 await pb.locator('.workspace-menu .danger-button').click();await pb.locator('.workspace-menu input').fill('\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0435 \u00b7 2');await pb.locator('.workspace-menu .danger-button').click();
 await expect(pb.locator('footer')).toBeVisible();await pa.reload();await expect(pa.locator('footer')).toBeVisible();
 await sync(pb);await expect(pb.getByRole('heading',{name:'\u041a\u0430\u0440\u0442\u044b \u0441\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u043d\u044b',exact:true})).toBeVisible({timeout:30000});await pb.getByRole('button',{name:'\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0441\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0430\u0446\u0438\u044e'}).click();
 expect((await readMap(pb)).atoms.map(a=>a.id)).toEqual(['phone-note']);expect((await readMap(pa)).atoms[0].id).toBe('laptop-note');
 await pb.getByRole('button',{name:'\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0445\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435',exact:true}).click();await expect(pb.locator('.workspace-menu .workspace-list>button')).toHaveCount(1);await pb.getByRole('button',{name:'\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0445\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0430'}).click();
 // An explicit QR pairing can restore an excluded scope, without reviving it implicitly.
 await pa.context().grantPermissions(['clipboard-read','clipboard-write']);
 await sync(pa);await pa.getByRole('button',{name:'Изменить хранилища',exact:true}).click();
 await pa.locator('.workspace-picker .workspace-option input').first().check();await pa.getByRole('button',{name:/Показать QR/}).click();await pa.getByRole('button',{name:'Скопировать ссылку',exact:true}).click();
 const recoveryLink=await pa.getByRole('textbox',{name:'Ссылка для другого устройства'}).count()?await pa.getByRole('textbox',{name:'Ссылка для другого устройства'}).inputValue():await pa.evaluate(()=>navigator.clipboard.readText());
 await sync(pb);const retry=pb.getByRole('button',{name:'Попробовать снова',exact:true});if(await retry.count())await retry.click();
 await expect(pb.getByRole('button',{name:'Подключиться по ссылке',exact:true})).toBeEnabled();await pb.getByRole('button',{name:'Подключиться по ссылке',exact:true}).click();await pb.getByRole('textbox',{name:'Ссылка подключения'}).fill(recoveryLink);await pb.getByRole('button',{name:'Подключиться',exact:true}).click();
 for(const p of [pa,pb])await expect(p.getByRole('button',{name:'Да, совпадают',exact:true})).toBeVisible();
 const restore=pb.locator('.exchange-summary .workspace-option').filter({has:pb.getByText('Основное',{exact:true})}).getByRole('checkbox');await expect(restore).not.toBeChecked();await restore.check();
 for(const p of [pa,pb])await p.getByRole('button',{name:'Да, совпадают',exact:true}).click();
 for(const p of [pa,pb]){await expect(p.getByRole('heading',{name:'Карты синхронизированы',exact:true})).toBeVisible();await p.getByRole('button',{name:'Закрыть синхронизацию'}).click();}
 await imported(pb);expect((await readMap(pb)).atoms[0]).toMatchObject({id:'laptop-note',x:320,y:-180});
 expect(errors).toEqual([]);await a.close();await b.close();
});
