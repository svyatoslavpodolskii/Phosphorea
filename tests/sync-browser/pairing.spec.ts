import {prepareAttachment,ATTACHMENTS} from '../../src/core/attachments';
import {test,expect,type Page} from '@playwright/test';
import {importMap,readMap,focus} from '../e2e/helpers';
import {makeAtom,makeLink} from '../../src/core/model';
async function openSync(page:Page){await page.getByRole('button',{name:'Устройства и синхронизация',exact:true}).click();await expect(page.getByRole('button',{name:'Показать QR',exact:false})).toBeEnabled({timeout:15000});}
async function closeSync(page:Page){await page.getByRole('button',{name:'Закрыть синхронизацию',exact:true}).click();}
async function invite(page:Page){await page.getByRole('button',{name:'Показать QR',exact:false}).click();const image=page.getByRole('img',{name:'QR для подключения своего устройства'});await expect(image).toBeVisible();const data=await image.getAttribute('src');
 // Decode the actual QR bitmap through the production scanner, not a hidden test URL.
 const png=Buffer.from(data!.split(',')[1],'base64');await page.screenshot({path:'artifacts/sync-qr-mobile.png'});
 // File camera path scans this same bitmap on the joining device below.
 return png;
}
test('QR, bilateral emoji verification, encrypted exchange, offline conflict, resolution and known-device reconnect',async({browser})=>{
 const a=await browser.newContext({viewport:{width:390,height:844}}),b=await browser.newContext({viewport:{width:390,height:844}}),pa=await a.newPage(),pb=await b.newPage(),errors:string[]=[];
 for(const page of [pa,pb]){page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{localStorage.setItem('phosphorea:tour-v1','seen');(window as any).__wire=[];const send=RTCDataChannel.prototype.send;RTCDataChannel.prototype.send=function(data:any){(window as any).__wire.push(typeof data==='string'?data:'binary');const channels=(window as any).__channels||=[];if(!channels.includes(this))channels.push(this);return send.call(this,data);};});}
 await pa.goto('http://127.0.0.1:4312/');await pb.goto('http://127.0.0.1:4313/');
 const asset=await prepareAttachment(new Blob(['test private media bytes'],{type:'image/png'}),'paired.png');
 const note=makeAtom({properties:{[ATTACHMENTS]:[asset.meta]},id:'shared-note',title:'Shared diary',content:'Initial private text',pinned:true}),other=makeAtom({id:'neighbor',title:'Neighbor',x:210,pinned:true});await importMap(pa,{atoms:[note,other],links:[makeLink(note.id,other.id)],attachments:[asset]} as any);
 await openSync(pa);await pa.locator('.name-button').click();await pa.getByRole('textbox',{name:'Название устройства'}).fill('Computer');await pa.getByRole('heading',{name:'Ваши устройства'}).click();const png=await invite(pa);
 await openSync(pb);await pb.locator('.name-button').click();await pb.getByRole('textbox',{name:'Название устройства'}).fill('Phone');await pb.getByRole('button',{name:'Подключиться по ссылке',exact:true}).click();await pb.locator('input[type=file]').setInputFiles({name:'pair.png',mimeType:'image/png',buffer:png});
 await expect(pb.getByRole('textbox',{name:'Ссылка подключения'})).toHaveValue(/#pair=/);
 const nativeLink=await pb.getByRole('textbox',{name:'Ссылка подключения'}).inputValue();await pb.goto('http://127.0.0.1:4313/'+new URL(nativeLink).hash);await expect(pb.getByRole('dialog',{name:'Устройства и синхронизация'})).toBeVisible();await expect(pb.getByRole('button',{name:'Подключиться',exact:true})).toBeEnabled();expect(new URL(pb.url()).hash).toBe('');await pb.getByRole('button',{name:'Подключиться',exact:true}).click();
 const codeA=pa.getByLabel('Код проверки'),codeB=pb.getByLabel('Код проверки');await expect(codeA).toBeVisible();await expect(codeB).toBeVisible();expect(await codeA.innerText()).toBe(await codeB.innerText());await pa.screenshot({path:'artifacts/sync-emoji-mobile.png'});
 await pa.getByRole('button',{name:'Да, совпадают',exact:true}).click();await pb.getByRole('button',{name:'Да, совпадают',exact:true}).click();
 for(const p of [pa,pb])await expect(p.getByRole('heading',{name:'Карты синхронизированы',exact:true})).toBeVisible();await closeSync(pa);await closeSync(pb);await pb.getByRole('button',{name:'Выбрать хранилище',exact:true}).click();await pb.getByRole('button',{name:/Основное · 2/}).click();const received=await readMap(pb) as any;expect(received.atoms.map((a:any)=>a.id)).toContain(note.id);expect(received.attachments).toHaveLength(1);expect(received.attachments[0].meta.hash).toBe(asset.meta.hash);expect(received.attachments[0].chunks).toEqual(asset.chunks);
 await a.setOffline(true);await b.setOffline(true);for(const p of [pa,pb])await p.evaluate(()=>{for(const c of (window as any).__channels||[])c.close();});
 // Make equal-revision edits independently while the data channel is closed.
 for(const [p,text] of [[pa,'Computer offline edit'],[pb,'Phone offline edit']] as const){await focus(p,'Shared diary');await p.getByRole('button',{name:'Markdown',exact:true}).click();await p.getByRole('textbox',{name:'Текст',exact:true}).fill(text);await p.getByRole('button',{name:'Готово',exact:true}).click();}
 await a.setOffline(false);await b.setOffline(false);await pa.reload();await pb.reload();await pa.getByRole('button',{name:'Устройства и синхронизация',exact:true}).click();await pb.getByRole('button',{name:'Устройства и синхронизация',exact:true}).click();
 for(const p of [pa,pb])await expect(p.getByRole('heading',{name:'Есть разные версии',exact:true})).toBeVisible();
 await pa.getByRole('button',{name:/Shared diary.*версии/}).click();await expect(pa.locator('.version-choice')).toHaveCount(2);await pa.screenshot({path:'artifacts/sync-conflict-mobile.png'});await pa.getByRole('button',{name:'Сохранить обе отдельными заметками',exact:true}).click();await pa.getByRole('button',{name:'Синхронизировать ещё раз',exact:true}).click();
 for(const p of [pa,pb])await expect(p.getByRole('heading',{name:'Карты синхронизированы',exact:true})).toBeVisible();await closeSync(pa);await closeSync(pb);
 const final=await readMap(pb);expect(final.atoms.map(a=>a.content)).toEqual(expect.arrayContaining(['Computer offline edit','Phone offline edit']));expect(final.links).toHaveLength(2);for(const p of [pa,pb]){const wire=await p.evaluate(()=>(window as any).__wire as string[]);expect(wire).toContain('binary');expect(wire.join('')).not.toMatch(/Initial private text|Computer offline edit|Phone offline edit/);}await pa.screenshot({path:'artifacts/sync-field-mobile.png'});expect(errors).toEqual([]);await a.close();await b.close();
});
test('camera denial has a link fallback and a cancelled pair sends no diary',async({browser})=>{
 const a=await browser.newContext({viewport:{width:390,height:844}}),b=await browser.newContext({viewport:{width:390,height:844}}),pa=await a.newPage(),pb=await b.newPage();for(const p of [pa,pb])await p.addInitScript(()=>localStorage.setItem('phosphorea:tour-v1','seen'));
 await pa.goto('http://127.0.0.1:4312/');await pb.goto('http://127.0.0.1:4313/');await importMap(pa,{atoms:[makeAtom({title:'Must stay private',content:'Private diary'})],links:[]});await openSync(pa);const png=await invite(pa);await openSync(pb);
 await pb.getByRole('button',{name:/Сканировать QR/}).click();await expect(pb.getByRole('textbox',{name:'Ссылка подключения'})).toBeVisible();await expect(pb.getByRole('alert')).toContainText('Не удалось открыть камеру');
 await pb.locator('input[type=file]').setInputFiles({name:'pair.png',mimeType:'image/png',buffer:png});await pb.getByRole('button',{name:'Подключиться',exact:true}).click();await expect(pb.getByLabel('Код проверки')).toBeVisible();await pa.getByRole('button',{name:'Не совпадают — отменить',exact:true}).click();await closeSync(pb);expect((await readMap(pb)).atoms).toHaveLength(0);await a.close();await b.close();
});
test('all workspaces transfer separately after consent on both devices',async({browser})=>{
 const a=await browser.newContext(),b=await browser.newContext(),pa=await a.newPage(),pb=await b.newPage();
 for(const p of [pa,pb])await p.addInitScript(()=>localStorage.setItem('phosphorea:tour-v1','seen'));
 await pa.goto('http://127.0.0.1:4312/');await pb.goto('http://127.0.0.1:4313/');
 await importMap(pa,{atoms:[makeAtom({id:'personal-note',title:'Personal only'})],links:[]});
 await pa.getByRole('button',{name:'Выбрать хранилище',exact:true}).click();await pa.getByRole('button',{name:'Новое хранилище',exact:true}).click();await pa.getByRole('textbox',{name:'Название хранилища',exact:true}).fill('Работа');await pa.getByRole('button',{name:'Создать и открыть',exact:true}).click();
 await expect(pa.getByRole('button',{name:'Выбрать хранилище',exact:true})).toContainText('Работа');
 await importMap(pa,{atoms:[makeAtom({id:'work-note',title:'Work only'})],links:[]});
 await openSync(pa);const png=await invite(pa);await openSync(pb);await pb.getByRole('button',{name:'Подключиться по ссылке',exact:true}).click();await pb.locator('input[type=file]').setInputFiles({name:'pair.png',mimeType:'image/png',buffer:png});await pb.getByRole('button',{name:'Подключиться',exact:true}).click();
 await expect(pa.getByLabel('Код проверки')).toBeVisible();await expect(pb.getByLabel('Код проверки')).toBeVisible();await pa.getByRole('button',{name:'Да, совпадают',exact:true}).click();await pb.getByRole('button',{name:'Да, совпадают',exact:true}).click();
 for(const p of [pa,pb])await expect(p.getByRole('heading',{name:'Карты синхронизированы',exact:true})).toBeVisible();await closeSync(pb);
 await pb.getByRole('button',{name:'Выбрать хранилище',exact:true}).click();await pb.getByRole('button',{name:/Работа/}).click();expect((await readMap(pb)).atoms.map(a=>a.id)).toEqual(['work-note']);
 await pb.getByRole('button',{name:'Выбрать хранилище',exact:true}).click();await pb.getByRole('button',{name:/Основное · 2/}).click();await expect(pb.getByRole('button',{name:'Выбрать хранилище',exact:true})).toContainText('Основное · 2');expect((await readMap(pb)).atoms.map(a=>a.id)).toEqual(['personal-note']);
 await a.close();await b.close();
});
