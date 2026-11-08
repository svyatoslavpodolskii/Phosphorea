import {test,expect} from '@playwright/test';
import {makeAtom,makeLink} from '../../src/core/model';
import {importMap,focus,readMap} from './helpers';
test.use({viewport:{width:390,height:844}});
for(const count of [1,4])test(`drag delete selected free atom among ${count} notes`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.stack||e.message));await page.goto('/');const atoms=Array.from({length:count},(_,i)=>makeAtom({id:'a'+i,title:'Note '+i,x:i*180,y:0}));await importMap(page,{atoms,links:atoms.slice(1).map(a=>makeLink('a0',a.id))});await focus(page,'Note 0',false);
 const map=page.locator('canvas.map'),p=await map.evaluate(el=>({x:195+Number(el.dataset.cameraX),y:422+Number(el.dataset.cameraY)}));await page.mouse.move(p.x,p.y);await page.mouse.down();await page.waitForTimeout(600);const b=(await page.locator('[data-atom-state=delete]').boundingBox())!;await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await page.mouse.up();await expect(page.locator('footer')).toContainText(`${count-1} атомов`);await page.waitForTimeout(600);expect(errors).toEqual([]);await expect(page.getByRole('alert')).toHaveCount(0);const data=await readMap(page);expect(data.atoms).toHaveLength(count-1);
});
