import {test,expect} from '@playwright/test';
import {makeAtom,makeLink} from '../../src/core/model';
import {FOLDER_DEFINITIONS} from '../../src/graph/folders';
import {focus,importMap,readMap,openSettings,closeSettings,sourceText} from './helpers';
test.use({viewport:{width:390,height:844}});
async function point(page:import('@playwright/test').Page,x=0,y=0){return page.locator('canvas.map').evaluate((el,p)=>({x:195+Number(el.dataset.cameraX)+p.x*Number(el.dataset.zoom),y:422+Number(el.dataset.cameraY)+p.y*Number(el.dataset.zoom)}),{x,y});}

test('blank long hold creates at the finger without a parent or a camera flight',async({page})=>{
 await page.goto('/');await importMap(page,{atoms:[makeAtom({id:'a',title:'Previous',pinned:true})],links:[]});await focus(page,'Previous',false);
 const map=page.locator('canvas.map'),camera=await map.evaluate(el=>[el.dataset.cameraX,el.dataset.cameraY,el.dataset.zoom]);
 await page.mouse.move(70,600);await page.mouse.down();await page.waitForTimeout(600);await page.mouse.up();await page.getByRole('textbox',{name:'Название',exact:true}).fill('Independent');await page.getByRole('button',{name:'Готово',exact:true}).click();
 await expect(map).toHaveAttribute('data-zoom',camera[2]!);const saved=await readMap(page);expect(saved.links).toHaveLength(0);const created=saved.atoms.find(a=>a.title==='Independent')!;expect(created.x).toBeCloseTo((70-195-Number(camera[0]))/Number(camera[2]),1);expect(created.y).toBeCloseTo((600-422-Number(camera[1]))/Number(camera[2]),1);
});

test('dropping on a linked atom removes the link without moving either endpoint',async({page})=>{
 await page.goto('/');await importMap(page,{atoms:[makeAtom({id:'a',title:'A',x:-70}),makeAtom({id:'b',title:'B',x:70,pinned:true})],links:[makeLink('a','b')]});
 const a=await point(page,-70),b=await point(page,70);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.waitForTimeout(600);await page.mouse.move(b.x,b.y,{steps:8});await page.waitForTimeout(460);await expect(page.locator('.drag-link-hint')).toContainText('убрать связь');await page.mouse.up();const saved=await readMap(page);expect(saved.links).toHaveLength(0);expect(saved.atoms.map(a=>a.x)).toEqual([-70,70]);
});

test('editor exposes two modes, formatting, compact metadata and safe text sharing',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await page.goto('/');await importMap(page,{atoms:[makeAtom({title:'Shared',content:'**Bold**\n\n- [ ] Item\n\n<script>bad()</script>'})],links:[]});await focus(page,'Shared');
 const editor=page.locator('.note-editor');await expect(editor.getByRole('group',{name:'Режим редактора'}).getByRole('button')).toHaveCount(2);await expect(editor.getByRole('combobox',{name:'Тип',exact:true})).toBeVisible();await expect(editor.locator('.links-section')).toHaveCount(0);await expect(editor).not.toContainText('Ваша мысль');
 await editor.getByRole('button',{name:'Оформление',exact:true}).click();await expect(editor.getByRole('group',{name:'Цвет атома'})).toBeVisible();await editor.getByRole('button',{name:'Оформление',exact:true}).click();
 await editor.getByRole('button',{name:'Поделиться заметкой',exact:true}).click();await editor.getByRole('button',{name:'Копировать текст',exact:true}).click();const plain=await page.evaluate(()=>navigator.clipboard.readText());expect(plain).toContain('Bold');expect(plain).not.toContain('**');expect(plain).not.toContain('bad()');
 await editor.getByRole('button',{name:'Копировать Markdown',exact:true}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('**Bold**');await page.screenshot({path:'artifacts/refinement-editor.png'});
});

test('folder strip scrolls under a captured drag and exposes add hints',async({page})=>{
 await page.goto('/');await importMap(page,{atoms:[makeAtom({id:'root',title:'Root',pinned:true,properties:{[FOLDER_DEFINITIONS]:Array.from({length:12},(_,i)=>({id:'f'+i,name:'Folder '+i,color:'#75aee8',roots:['root']}))}}),makeAtom({id:'note',title:'Free',x:100,pinned:true})],links:[]});
 const start=await point(page,100);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.waitForTimeout(600);const tabs=page.locator('.folder-tabs'),b=(await tabs.boundingBox())!;await page.mouse.move(b.x+b.width-6,b.y+b.height/2,{steps:8});await expect.poll(()=>tabs.evaluate(el=>el.scrollLeft)).toBeGreaterThan(100);await expect(page.locator('[data-folder-id=f11] svg')).toBeAttached();await page.mouse.move(180,620);await page.mouse.up();
});

test('new users get all plugins and physics settings live inside their plugin',async({page})=>{
 await page.goto('/');await openSettings(page);await expect(page.getByRole('slider',{name:'Живость карты',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Плагины →',exact:true}).click();await expect(page.locator('.plugin-row').getByRole('button',{name:'Включить',exact:true})).toHaveCount(0);
 const row=page.locator('.plugin-row').filter({hasText:'Физика и поведение'});await row.getByRole('button',{name:'Настройки',exact:true}).click();await page.getByRole('slider',{name:'Живость карты',exact:true}).fill('0.5');await closeSettings(page);await page.reload();await openSettings(page);await page.getByRole('button',{name:'Плагины →',exact:true}).click();await row.getByRole('button',{name:'Настройки',exact:true}).click();await expect(page.getByRole('slider',{name:'Живость карты',exact:true})).toHaveValue('0.5');
});
test('delete drop can be undone with its original note and links intact',async({page})=>{
 await page.goto('/');await importMap(page,{atoms:[makeAtom({id:'a',title:'Delete me',pinned:true}),makeAtom({id:'b',title:'Keep me',x:180,pinned:true})],links:[makeLink('a','b')]});const p=await point(page);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.waitForTimeout(600);const target=(await page.locator('[data-atom-state=delete]').boundingBox())!;await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:8});await page.mouse.up();await expect(page.locator('footer')).toContainText('1 атомов');await page.getByRole('button',{name:'Отменить',exact:true}).click();const saved=await readMap(page);expect(saved.atoms.map(a=>a.id)).toEqual(expect.arrayContaining(['a','b']));expect(saved.links).toHaveLength(1);expect(saved.atoms.find(a=>a.id==='a')).toMatchObject({x:0,y:0,pinned:true});
});
