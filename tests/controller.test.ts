import {it,expect,vi} from 'vitest';
import {GraphController} from '../src/graph/controller';
import {GraphProviders} from '../src/graph/providers';
import {graphModel} from '../src/graph/model';
import {makeAtom,makeLink} from '../src/core/model';
import {preferences} from '../src/core/preferences';
it('model changes finish at provider coordinates, preserve pins, and can be interrupted in place',async()=>{
 vi.useFakeTimers();vi.stubGlobal('document',{hidden:false});const providers=new GraphProviders(),step=vi.fn(input=>({nodes:input.nodes.map((n:any)=>({...n,x:n.x+100})),energy:100}));
 providers.physics.set('motion',{id:'motion',name:'Motion',step});
 for(const id of ['a','b'])providers.structure.set(id,{id,name:id,description:id,physicsId:'motion',defaults:preferences().physics,arrange:({data,locked})=>({positions:data.atoms.map((n,i)=>({id:n.id,x:locked?.includes(n.id)?n.x:i*250+(id==='b'?1000:0),y:locked?.includes(n.id)?n.y:id==='b'?300:0})),skeleton:data.links.map(l=>l.id)})});
 providers.clustering.set('cluster',{id:'cluster',name:'Cluster',project:({data,lens,zoom,selected})=>graphModel(data,lens,zoom,selected)});providers.reduction.set('links',{id:'links',name:'Links',reduce:({data})=>data.links});providers.weight.set('weights',{id:'weights',name:'Weights',weigh:data=>Object.fromEntries(data.atoms.map(a=>[a.id,30]))});
 const atoms=Array.from({length:8},(_,i)=>makeAtom({id:'motion-'+i,title:'Atom '+i,x:i*250,y:0,pinned:i===0})),data={atoms,links:atoms.slice(1).map(a=>makeLink(atoms[0].id,a.id))};let latest:any;const persist=vi.fn(async()=>{}),error=vi.fn(),controller=new GraphController(providers,m=>latest=m,persist,error),prefs=preferences({graphModel:'a'});
 const points=()=>latest.expanded.nodes.map((n:any)=>[n.x,n.y]);
 try{controller.sync(data,prefs,0);await vi.advanceTimersByTimeAsync(1000);expect(points()).toEqual(atoms.map(a=>[a.x,a.y]));expect(step).not.toHaveBeenCalled();
  controller.sync(data,{...prefs,graphModel:'b'},0);await vi.advanceTimersByTimeAsync(180);expect(points()[1][0]).toBeGreaterThan(250);expect(points()[1][0]).toBeLessThan(1250);await vi.advanceTimersByTimeAsync(1000);expect(points()).toEqual(atoms.map((a,i)=>[i?i*250+1000:0,i?300:0]));expect(latest.arranging).toBe(false);expect(step).not.toHaveBeenCalled();expect(persist).toHaveBeenCalled();
  controller.sync(data,prefs,0);await vi.advanceTimersByTimeAsync(90);controller.setInteracting(true);expect(latest.arranging).toBe(false);const interrupted=points();await vi.advanceTimersByTimeAsync(1000);expect(points()).toEqual(interrupted);controller.setInteracting(false);await vi.advanceTimersByTimeAsync(1000);expect(points()).toEqual(interrupted);expect(error).not.toHaveBeenCalled();
  controller.sync({atoms:[],links:[]},prefs,1);await vi.advanceTimersByTimeAsync(1000);controller.sync(data,{...prefs,graphModel:'b'},2,true);await vi.advanceTimersByTimeAsync(1000);expect(points()).toEqual(atoms.map(a=>[a.x,a.y]));expect(step).not.toHaveBeenCalled();
 }finally{controller.close();vi.useRealTimers();vi.unstubAllGlobals();}
});
it('drag transmits to connected free atoms and restores all affected geometry on cancellation',async()=>{
 vi.useFakeTimers();vi.stubGlobal('document',{hidden:false});const providers=new GraphProviders();
 providers.physics.set('test',{id:'test',name:'Test',step:input=>({nodes:input.nodes,energy:0})});
 providers.clustering.set('test',{id:'test',name:'Test',project:({data,lens,zoom,selected})=>graphModel(data,lens,zoom,selected)});
 providers.reduction.set('test',{id:'test',name:'Test',reduce:({data})=>data.links});
 providers.weight.set('test',{id:'test',name:'Test',weigh:data=>Object.fromEntries(data.atoms.map(a=>[a.id,30]))});
 let latest:any;const persist=vi.fn(async()=>{}),error=vi.fn(),controller=new GraphController(providers,m=>latest=m,persist,error);
 const atoms=['a','b','pin','island'].map((id,i)=>makeAtom({id,title:id,x:i*200,y:0,pinned:id==='pin'}));
 try{controller.sync({atoms,links:[makeLink('a','b'),makeLink('a','pin')]},preferences(),0);await vi.advanceTimersByTimeAsync(1000);
 controller.beginDrag('a');
 // A hand sends far more pointer events than the screen has frames. Rebuilding
 // the projection per event is what made a drag feel like it was fighting the hand.
 const node0=(id:string)=>latest.expanded.nodes.find((n:any)=>n.id===id);const shown=latest;for(let i=1;i<=20;i++)controller.drag('a',i*5,i*2.5);
 expect(latest).toBe(shown);expect(node0('a').x).toBe(100);expect(node0('a').y).toBe(50);
 controller.cancelDrag();controller.beginDrag('a');controller.drag('a',100,50);
 const node=(id:string)=>latest.expanded.nodes.find((n:any)=>n.id===id);
 expect(node('a').x).toBe(100);expect(node('b').x).toBe(200);expect(node('b').x).toBeLessThan(300);expect(node('b').y).toBe(0);
 expect(node('pin').x).toBe(400);expect(node('pin').y).toBe(0);expect(node('island').x).toBe(600);
 controller.cancelDrag();expect(node('a').x).toBe(0);expect(node('b').x).toBe(200);
 controller.beginDrag('a');controller.drag('a',100,50);await controller.endDrag(true);expect(node('a').x).toBe(0);expect(node('b').x).toBe(200);
 controller.beginDrag('a');controller.drag('a',100,50);await controller.endDrag(false);const placedB={x:node('b').x,y:node('b').y};await vi.advanceTimersByTimeAsync(2000);expect(node('b')).toMatchObject(placedB);await controller.flush();expect(persist).toHaveBeenCalled();expect(error).not.toHaveBeenCalled();
 persist.mockRejectedValueOnce(Error('Disk full'));controller.beginDrag('a',['a','b']);controller.drag('a',500,300);const rejected=controller.endDrag(false),checkRejected=expect(rejected).rejects.toThrow('Disk full');controller.setInteracting(true);await checkRejected;controller.setInteracting(false);expect(node('a')).toMatchObject({x:100,y:50});expect(node('b')).toMatchObject(placedB);
 let reject!: (error:Error)=>void;persist.mockImplementationOnce(()=>new Promise<void>((_,fail)=>reject=fail));controller.beginDrag('a');controller.drag('a',300,200);const pending=controller.endDrag(false),failed=expect(pending).rejects.toThrow('First write failed');controller.beginDrag('a');controller.drag('a',450,250);reject(Error('First write failed'));await failed;expect(node('a')).toMatchObject({x:450,y:250});await controller.endDrag(false);
 }finally{controller.close();vi.useRealTimers();vi.unstubAllGlobals();}
});
it('reopening keeps saved positions and a local insertion does not recalculate the full layout',async()=>{
 vi.useFakeTimers();vi.stubGlobal('document',{hidden:false});const providers=new GraphProviders(),prefs=preferences();const arrange=vi.fn(async({data}:any)=>({positions:data.atoms.map((a:any)=>({id:a.id,x:9999,y:9999})),skeleton:[]}));providers.structure.set('layout',{id:'layout',name:'Layout',description:'Test',physicsId:'motion',defaults:prefs.physics,arrange});providers.physics.set('motion',{id:'motion',name:'Motion',step:input=>({nodes:input.nodes,energy:0})});providers.clustering.set('cluster',{id:'cluster',name:'Cluster',project:({data,lens,zoom,selected})=>graphModel(data,lens,zoom,selected)});providers.reduction.set('links',{id:'links',name:'Links',reduce:({data})=>data.links});providers.weight.set('weight',{id:'weight',name:'Weight',weigh:data=>Object.fromEntries(data.atoms.map(a=>[a.id,30]))});let latest:any;const error=vi.fn(),controller=new GraphController(providers,model=>latest=model,async()=>{},error);const atoms=Array.from({length:20},(_,i)=>makeAtom({id:'restored-'+i,title:'Restored '+i,x:i*300,y:400}));
 try{controller.sync({atoms,links:[]},prefs,0);await vi.advanceTimersByTimeAsync(1000);expect(arrange.mock.calls[0][0].intent).toBe('resume');expect(latest.expanded.nodes.map((n:any)=>n.x)).toEqual(atoms.map(a=>a.x));controller.sync({atoms:[...atoms,makeAtom({title:'One new atom',x:7000,y:500})],links:[]},prefs,0);await vi.advanceTimersByTimeAsync(1000);expect(arrange).toHaveBeenCalledTimes(1);expect(error).not.toHaveBeenCalled();}finally{controller.close();vi.useRealTimers();vi.unstubAllGlobals();}
});
it('camera changes never wake resting physics; semantic changes reuse the retained pair',async()=>{
 vi.useFakeTimers();vi.stubGlobal('document',{hidden:false});const providers=new GraphProviders();const step=vi.fn(input=>({nodes:input.nodes,energy:0})),project=vi.fn(({data,lens,zoom,selected})=>graphModel(data,lens,zoom,selected));providers.physics.set('test',{id:'test',name:'Test',step});providers.clustering.set('test',{id:'test',name:'Test',project});providers.reduction.set('test',{id:'test',name:'Test',reduce:({data})=>data.links});providers.weight.set('test',{id:'test',name:'Test',weigh:data=>Object.fromEntries(data.atoms.map(a=>[a.id,30]))});const render=vi.fn(),persist=vi.fn(async()=>{}),error=vi.fn(),controller=new GraphController(providers,render,persist,error);
 try{controller.sync({atoms:[makeAtom({title:'Still',x:200,y:-80})],links:[]},preferences(),0);await vi.advanceTimersByTimeAsync(1000);const count=step.mock.calls.length,projections=project.mock.calls.length;controller.setInteracting(true);controller.setInteracting(false);for(const zoom of [.9,.8,.7,.6])controller.view({x:zoom*70,y:zoom*30,zoom},1280,720,'all','',false,false);await vi.advanceTimersByTimeAsync(1000);expect(step).toHaveBeenCalledTimes(count);expect(project).toHaveBeenCalledTimes(projections);controller.view({x:0,y:0,zoom:.3},1280,720,'all','',false,false);await vi.advanceTimersByTimeAsync(1000);expect(project).toHaveBeenCalledTimes(projections);expect(step).toHaveBeenCalledTimes(count);expect(error).not.toHaveBeenCalled();}finally{controller.close();vi.useRealTimers();vi.unstubAllGlobals();}
});

it('reconnection with the same link ID updates both retained projections',async()=>{
 vi.useFakeTimers();vi.stubGlobal('document',{hidden:false});const providers=new GraphProviders();
 providers.physics.set('test',{id:'test',name:'Test',step:input=>({nodes:input.nodes,energy:0})});
 providers.clustering.set('test',{id:'test',name:'Test',project:({data,lens,zoom,selected})=>graphModel(data,lens,zoom,selected)});
 providers.reduction.set('test',{id:'test',name:'Test',reduce:({data})=>data.links});
 providers.weight.set('test',{id:'test',name:'Test',weigh:data=>Object.fromEntries(data.atoms.map(a=>[a.id,30]))});
 let latest:any;const error=vi.fn(),controller=new GraphController(providers,m=>latest=m,async()=>{},error);
 const atoms=['a','b','c'].map((id,i)=>makeAtom({id,title:id,x:i*200,pinned:true})),link=makeLink('a','b');
 try{controller.sync({atoms,links:[link]},preferences(),0);await vi.advanceTimersByTimeAsync(1000);
  controller.sync({atoms,links:[{...link,to:'c'}]},preferences(),0);await vi.advanceTimersByTimeAsync(1000);
  expect(latest.expanded.links[0]).toMatchObject({id:link.id,from:'a',to:'c'});expect(error).not.toHaveBeenCalled();
 }finally{controller.close();vi.useRealTimers();vi.unstubAllGlobals();}
});
