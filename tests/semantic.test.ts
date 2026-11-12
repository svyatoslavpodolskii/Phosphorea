import {it,expect} from 'vitest';
import {SemanticScene,semanticLevel} from '../src/graph/semantic';
import type {GraphModel,GraphNode} from '../src/graph/model';
const node=(id:string,x:number):GraphNode=>({id,x,y:0,radius:30,label:id,color:'#b4ecc1',icon:'·',shape:'circle',style:'solid',state:'normal'});
const detailed:GraphModel={nodes:[node('a',-100),node('b',100)],links:[],hidden:0};
const collapsed:GraphModel={nodes:[{...node('cluster:a',0),radius:44,members:['a','b']}],links:[],hidden:0};
it('retains settled scene arrays for camera-only frames and invalidates them on edits and level changes',()=>{
 const scene=new SemanticScene(),model={...collapsed,expanded:detailed};const first=scene.advance(model,16,true,'',0);
 expect(scene.advance(model,16,false,'',0)).toBe(first);
 const zoomed=scene.advance(model,16,false,'',.6);expect(zoomed).not.toBe(first);
 expect(scene.advance({...model,expanded:{...detailed,nodes:[...detailed.nodes,node('c',400)]}},16,false,'',.6)).not.toBe(zoomed);
});
it('hysteresis ignores wheel jitter and changes representation only outside the range',()=>{let level=true;for(const zoom of [.43,.48,.53,.49,.45]){level=semanticLevel(zoom,level);expect(level).toBe(true);}expect(semanticLevel(.57,level)).toBe(false);expect(semanticLevel(.43,false)).toBe(false);expect(semanticLevel(.41,false)).toBe(true);});
it('children unfold from the painted parent and reverse continuously without touching world coordinates',()=>{
 const before=JSON.stringify([detailed,collapsed]),scene=new SemanticScene();scene.advance(collapsed,16,true);const started=scene.advance(detailed,16);const a=started.nodes.find(n=>n.id==='a')!;expect(a.x).toBeGreaterThan(-100);expect(a.x).toBeLessThan(0);expect(a.opacity).toBeGreaterThan(0);expect(a.opacity).toBeLessThan(1);const reversed=scene.advance(collapsed,16),back=reversed.nodes.find(n=>n.id==='a')!;expect(back.x).toBeGreaterThan(a.x);expect(back.opacity).toBeLessThan(a.opacity);expect(reversed.nodes.find(n=>n.members)?.x).toBeCloseTo(0);let settled=reversed;for(let i=0;i<80;i++)settled=scene.advance(collapsed,16);expect(settled.nodes).toHaveLength(1);expect(settled.active).toBe(false);expect(JSON.stringify([detailed,collapsed])).toBe(before);
});
it('reduced motion reaches the target immediately and dragged coordinates track the hand',()=>{const scene=new SemanticScene();scene.advance(collapsed,16,true);const full=scene.advance(detailed,16,true);expect(full.nodes.map(n=>n.id)).toEqual(['a','b']);expect(full.nodes[0].x).toBe(-100);const moved={...detailed,nodes:[{...detailed.nodes[0],x:-500},detailed.nodes[1]]};expect(scene.advance(moved,16,false,'a').nodes.find(n=>n.id==='a')?.x).toBe(-500);});

it('new atoms appear smoothly while semantic zoom still follows the camera directly',()=>{
 const scene=new SemanticScene(),model={...collapsed,expanded:detailed};scene.advance(model,16,true,'',0);
 const added={...model,expanded:{...detailed,nodes:[...detailed.nodes,node('new',300)]}};const started=scene.advance(added,16,false,'',0);
 expect(started.nodes.find(n=>n.id==='a')?.opacity).toBe(1);expect(started.nodes.find(n=>n.id==='new')?.opacity).toBeGreaterThan(0);expect(started.nodes.find(n=>n.id==='new')?.opacity).toBeLessThan(1);expect(started.active).toBe(true);
 for(let i=0;i<80;i++)scene.advance(added,16,false,'',0);const zoomed=scene.advance(added,16,false,'',.6);
 expect(zoomed.nodes.find(n=>n.id==='a')?.opacity).toBeCloseTo(.4);expect(zoomed.nodes.find(n=>n.members)?.opacity).toBeCloseTo(.6);expect(zoomed.active).toBe(false);expect(zoomed.nodes.find(n=>n.id==='new')?.x).toBe(300);
 const reduced={...added,expanded:{...added.expanded,nodes:[...added.expanded.nodes,node('instant',400)]}};expect(scene.advance(reduced,16,true,'',0).nodes.find(n=>n.id==='instant')?.opacity).toBe(1);
});
