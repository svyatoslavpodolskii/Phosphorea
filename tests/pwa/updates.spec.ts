import {test,expect} from '@playwright/test';
import {importMap,openSettings,readMap} from '../e2e/helpers';
import {makeAtom} from '../../src/core/model';
test('real worker update can be deferred across reloads, explicitly installed and keeps the diary',async({page,request})=>{
 await page.goto('/');await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.reload();await expect(page.locator('main')).toHaveClass(/app-ready/);
 const note=makeAtom({title:'Saved before update',content:'Do not lose this text',pinned:true});await importMap(page,{atoms:[note],links:[]});
 await request.post('/__revision');await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration())!.update();});
 const prompt=page.getByRole('complementary',{name:'Обновление приложения'});await expect(prompt).toBeVisible({timeout:30000});
 await page.screenshot({path:'artifacts/update-desktop.png',animations:'disabled'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/update-mobile.png',animations:'disabled'});
 await prompt.getByRole('button',{name:'Позже',exact:true}).click();await expect(prompt).toHaveCount(0);
 await page.reload();await expect(page.locator('main')).toHaveClass(/app-ready/);await expect(prompt).toHaveCount(0);
 await openSettings(page);await expect(page.getByRole('button',{name:'Обновить приложение',exact:true})).toBeVisible();
 await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Обновить приложение',exact:true}).click()]);
 await expect(page.locator('main')).toHaveClass(/app-ready/);await expect(prompt).toHaveCount(0);
 expect((await readMap(page)).atoms[0]).toMatchObject({id:note.id,title:note.title,content:note.content});
});
