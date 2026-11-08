import {test,expect} from '@playwright/test';
import {openSettings,closeSettings} from './helpers';
test('fresh workspace enables plugins and preserves deliberate disabling',async({page})=>{
 await page.goto('/');await expect(page.locator('canvas.map')).toBeVisible();
 await openSettings(page);
 await expect(page.getByRole('group',{name:'Модель карты'})).toHaveCount(0);
 await page.getByRole('button',{name:'Плагины →',exact:true}).click();
 for(const name of ['Ежедневные заметки','Типы заметок','Молекула','Созвездия'])await expect(page.locator('.plugin-row').filter({hasText:name}).getByRole('button',{name:'Выключить',exact:true})).toBeVisible();
 await page.locator('.plugin-row').filter({hasText:'Молекула'}).getByRole('button',{name:'Выключить',exact:true}).click();
 await closeSettings(page);await page.reload();await expect(page.locator('canvas.map')).toBeVisible();await openSettings(page);
 await page.getByRole('button',{name:'Плагины →',exact:true}).click();await expect(page.locator('.plugin-row').filter({hasText:'Молекула'}).getByRole('button',{name:'Включить',exact:true})).toBeVisible();
});
