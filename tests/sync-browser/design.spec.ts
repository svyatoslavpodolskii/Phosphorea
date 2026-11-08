import {test,expect} from '@playwright/test';
import {openSettings,closeSettings} from '../e2e/helpers';
test('pairing layout and QR fit narrow light and dark themes; support stays in settings',async({page})=>{
 await page.setViewportSize({width:360,height:780});await page.addInitScript(()=>localStorage.setItem('phosphorea:tour-v1','seen'));await page.goto('http://127.0.0.1:4312/');
 for(const [theme,label] of [['dark','Тёмная контрастная'],['light','Светлая контрастная']] as const){
  await openSettings(page);const support=page.getByRole('link',{name:'Поддержать автора',exact:false});await expect(support).toHaveAttribute('href','https://www.donationalerts.com/r/svyatoslav_podolskiy');
  await page.getByRole('button',{name:'Плагины →',exact:true}).click();await page.locator('.plugin-row').filter({hasText:'Темы и атмосфера'}).getByRole('button',{name:'Настройки',exact:true}).click();await page.getByRole('button',{name:label,exact:true}).click();await closeSettings(page);
  await page.getByRole('button',{name:'Устройства и синхронизация',exact:true}).click();await expect(page.getByRole('button',{name:/Показать QR/})).toBeEnabled();await page.screenshot({path:`artifacts/sync-home-${theme}-092.png`});await page.getByRole('button',{name:/Показать QR/}).click();await expect(page.getByRole('img',{name:'QR для подключения своего устройства'})).toBeVisible();
  const metrics=await page.locator('.sync-header').evaluate(el=>{const s=getComputedStyle(el),b=el.getBoundingClientRect(),p=el.parentElement!.getBoundingClientRect(),title=el.querySelector('h2')!.getBoundingClientRect();return{margin:s.margin,header:{x:b.x,y:b.y,width:b.width},panel:{x:p.x,y:p.y,width:p.width},title:{x:title.x,y:title.y}};});expect(metrics.margin).toBe('0px');expect(metrics.header.x).toBeGreaterThanOrEqual(metrics.panel.x);expect(metrics.title.x-metrics.panel.x).toBeGreaterThanOrEqual(18);expect(metrics.title.y-metrics.panel.y).toBeGreaterThanOrEqual(18);
  const box=(await page.getByRole('img',{name:'QR для подключения своего устройства'}).boundingBox())!;expect(box.x).toBeGreaterThan(12);expect(box.x+box.width).toBeLessThan(349);await page.screenshot({path:`artifacts/sync-qr-${theme}-092.png`});await page.getByRole('button',{name:'Закрыть синхронизацию',exact:true}).click();
 }
});
