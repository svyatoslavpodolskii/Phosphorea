import {test,expect,type Page} from '@playwright/test';
import {makeAtom} from '../../src/core/model';
import {packStorage} from '../../src/storage/native-backup';
import {importMap,openSettings,closeSettings,readMap} from './helpers';
async function dataPage(page:Page){await page.getByRole('button',{name:'Данные и копии',exact:false}).click();}
async function volumePage(page:Page){await page.getByRole('button',{name:'Плагины →',exact:true}).click();await page.locator('.plugin-row').filter({hasText:'Звуковой отклик'}).getByRole('button',{name:'Настройки',exact:true}).click();}

test('full storage backup restores through staged OPFS and rejects damaged input',async({page})=>{
 await page.goto('/');await expect(page.locator('canvas.map')).toBeVisible();
 const original=makeAtom({title:'Portable thought',state:'now',paused:true,x:250,y:-90,pinned:true,properties:{custom:'kept'}});
 await importMap(page,{atoms:[original],links:[]});await openSettings(page);
 await expect(page.getByRole('button',{name:'Экспорт карты',exact:true})).toBeHidden();
 await volumePage(page);await page.getByLabel('Громкость отклика',{exact:true}).fill('0.2');await closeSettings(page);await openSettings(page);await dataPage(page);
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Создать резервную копию',exact:true}).click();const file=await downloading;
 expect(file.suggestedFilename()).toMatch(/^Основное_.*\.posphorea$/);
 const stream=await file.createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(chunk as Buffer);const bytes=Buffer.concat(chunks);
 await closeSettings(page);await importMap(page,{atoms:[original,makeAtom({title:'Later thought'})],links:[]});await openSettings(page);
 await volumePage(page);await page.getByLabel('Громкость отклика',{exact:true}).fill('0.7');await closeSettings(page);await openSettings(page);await dataPage(page);
 await page.getByLabel('Полная резервная копия',{exact:true}).setInputFiles({name:'broken.phosphora',mimeType:'application/octet-stream',buffer:Buffer.from('broken')});
 await expect(page.getByRole('alert')).toBeVisible();await closeSettings(page);expect((await readMap(page)).atoms).toHaveLength(2);
 const corrupt=new Uint8Array(512);corrupt.set(new TextEncoder().encode('SQLite format 3\0'));
 const corruptPackage=await packStorage(corrupt,'Damaged database');
 await openSettings(page);await dataPage(page);await page.getByLabel('Полная резервная копия',{exact:true}).setInputFiles({name:'damaged.phosphora',mimeType:'application/octet-stream',buffer:Buffer.from(corruptPackage)});
 await page.getByRole('button',{name:'Восстановить хранилище',exact:true}).click();
 await expect(page.getByRole('alert')).toBeVisible();await closeSettings(page);expect((await readMap(page)).atoms).toHaveLength(2);
 await openSettings(page);await dataPage(page);await page.getByLabel('Полная резервная копия',{exact:true}).setInputFiles({name:'backup.phosphora',mimeType:'application/octet-stream',buffer:bytes});
 await page.getByRole('button',{name:'Восстановить хранилище',exact:true}).click();await expect(page.getByRole('dialog',{name:'Настройки',exact:true})).toHaveCount(0);
 await expect(page.locator('canvas.map')).toBeVisible();const restored=await readMap(page);expect(restored.atoms).toEqual([original]);
 await openSettings(page);await volumePage(page);await expect(page.getByLabel('Громкость отклика',{exact:true})).toHaveValue('0.2');
 await closeSettings(page);
 await page.getByRole('button',{name:'Выбрать хранилище',exact:true}).click();
 await page.getByRole('button',{name:'Новое хранилище',exact:true}).click();
 await page.getByLabel('Название хранилища',{exact:true}).fill('Separate workspace');
 await page.getByRole('button',{name:'Создать и открыть',exact:true}).click();
 await expect(page.locator('.workspace-switch')).toContainText('Separate workspace');
 await expect(page.locator('footer')).toContainText('0 атомов');
 await importMap(page,{atoms:[makeAtom({title:'Replace only here'})],links:[]});
 await openSettings(page);await dataPage(page);await page.getByLabel('Полная резервная копия',{exact:true}).setInputFiles({name:'backup.phosphora',mimeType:'application/octet-stream',buffer:bytes});
 await page.getByRole('button',{name:'Восстановить хранилище',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Настройки',exact:true})).toHaveCount(0);
 await expect(page.locator('.workspace-switch')).toContainText('Separate workspace');
 expect((await readMap(page)).atoms).toEqual([original]);
 await importMap(page,{atoms:[original,makeAtom({title:'Only in separate'})],links:[]});
 await page.getByRole('button',{name:'Выбрать хранилище',exact:true}).click();
 await expect(page.locator('.workspace-list button')).toHaveCount(2);
 await page.locator('.workspace-list button').filter({hasText:'Основное'}).click();
 await expect(page.locator('.workspace-switch')).toContainText('Основное');
 expect((await readMap(page)).atoms).toEqual([original]);
});
