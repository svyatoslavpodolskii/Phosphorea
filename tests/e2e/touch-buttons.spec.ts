import {sourceText} from './helpers';
import {test,expect,type Page} from '@playwright/test';
import {makeAtom} from '../../src/core/model';
import {importMap,readMap,focus} from './helpers';
test.use({viewport:{width:390,height:844}});
async function touch(page:Page,type:string,x:number,y:number){await page.locator('canvas.map').dispatchEvent(type,{pointerId:99,pointerType:'touch',isPrimary:true,button:0,buttons:0,clientX:x,clientY:y,bubbles:true});}
test('touch without a buttons bitmask can lasso and move its selection without extra controls',async({page})=>{
 // The moved pair is unpinned; the stationary anchor remains pinned.
 // Synthetic pointer ID 99 has no native capture target. Native touch is tested separately with CDP.
 await page.addInitScript(()=>{const capture=Element.prototype.setPointerCapture;Element.prototype.setPointerCapture=function(id:number){if(id!==99)capture.call(this,id);};});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');const atoms=[makeAtom({id:'touch-left',title:'Left',x:-70,y:0,pinned:false}),makeAtom({id:'touch-right',title:'Right',x:70,y:0,pinned:false}),makeAtom({id:'touch-still',title:'Still',x:0,y:230,pinned:true})];await importMap(page,{atoms,links:[]});await expect(page.locator('canvas.map')).toHaveAttribute('data-nodes','3');
 await touch(page,'pointerdown',45,300);await page.waitForTimeout(600);for(const [x,y] of [[345,300],[345,500],[45,500],[45,300]])await touch(page,'pointermove',x,y);await touch(page,'pointerup',45,300);await expect(page.locator('canvas.map')).toHaveAttribute('data-selection-count','2');await expect(page.getByRole('dialog')).toHaveCount(0);await page.screenshot({path:'artifacts/quiet-lasso-mobile.png',animations:'disabled'});
 await touch(page,'pointerdown',125,422);await page.waitForTimeout(600);await touch(page,'pointermove',165,452);await expect(page.locator('main')).toHaveClass(/map-interacting/);await expect(page.locator('.dropzones')).toHaveCount(0);await expect(page.locator('.link-handle')).toHaveCount(0);await page.screenshot({path:'artifacts/quiet-drag-mobile.png',animations:'disabled'});await touch(page,'pointerup',165,452);await expect(page.locator('main')).not.toHaveClass(/map-interacting/);
 const saved=await readMap(page);expect(saved.atoms.find(a=>a.id==='touch-left')).toMatchObject({x:-30,y:30});expect(saved.atoms.find(a=>a.id==='touch-right')).toMatchObject({x:110,y:30});expect(saved.atoms.find(a=>a.id==='touch-still')).toMatchObject({x:0,y:230});expect(errors).toEqual([]);
});
test('map text preview opens its text directly for editing',async({page})=>{
 await page.goto('/');await importMap(page,{atoms:[makeAtom({title:'Preview',content:'Tap this preview text',x:0,y:0,pinned:true})],links:[]});await focus(page,'Preview',false);const canvas=page.locator('canvas.map');for(let i=0;i<6;i++)await canvas.press('=');const preview=page.locator('.content-preview');await expect(preview).toBeVisible();const box=(await preview.boundingBox())!;await page.mouse.click(box.x+20,box.y+8);const text=(await sourceText(page));await expect(text).toBeFocused();await text.fill('Updated directly');await page.getByRole('button',{name:'Готово',exact:true}).click();expect((await readMap(page)).atoms[0].content).toBe('Updated directly');
});
