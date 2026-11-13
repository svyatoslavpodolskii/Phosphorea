import {test,expect} from '@playwright/test';
import {openSettings,closeSettings,focus} from '../e2e/helpers';
test('real Whisper downloads once and transcribes offline after the editor closes',async({page,context,request})=>{
 test.skip(!process.env.LIVE_WHISPER,'Explicit network/model integration check');test.setTimeout(1200000);
 const response=await request.get('https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/samples/jfk.wav');expect(response.ok()).toBeTruthy();const speech=await response.body();
 await page.goto('/');await expect(page.locator('canvas.map')).toBeVisible();await openSettings(page);await page.getByRole('button',{name:'Плагины →',exact:true}).click();
 await page.locator('.plugin-row').filter({hasText:'Локальная расшифровка'}).getByRole('button',{name:'Настройки',exact:true}).click();
 await page.getByRole('combobox',{name:'Модель для новых расшифровок',exact:true}).click();await page.getByRole('option',{name:'Tiny · многоязычная',exact:true}).click();
 await page.locator('.model').filter({hasText:'Tiny ·'}).getByRole('button',{name:'Скачать',exact:true}).click();
 await expect(page.locator('.model').filter({hasText:'Tiny ·'}).getByRole('button',{name:'Удалить',exact:true})).toBeEnabled({timeout:600000});
 await closeSettings(page);await page.locator('canvas.map').press('n');await page.getByRole('textbox',{name:'Название',exact:true}).fill('Offline speech');
 await page.getByLabel('Добавить медиа',{exact:true}).setInputFiles({name:'jfk.wav',mimeType:'audio/wav',buffer:speech});await page.locator('.attachment-card').scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Слушать запись'})).toBeVisible();
 await context.setOffline(true);await page.getByRole('button',{name:'Расшифровать на устройстве',exact:true}).click();await page.getByRole('button',{name:'Готово',exact:true}).click();
 await Promise.race([expect(page.getByText('Расшифровка готова',{exact:true})).toBeVisible({timeout:600000}),page.getByText('Обработка остановлена',{exact:true}).waitFor({timeout:600000}).then(async()=>{throw Error(await page.locator('.transcription-toast').innerText());})]);await context.setOffline(false);
 await focus(page,'Offline speech');await expect(page.locator('.transcript-label textarea')).toHaveValue(/country/i,{timeout:10000});
});

test('Small installs without allocating an inference session and keeps byte progress visible',async({page})=>{
 test.skip(!process.env.LIVE_WHISPER_SMALL,'Explicit large model download check');test.setTimeout(1200000);await page.goto('/');await expect(page.locator('canvas.map')).toBeVisible();await openSettings(page);await page.getByRole('button',{name:'\u041f\u043b\u0430\u0433\u0438\u043d\u044b \u2192',exact:true}).click();await page.locator('.plugin-row').filter({hasText:'\u041b\u043e\u043a\u0430\u043b\u044c\u043d\u0430\u044f \u0440\u0430\u0441\u0448\u0438\u0444\u0440\u043e\u0432\u043a\u0430'}).getByRole('button',{name:'\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438',exact:true}).click();
 const row=page.locator('.model').filter({hasText:'Small \u00b7'});await row.getByRole('button',{name:'\u0421\u043a\u0430\u0447\u0430\u0442\u044c',exact:true}).click();await expect(page.locator('.model-progress')).toBeVisible();await expect(page.locator('.model-progress')).toContainText(/МБ/);await page.screenshot({path:'artifacts/whisper-small-progress.png'});await Promise.race([expect(row.getByRole('button',{name:'\u0423\u0434\u0430\u043b\u0438\u0442\u044c',exact:true})).toBeEnabled({timeout:600000}),page.locator('.whisper-models [role=alert]').waitFor({timeout:600000}).then(async()=>{throw Error(await page.locator('.whisper-models [role=alert]').innerText());})]);
 const bytes=await page.evaluate(async()=>{const cache=await caches.open('phosphoreya-whisper:Xenova/whisper-small');const keys=await cache.keys();return Promise.all(keys.filter(k=>k.url.endsWith('.onnx')).map(async k=>(await(await cache.match(k))!.blob()).size));});expect(bytes).toHaveLength(2);expect(bytes.reduce((a,b)=>a+b,0)).toBeGreaterThan(200000000);
});
