import {expect,type Page} from '@playwright/test';
import type {Snapshot} from '../../src/core/model';
/** Model comparisons explicitly opt into alternative bundled plugins. Settings must be open. */
export async function selectModel(page:Page,name:string){
 await page.getByRole('button',{name:'Плагины →',exact:true}).click();
 for(const label of ['Молекула','Созвездия']){
  const row=page.locator('.plugin-row').filter({hasText:label});
  const enable=row.getByRole('button',{name:'Включить',exact:true});
  if(await enable.count())await enable.click();
  await expect(row.getByRole('button',{name:'Выключить',exact:true})).toBeEnabled();
 }
 await page.locator('.plugin-row').filter({hasText:'Физика и поведение'}).getByRole('button',{name:'Настройки',exact:true}).click();
 await page.getByRole('combobox',{name:'Модель карты',exact:true}).selectOption({label:name});
}
export async function openSettings(page:Page){await page.getByRole('button',{name:'Меню карты',exact:true}).click();await page.getByRole('button',{name:'Настройки и резервные копии',exact:true}).click();}
export async function closeSettings(page:Page){await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();}
export async function readMap(page:Page):Promise<Snapshot>{await openSettings(page);await page.getByRole('button',{name:'Данные и копии',exact:false}).click();await page.locator('.legacy-backup > summary').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Экспорт карты',exact:true}).click();const stream=await(await pending).createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(chunk as Buffer);const result=JSON.parse(Buffer.concat(chunks).toString()).data;await closeSettings(page);return result;}
export async function focus(page:Page,title:string,open=true){await page.getByRole('button',{name:'Открыть поиск',exact:true}).click();await page.getByRole('textbox',{name:'Поиск',exact:true}).fill(title);await page.getByRole('button',{name:'Показать на карте',exact:true}).click();await expect(page.locator('main')).toHaveAttribute('data-navigation','idle');if(open){await page.locator('canvas.map').press('Enter');await expect(page.getByRole('dialog',{name:'Редактор атома'})).toBeVisible();}}
export async function importMap(page:Page,data:Snapshot,timeout=5000){await openSettings(page);await page.getByRole('button',{name:'Данные и копии',exact:false}).click();await page.locator('.legacy-backup > summary').click();await page.getByText('Импорт карты',{exact:true}).locator('input').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'phosphored',version:1,data}))});await page.getByRole('button',{name:'Добавить в карту',exact:true}).click();await expect(page.locator('footer')).toContainText(`${data.atoms.length} атомов`,{timeout});await closeSettings(page);}

/** Explicitly select Markdown when a test exercises source syntax. */
export async function sourceText(page:Page){await page.locator('.note-editor').getByRole('button',{name:'Markdown',exact:true}).click();return page.getByRole('textbox',{name:'Текст',exact:true});}
