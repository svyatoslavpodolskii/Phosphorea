import {it,expect} from 'vitest';
import {structure} from '../src/graph/structure';
import {graphModel} from '../src/graph/model';
import {makeAtom,makeLink} from '../src/core/model';
it('projects and traverses a 10000-note chain without recursive stack overflow',()=>{
 const atoms=Array.from({length:10000},(_,i)=>makeAtom({id:'chain-'+i,title:'Chain '+i,pinned:true,x:i,y:0})),links=atoms.slice(1).map((atom,i)=>makeLink(atoms[i].id,atom.id));
 const tree=structure({atoms,links});expect(tree.size.get(tree.roots[0])).toBe(10000);expect(tree.descendants(tree.roots[0])).toHaveLength(10000);
 const model=graphModel({atoms,links},'all',.3,'');expect(model.nodes.length).toBeGreaterThan(0);expect(new Set(model.nodes.flatMap(n=>n.members||[n.id])).size).toBe(10000);
});
