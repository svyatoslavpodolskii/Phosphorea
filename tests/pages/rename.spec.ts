import {test,expect} from '@playwright/test';
test('old installed route and new name share the existing diary without moving its database',async({context})=>{
 await context.addInitScript(()=>localStorage.setItem('phosphorea:tour-v1','seen'));
 const old=await context.newPage();await old.goto('/Phosphorea/');const map=old.locator('canvas.map');await expect(map).toBeVisible();await map.press('n');
 await old.getByRole('textbox',{name:'Название',exact:true}).fill('Before renaming');await old.getByRole('button',{name:'Готово',exact:true}).click();await expect(old.locator('footer')).toContainText('1 атомов');
 await old.evaluate(()=>localStorage.setItem('phosphorea:editor-expanded','true'));await old.close();
 const fresh=await context.newPage();await fresh.goto('/Phosphoreya/');await expect(fresh.locator('footer')).toContainText('1 атомов');await expect(fresh).toHaveTitle(/Phosphoreya/);
 expect(await fresh.evaluate(()=>localStorage.getItem('phosphorea:editor-expanded'))).toBe('true');
 const icon=fresh.locator('link[rel=icon][type="image/svg+xml"]');expect((await fresh.request.get(new URL((await icon.getAttribute('href'))!,fresh.url()).href)).ok()).toBe(true);
 await fresh.close();const again=await context.newPage();await again.goto('/Phosphorea/');await expect(again.locator('footer')).toContainText('1 атомов');
});
