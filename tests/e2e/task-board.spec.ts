import {sourceText} from './helpers';
import {test,expect} from '@playwright/test';
import {makeAtom} from '../../src/core/model';
import {importMap,readMap} from './helpers';
test.use({hasTouch:true});
for(const mobile of [false,true])test(`task board persists tasks and source state on ${mobile?'mobile':'desktop'}`,async({page})=>{
 await page.setViewportSize({width:mobile?390:1280,height:844});await page.goto('/');
 await importMap(page,{atoms:[makeAtom({id:'tasks',title:'Project',content:'- [ ] #task First task\n- [ ] #task Second task\n- [ ] Ordinary checkbox',pinned:true})],links:[]});
 await page.locator('.view-toggle button').last().click();
 await expect(page.locator('.toast')).toHaveCount(0);const group=page.locator('[data-source="tasks"]');await expect(group).toBeVisible();
 await expect(group.getByRole('checkbox')).toHaveCount(2);await expect(group).not.toContainText('#task');
 for(const label of ['Сейчас','Поле','Архив'])await expect(page.locator('.board-lane').getByRole('heading',{name:label})).toBeVisible();
 await group.getByRole('checkbox',{name:'First task',exact:true}).check();
 await group.getByRole('button',{name:'Повторение First task',exact:true}).click();const popup=page.locator('.recurrence-popup');
 await popup.locator('select').first().selectOption('daily');
 await expect(popup.locator('.task-history [role="listitem"]')).toHaveCount(7);
 await expect(popup.locator('.task-history .complete')).toHaveCount(1);
 await popup.locator('select').last().selectOption('30');
 await expect(popup.locator('.task-history [role="listitem"]')).toHaveCount(30);
 await page.screenshot({path:`artifacts/task-history-${mobile?'mobile':'desktop'}.png`});
 await popup.getByRole('button',{name:'Закрыть',exact:true}).click();await group.locator('.group-title').click();await page.getByRole('combobox',{name:'Состояние',exact:true}).click();await page.getByRole('option',{name:'Сейчас',exact:true}).click();await page.getByRole('button',{name:'Готово',exact:true}).click();
 await expect(page.locator('[data-task-lane="now"] [data-source="tasks"]')).toBeVisible();
 let data=await readMap(page);expect(data.atoms[0].content).toContain('- [x] #task First task');expect(data.atoms[0].state).toBe('now');
 const tasks=data.atoms[0].properties['phosphora.tasks'] as any[];expect(tasks[0].recurrence).toBe('daily');expect(Object.values(tasks[0].history)).toContain(true);expect(new Set(tasks.map(t=>t.id)).size).toBe(2);
 await page.reload();await expect(group).toBeVisible();await expect(group.getByRole('checkbox',{name:'First task',exact:true})).toBeChecked();
 await page.screenshot({path:`artifacts/task-board-${mobile?'mobile':'desktop'}.png`});
 const handle=group.locator('.group-drag');await handle.scrollIntoViewIfNeeded();const box=(await handle.boundingBox())!;
 const start={x:box.x+box.width/2,y:box.y+box.height/2};
 const cdp=await page.context().newCDPSession(page);
 if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1}]});else{await page.mouse.move(start.x,start.y);await page.mouse.down();}
 await expect(page.locator('.task-drag-preview')).toBeVisible();await expect(group).toHaveClass(/drag-source/);await page.screenshot({path:`artifacts/task-drag-${mobile?'mobile':'desktop'}.png`});
 if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});else{await page.keyboard.press('Escape');await page.mouse.up();}
 await expect(page.locator('.task-drag-preview')).toHaveCount(0);await expect(page.locator('[data-task-lane="now"] [data-source="tasks"]')).toBeVisible();
 if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1}]});else{await page.mouse.move(start.x,start.y);await page.mouse.down();}
 const target=page.locator('.task-destinations [data-task-lane="archived"]');await expect(target).toBeVisible();const end=(await target.boundingBox())!;const dest={x:end.x+end.width/2,y:end.y+end.height/2};
 if(mobile){for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(dest.x-start.x)*i/8,y:start.y+(dest.y-start.y)*i/8,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await page.mouse.move(dest.x,dest.y,{steps:8});await page.mouse.up();}
 await expect(page.locator('[data-task-lane="archived"] [data-source="tasks"]')).toBeVisible();
 await expect(page.locator('.task-drag-preview')).toHaveCount(0);expect((await readMap(page)).atoms[0].state).toBe('archived');
 await page.locator('.search-trigger').click();await page.locator('.search input').fill('Project');await page.getByRole('button',{name:'Показать на карте',exact:true}).click();await expect(page.locator('canvas.map')).toBeVisible();await expect(page.locator('.kanban')).toHaveCount(0);
});

test('ordinary checkboxes leave the board empty with Task toolbar instructions',async({page})=>{
 await page.goto('/');await importMap(page,{atoms:[makeAtom({id:'plain',title:'Checklist',content:'- [ ] Buy tickets\n- [x] Book hotel'})],links:[]});
 await page.locator('.view-toggle button').last().click();
 await expect(page.locator('.task-group')).toHaveCount(0);await expect(page.locator('.board-empty')).toContainText('Task');await expect(page.locator('.board-empty')).toContainText('- [ ] #task');
 await page.reload();await expect(page.locator('.task-group')).toHaveCount(0);
});

test('legacy metadata keeps old tasks and history while new checkboxes stay out of Kanban',async({page})=>{
 const legacy={id:'old-task',text:'Legacy task',line:0,checked:false,recurrence:'weekly',history:{'2026-10-05':true}};
 await page.goto('/');await importMap(page,{atoms:[makeAtom({id:'legacy',title:'Existing routine',content:'- [ ] Legacy task\n- [ ] Ordinary checkbox',properties:{'phosphora.tasks':[legacy]}})],links:[]});
 await page.locator('.view-toggle button').last().click();const group=page.locator('[data-source="legacy"]');
 await expect(group.getByRole('checkbox')).toHaveCount(1);await expect(group.getByRole('checkbox',{name:'Legacy task',exact:true})).toBeVisible();await expect(group).not.toContainText('#task');
 await group.locator('.group-title').click();await page.getByRole('combobox',{name:'Состояние',exact:true}).click();await page.getByRole('option',{name:'Сейчас',exact:true}).click();await page.getByRole('button',{name:'Готово',exact:true}).click();
 const atom=(await readMap(page)).atoms[0];expect(atom.content).toContain('- [ ] #task Legacy task');expect(atom.content).toContain('- [ ] Ordinary checkbox');
 expect(atom.properties['phosphora.tasks']).toEqual([expect.objectContaining({...legacy,marker:true})]);
 await page.reload();await expect(group.getByRole('checkbox')).toHaveCount(1);await expect(group.getByRole('checkbox',{name:'Legacy task',exact:true})).toBeVisible();
});

test('editing a duplicate checklist keeps recurrence on the renamed task',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await importMap(page,{atoms:[makeAtom({id:'duplicate',title:'Routine',content:'- [ ] #task Review\n- [ ] #task Review'})],links:[]});
 await page.locator('.view-toggle button').last().click();const group=page.locator('[data-source="duplicate"]');
 await group.getByRole('checkbox').first().check();await group.locator('.task-repeat').first().click();await page.locator('.recurrence-popup select').first().selectOption('daily');await page.locator('.recurrence-popup button').click();
 const before=(await readMap(page)).atoms[0].properties['phosphora.tasks'] as any[];
 await group.locator('.group-title').click();await expect(page.locator('.note-editor')).toBeVisible();
 await (await sourceText(page)).fill('- [x] #task Renamed\n- [ ] #task Review\n```md\n- [ ] #task Review\n```');await page.locator('.note-content').press('Control+Enter');
 await expect(page.locator('.note-editor')).toHaveCount(0);await expect(group.getByRole('checkbox',{name:'Renamed',exact:true})).toBeChecked();
 const after=(await readMap(page)).atoms[0].properties['phosphora.tasks'] as any[];expect(after.map(t=>t.id)).toEqual(before.map(t=>t.id));expect(after[0].history).toEqual(before[0].history);expect(after[0].recurrence).toBe('daily');expect(after[1].recurrence).toBeUndefined();
});
