import {test,expect} from '@playwright/test';
import {openSettings,closeSettings} from './helpers';
test.use({viewport:{width:390,height:844}});
test('recorded palette previews decoded samples and persists after reopening',async({page})=>{
 await page.addInitScript(()=>{const Native=window.AudioContext;(window as any).__cues=[];window.AudioContext=class extends Native{createBufferSource(){const source=super.createBufferSource(),start=source.start.bind(source);source.start=((...args:Parameters<AudioBufferSourceNode['start']>)=>{if(!source.loop)(window as any).__cues.push(source.buffer?.duration);start(...args);}) as typeof source.start;return source;}};});
 await page.goto('/');await openSettings(page);await page.getByRole('button',{name:'Плагины →',exact:true}).click();await page.locator('.plugin-row').filter({hasText:'Звуковой отклик'}).getByRole('button',{name:'Настройки',exact:true}).click();
 await page.getByRole('combobox',{name:'Звучание касаний',exact:true}).selectOption('glass');await page.waitForTimeout(250);await page.evaluate(()=>(window as any).__cues=[]);
 await page.getByRole('button',{name:'Касание',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).__cues.some((d:number)=>d>.10&&d<.12))).toBe(true);
 await page.screenshot({path:'artifacts/sound-palette-mobile.png'});
 await closeSettings(page);await page.reload();await openSettings(page);await page.getByRole('button',{name:'Плагины →',exact:true}).click();await page.locator('.plugin-row').filter({hasText:'Звуковой отклик'}).getByRole('button',{name:'Настройки',exact:true}).click();await expect(page.getByRole('combobox',{name:'Звучание касаний',exact:true})).toHaveValue('glass');
});
