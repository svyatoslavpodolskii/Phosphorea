import {it,expect} from 'vitest';
import {makeAtom} from '../src/core/model';
import {folderLensAtoms,lensFocus} from '../src/graph/lens';
import {folderTerritories,projectFolders,FOLDER_DEFINITIONS,FOLDER_MEMBERSHIP} from '../src/graph/folders';
it('shrinks a folder to foreground notes and removes its contour when nothing remains',()=>{
 const a=makeAtom({id:'a',title:'Here',x:0,y:0,properties:{[FOLDER_DEFINITIONS]:[{id:'work',name:'Work',color:'#eeeeee',roots:['a']}],[FOLDER_MEMBERSHIP]:{work:1}}});
 const b=makeAtom({id:'b',title:'Far away',x:9000,y:0,state:'archived',properties:{[FOLDER_MEMBERSHIP]:{work:1}}});
 const data={atoms:[a,b],links:[]},projection=projectFolders(data);
 expect(folderTerritories(projection,folderLensAtoms(data.atoms,'all'))[0].bounds.maxX).toBeLessThan(500);
 a.state='archived';expect(folderTerritories(projection,folderLensAtoms(data.atoms,'all'))).toEqual([]);
 expect(folderTerritories(projection,folderLensAtoms(data.atoms,'archived'))[0].bounds.maxX).toBeGreaterThan(9000);
});
it('uses one foreground rule for labels, nodes and ordinary/now/archive lenses',()=>{
 expect(lensFocus('archived','all')).toBe(false);expect(lensFocus('normal','all')).toBe(true);
 expect(lensFocus('now','now')).toBe(true);expect(lensFocus('normal','now')).toBe(false);expect(lensFocus('archived','archived')).toBe(true);
});
