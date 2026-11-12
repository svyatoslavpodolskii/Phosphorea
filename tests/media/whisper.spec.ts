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
