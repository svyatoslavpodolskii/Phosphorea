import {it,expect} from 'vitest';
import {placeAtom,segmentsCross} from '../src/graph/placement';
import {makeAtom,makeLink} from '../src/core/model';
// Fixed ids and creation times: the structural walk breaks ties on both, so a
// generated identity would make the geometry this test measures non deterministic.
const at='2026-01-01T00:00:00Z';
it('grows a child into a free direction without crossing an existing link',()=>{
  const ancestor=makeAtom({id:'ancestor',title:'Ancestor',x:-240,y:0,importance:2,created_at:at}),parent=makeAtom({id:'parent',title:'Parent',x:0,y:0,created_at:at}),top=makeAtom({id:'top',title:'Top',x:110,y:-110,created_at:at}),bottom=makeAtom({id:'bottom',title:'Bottom',x:110,y:110,created_at:at});
  const data={atoms:[ancestor,parent,top,bottom],links:[makeLink('ancestor','parent'),makeLink('top','bottom')]},before=structuredClone(data);
  const child=placeAtom({data,parent:'parent'});
  expect(segmentsCross(parent,child,top,bottom)).toBe(false);expect(data).toEqual(before);
  expect(Math.hypot(child.x-parent.x,child.y-parent.y)).toBeLessThan(400);
});
it('successive children occupy distinct sectors around the same parent',()=>{
  const root=makeAtom({id:'root',title:'Root',created_at:at}),first=makeAtom({id:'first',title:'First',x:190,y:0,created_at:at});
  const point=placeAtom({data:{atoms:[root,first],links:[makeLink(root.id,first.id)]},parent:root.id});
  expect(Math.abs(Math.atan2(point.y,point.x))).toBeGreaterThan(.4);
});
it('does not extend an existing incident edge along the same ray',()=>{
 const root=makeAtom({id:'root',title:'Root'}),sibling=makeAtom({id:'sibling',title:'Sibling',x:0,y:-200});
 for(const reversed of [false,true]){
  const data={atoms:[root,sibling],links:[makeLink(reversed?sibling.id:root.id,reversed?root.id:sibling.id)]};
  const child=placeAtom({data,parent:root.id});
  const cosine=-child.y/Math.hypot(child.x,child.y);expect(cosine).toBeLessThan(.985);
 }
});
it('considers secondary link targets and avoids crossing an unrelated wall',()=>{
 const root=makeAtom({id:'root',title:'Root',x:-200,y:0}),target=makeAtom({id:'target',title:'Target',x:-200,y:300}),a=makeAtom({id:'a',title:'A',x:100,y:-700}),b=makeAtom({id:'b',title:'B',x:100,y:700});
 const data={atoms:[root,target,a,b],links:[makeLink(a.id,b.id)]};
 const child=placeAtom({data,parent:root.id,targets:[root.id,target.id],atom:{title:'New linked note'}});
 expect(segmentsCross(root,child,a,b)).toBe(false);expect(segmentsCross(target,child,a,b)).toBe(false);
});
