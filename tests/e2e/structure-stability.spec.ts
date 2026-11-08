import {test,expect} from '@playwright/test';
import {makeAtom,makeLink} from '../../src/core/model';
import {importMap,readMap,openSettings,closeSettings,selectModel} from './helpers';
test.use({viewport:{width:390,height:844}});
test('model changes settle once, preserve relationship identities, and reopen in exactly the same place',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 const atoms=Array.from({length:20},(_,i)=>makeAtom({id:'structure-'+i,title:'Thought '+i,x:i%5*200-400,y:Math.floor(i/5)*180-270,pinned:i===0})),links=atoms.slice(1).map((a,i)=>makeLink(atoms[Math.floor(i/3)].id,a.id,i%3?'related':'grouped'));
 await importMap(page,{atoms,links});const map=page.locator('canvas.map');await expect(map).toHaveAttribute('data-layout','idle',{timeout:15000});
 for(const name of ['Созвездия','Молекула','Ветви','Созвездия']){
  await openSettings(page);await selectModel(page,name);await expect(page.getByRole('combobox',{name:'Модель карты',exact:true}).locator('option:checked')).toHaveText(name);await closeSettings(page);await expect(map).toHaveAttribute('data-layout','idle',{timeout:15000});
  const first=await readMap(page);await page.waitForTimeout(650);const after=await readMap(page);expect(after.atoms.map(a=>[a.id,a.x,a.y])).toEqual(first.atoms.map(a=>[a.id,a.x,a.y]));expect(after.links).toEqual(links);expect(after.atoms.find(a=>a.id===atoms[0].id)).toMatchObject({x:atoms[0].x,y:atoms[0].y});expect(after.atoms.every(a=>Number.isFinite(a.x)&&Number.isFinite(a.y)&&Math.abs(a.x)<100000&&Math.abs(a.y)<100000)).toBe(true);
 }
 const before=await readMap(page);const visible=await map.getAttribute('data-nodes');await page.reload();await expect(map).toHaveAttribute('data-nodes',visible!);await expect(map).toHaveAttribute('data-layout','idle');await page.waitForTimeout(800);expect((await readMap(page)).atoms.map(a=>[a.id,a.x,a.y])).toEqual(before.atoms.map(a=>[a.id,a.x,a.y]));await page.screenshot({path:'artifacts/structure-stable-mobile.png'});expect(errors).toEqual([]);
});
