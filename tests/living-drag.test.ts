import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {GraphController} from '../src/graph/controller';
import {GraphProviders,type PhysicsProvider} from '../src/graph/providers';
import {graphModel,type GraphModel} from '../src/graph/model';
import {physicsStep,type PhysicsInput,type PhysicsOutput} from '../src/graph/physics';
import {makeAtom,makeLink,type Snapshot,type PositionUpdate} from '../src/core/model';
import {preferences} from '../src/core/preferences';
import {DRAG_LIMIT} from '../src/graph/drag-response';

const controllers:GraphController[]=[];
beforeEach(()=>{vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.stubGlobal('document',{hidden:false});});
afterEach(()=>{controllers.splice(0).forEach(c=>c.close());vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
const atom=(id:string,x:number,y=0,pinned=false)=>makeAtom({id,title:id,x,y,pinned});
it('a linked atom can orbit a neighbour without carrying it around as a rigid pair',async()=>{
 const h=await setup({atoms:[atom('hand',0,-220),atom('anchor',0,0)],links:[makeLink('hand','anchor')]});h.controller.beginDrag('hand');
 for(let i=0;i<=100;i++){const angle=-Math.PI/2+i*Math.PI/100;h.controller.drag('hand',Math.cos(angle)*220,Math.sin(angle)*220);h.controller.advanceDrag(16);}
 expect(h.node('hand').x).toBeCloseTo(0);expect(h.node('hand').y).toBeCloseTo(220);expect(Math.hypot(h.node('anchor').x,h.node('anchor').y)).toBeLessThan(.01);
 h.controller.drag('hand',0,700);for(let i=0;i<30;i++)h.controller.advanceDrag(16);expect(h.node('anchor').y).toBeGreaterThan(0);h.controller.cancelDrag();expect(h.node('anchor')).toMatchObject({x:0,y:0});
});
const still=(input:PhysicsInput):PhysicsOutput=>({nodes:input.nodes,energy:0});
async function setup(data:Snapshot,step:PhysicsProvider['step']=still){
 const providers=new GraphProviders();providers.physics.set('motion',{id:'motion',name:'Motion',step});
 providers.clustering.set('cluster',{id:'cluster',name:'Cluster',project:({data,lens,zoom,selected})=>graphModel(data,lens,zoom,selected)});
 providers.reduction.set('links',{id:'links',name:'Links',reduce:({data})=>data.links});
 providers.weight.set('weights',{id:'weights',name:'Weights',weigh:data=>Object.fromEntries(data.atoms.map(a=>[a.id,30]))});
 let model:GraphModel={nodes:[],links:[],hidden:0};
 const persist=vi.fn(async(_positions:PositionUpdate[],_manual:boolean)=>{}),error=vi.fn(),render=vi.fn((next:GraphModel)=>model=next);
 const controller=new GraphController(providers,render,persist,error);controllers.push(controller);
 const prefs=preferences();controller.sync(data,prefs,0);await vi.advanceTimersByTimeAsync(1000);
 const node=(id:string)=>model.expanded!.nodes.find(n=>n.id===id)!;
 return {controller,providers,persist,error,render,prefs,node,get model(){return model;}};
}

it('tracks the hand exactly, reverses without drift and restores the entire response on cancel',async()=>{
 const data={atoms:[atom('a',0),atom('b',200),atom('pin',400,0,true),atom('behind',600),atom('island',30,100)],links:[makeLink('a','b'),makeLink('b','pin'),makeLink('pin','behind')]};
 const h=await setup(data);const before=data.atoms.map(a=>({id:a.id,x:a.x,y:a.y}));
 h.controller.setInteracting(true);h.controller.beginDrag('a');const retained=h.model,renderCount=h.render.mock.calls.length;
 h.controller.drag('a',100,50);const follower={x:h.node('b').x,y:h.node('b').y};
 expect(h.node('a')).toMatchObject({x:100,y:50});expect(follower.x).toBe(200);expect(follower.x).toBeLessThan(300);
 for(let i=0;i<100;i++)h.controller.drag('a',i-100,i*2);
 h.controller.drag('a',100,50);expect(h.node('b').x).not.toBe(follower.x);expect(Number.isFinite(h.node('b').y)).toBe(true);
 for(let i=0;i<160;i++)h.controller.drag('a',0,0);expect(h.node('b').x).toBeCloseTo(200,5);expect(Math.abs(h.node('b').y)).toBeLessThan(5);
 h.controller.drag('a',100,50);expect(h.model).toBe(retained);expect(h.render).toHaveBeenCalledTimes(renderCount);
 expect(h.node('pin')).toMatchObject({x:400,y:0});expect(h.node('behind')).toMatchObject({x:600,y:0});expect(h.node('island')).toMatchObject({x:30,y:100});
 h.controller.cancelDrag();for(const p of before)expect(h.node(p.id)).toMatchObject(p);
 expect(h.persist).not.toHaveBeenCalled();
});

it('pinned seeds and pinned cluster members remain fixed; cluster centroids keep independent x/y',async()=>{
 const data={atoms:[atom('a',10,100),atom('b',210,400),atom('pin',410,700,true)],links:[]};const h=await setup(data);
 // Supply a retained aggregate just as a clustering provider does.
 h.providers.clustering.set('aggregate',{id:'aggregate',name:'Aggregate',project:({data})=>({nodes:[{...graphModel(data,'all',1,'').nodes[0],id:'cluster',members:data.atoms.map(a=>a.id),x:210,y:400}],links:[],hidden:0})});
 h.controller.sync(data,h.prefs,1);await vi.advanceTimersByTimeAsync(0);
 expect(h.controller.beginDrag('pin')).toBeUndefined();h.controller.drag('pin',900,900);await h.controller.endDrag(false);expect(h.persist).not.toHaveBeenCalled();
 const origin=h.controller.beginDrag('cluster',['a','b','pin'])!;expect(origin).toEqual({x:110,y:250});
 h.controller.drag('cluster',origin.x+90,origin.y+60);
 expect(h.model.nodes[0].x).toBe(270);expect(h.model.nodes[0].y).toBe(440);
 await h.controller.endDrag(false);const positions=h.persist.mock.calls[0][0] as unknown as {id:string;x:number;y:number}[];
 expect(positions).toEqual(expect.arrayContaining([expect.objectContaining({id:'a',x:100,y:160}),expect.objectContaining({id:'b',x:300,y:460})]));
 expect(positions.some(p=>p.id==='pin')).toBe(false);
});

it('release clears manual resistance and resumes local physics without crossing a pin barrier',async()=>{
 const data={atoms:[atom('a',0),atom('b',250),atom('pin',500,0,true),atom('behind',750)],links:[makeLink('a','b'),makeLink('b','pin'),makeLink('pin','behind')]};
 data.atoms[0].spatial.resistance=10000;
 const step=vi.fn(physicsStep),h=await setup(data,step);h.controller.setInteracting(true);h.controller.beginDrag('a');h.controller.drag('a',-300,150);
 await h.controller.endDrag(false);const dropped={x:h.node('a').x,y:h.node('a').y};
 const positions=h.persist.mock.calls[0][0] as unknown as {id:string;resistance:number}[];
 expect(positions.every(p=>p.resistance===0)).toBe(true);
 await vi.advanceTimersByTimeAsync(100);expect(step).not.toHaveBeenCalled();
 h.controller.setInteracting(false);await vi.advanceTimersByTimeAsync(1000);
 expect(step).toHaveBeenCalled();expect(h.node('a').x).toBeGreaterThan(dropped.x);
 expect(h.node('pin')).toMatchObject({x:500,y:0});expect(h.node('behind')).toMatchObject({x:750,y:0});
 expect(step.mock.calls[0][0].nodes.find(n=>n.id==='a')).toMatchObject({pinned:false,dragged:false,resistance:0});
 await vi.advanceTimersByTimeAsync(30000);const settledCalls=step.mock.calls.length;await vi.advanceTimersByTimeAsync(1000);expect(step).toHaveBeenCalledTimes(settledCalls);
 expect(h.error).not.toHaveBeenCalled();
});

it('quiet release sleeps and does not wake on camera changes',async()=>{
 const step=vi.fn(still),h=await setup({atoms:[atom('a',0),atom('b',250)],links:[makeLink('a','b')]},step);
 h.controller.beginDrag('a');h.controller.drag('a',50,20);await h.controller.endDrag(false);
 await vi.advanceTimersByTimeAsync(2000);const count=step.mock.calls.length;expect(count).toBeGreaterThan(0);expect(count).toBeLessThan(20);
 h.controller.view({x:200,y:100,zoom:.8},1200,800,'all','',false,false);await vi.advanceTimersByTimeAsync(2000);expect(step).toHaveBeenCalledTimes(count);
});

it('failed saves restore all propagated nodes, and late saves cannot repaint a newer drag',async()=>{
 const data={atoms:[atom('a',0),atom('b',250)],links:[makeLink('a','b')]},h=await setup(data);
 h.persist.mockRejectedValueOnce(Error('disk full'));h.controller.beginDrag('a');h.controller.drag('a',100,50);
 await expect(h.controller.endDrag(false)).rejects.toThrow('disk full');expect(h.node('a')).toMatchObject({x:0,y:0});expect(h.node('b')).toMatchObject({x:250,y:0});
 let resolve!:()=>void;h.persist.mockImplementationOnce(()=>new Promise<void>(done=>resolve=done));
 h.controller.beginDrag('a');h.controller.drag('a',100,50);const pending=h.controller.endDrag(false);
 h.controller.beginDrag('a');h.controller.drag('a',200,100);const retained=h.model;
 resolve();await pending;expect(h.model).toBe(retained);
 h.controller.drag('a',300,200);expect(h.node('a')).toMatchObject({x:300,y:200});h.controller.cancelDrag();
});

it('a failed old drop cannot roll back newer authoritative coordinates',async()=>{
 const data={atoms:[atom('a',0),atom('b',250)],links:[makeLink('a','b')]},h=await setup(data);
 let reject!:(error:Error)=>void;h.persist.mockImplementationOnce(()=>new Promise<void>((_,fail)=>reject=fail));
 h.controller.beginDrag('a');h.controller.drag('a',100,50);const pending=expect(h.controller.endDrag(false)).rejects.toThrow('old save failed');
 h.controller.sync({...data,atoms:data.atoms.map(a=>({...a,revision:2,x:a.x+700}))},h.prefs,0);await vi.advanceTimersByTimeAsync(0);
 reject(Error('old save failed'));await pending;
 expect(h.node('a')).toMatchObject({x:700,y:0});expect(h.node('b')).toMatchObject({x:950,y:0});
});

it('small graphs retain existing rest lengths through drop, insertion and interrupted layout',async()=>{
 const link=makeLink('a','b'),data={atoms:[atom('a',0),atom('b',350)],links:[link]},step=vi.fn(still),h=await setup(data,step);
 h.controller.beginDrag('a');h.controller.drag('a',-100,0);await h.controller.endDrag(false);await vi.advanceTimersByTimeAsync(32);
 expect(step.mock.calls[0][0].links[0].distance).toBe(350);
 h.controller.sync({atoms:[...data.atoms,atom('new',1000)],links:[link]},h.prefs,0);await vi.advanceTimersByTimeAsync(64);
 expect(step.mock.calls.at(-1)![0].links[0].distance).toBe(350);
 const arrange=vi.fn(({data}:any)=>({positions:data.atoms.map((a:any)=>({id:a.id,x:a.x*2,y:a.y})),skeleton:[link.id]}));
 h.providers.structure.set('layout',{id:'layout',name:'Layout',description:'Layout',physicsId:'motion',defaults:h.prefs.physics,arrange});
 h.controller.sync({atoms:[...data.atoms,atom('new',1000)],links:[link]},{...h.prefs,graphModel:'layout'},1);await vi.advanceTimersByTimeAsync(100);
 const reached=h.node('b').x-h.node('a').x;h.controller.setInteracting(true);
 h.controller.beginDrag('a');h.controller.drag('a',h.node('a').x-20,0);await h.controller.endDrag(false);h.controller.setInteracting(false);await vi.advanceTimersByTimeAsync(32);
 expect(step.mock.calls.at(-1)![0].links[0].distance).toBeCloseTo(reached,8);
 expect(arrange.mock.calls[0][0].data.atoms[0].x).toBe(-100);
 expect(h.error).not.toHaveBeenCalled();
});

it('rejects a pending physics frame when the provider is replaced without a layout reset',async()=>{
 let finish!:(value:PhysicsOutput)=>void;const old=vi.fn((input:PhysicsInput)=>new Promise<PhysicsOutput>(resolve=>finish=resolve));
 const data={atoms:[atom('a',0)],links:[]},h=await setup(data,old);
 h.controller.beginDrag('a');h.controller.drag('a',100,50);await h.controller.endDrag(false);await vi.advanceTimersByTimeAsync(16);
 const current=vi.fn(still);h.providers.physics.set('motion',{id:'motion',name:'Replacement',step:current});h.controller.sync(data,h.prefs,1);
 finish({nodes:old.mock.calls[0][0].nodes.map(n=>({...n,x:9999})),energy:999});await vi.advanceTimersByTimeAsync(100);
 expect(h.node('a')).toMatchObject({x:100,y:50});expect(current).toHaveBeenCalled();expect(h.error).not.toHaveBeenCalled();
});

it('a late structural result cannot replace an active drag',async()=>{
 const data={atoms:[atom('a',0),atom('b',250)],links:[makeLink('a','b')]},h=await setup(data);
 let finish!:(value:any)=>void;
 h.providers.structure.set('slow',{id:'slow',name:'Slow',description:'Slow',physicsId:'motion',defaults:h.prefs.physics,arrange:()=>new Promise(resolve=>finish=resolve)});
 h.controller.sync(data,{...h.prefs,graphModel:'slow'},1);await vi.advanceTimersByTimeAsync(0);
 h.controller.beginDrag('a');h.controller.drag('a',100,50);const retained=h.model;
 finish({positions:data.atoms.map(a=>({id:a.id,x:9999,y:9999})),skeleton:[]});await vi.advanceTimersByTimeAsync(100);
 expect(h.model).toBe(retained);expect(h.node('a')).toMatchObject({x:100,y:50});
 h.controller.drag('a',150,70);expect(h.node('a')).toMatchObject({x:150,y:70});expect(h.error).not.toHaveBeenCalled();
});

it('spring geometry is available even when a new structural provider has not answered',async()=>{
 const data={atoms:[atom('a',0),atom('b',420)],links:[makeLink('a','b')]},step=vi.fn(still),h=await setup(data,step);
 h.controller.sync({atoms:[],links:[]},h.prefs,0);await vi.advanceTimersByTimeAsync(0);
 let finish!:(value:any)=>void;
 h.providers.structure.set('slow',{id:'slow',name:'Slow',description:'Slow',physicsId:'motion',defaults:h.prefs.physics,arrange:()=>new Promise(resolve=>finish=resolve)});
 h.controller.sync(data,{...h.prefs,graphModel:'slow'},1);h.controller.beginDrag('a');h.controller.drag('a',-100,0);
 await h.controller.endDrag(false);await vi.advanceTimersByTimeAsync(32);
 expect(step.mock.calls[0][0].links[0].distance).toBe(420);
 finish({positions:data.atoms.map(a=>({id:a.id,x:a.x,y:a.y})),skeleton:data.links.map(l=>l.id)});await vi.advanceTimersByTimeAsync(0);
 expect(h.error).not.toHaveBeenCalled();
});

it('a provider removed while its step is pending may reject without stopping its replacement',async()=>{
 let reject!:(error:Error)=>void;const old=vi.fn(()=>new Promise<PhysicsOutput>((_,fail)=>reject=fail));
 const data={atoms:[atom('a',0)],links:[]},h=await setup(data,old);
 h.controller.beginDrag('a');h.controller.drag('a',100,50);await h.controller.endDrag(false);await vi.advanceTimersByTimeAsync(16);
 const next=vi.fn(still);h.providers.physics.set('motion',{id:'motion',name:'Replacement',step:next});h.controller.sync(data,h.prefs,1);
 reject(Error('Old worker closed'));await vi.advanceTimersByTimeAsync(100);
 expect(h.error).not.toHaveBeenCalled();expect(next).toHaveBeenCalled();expect(h.node('a')).toMatchObject({x:100,y:50});
});

it('a pin change during drag cancels the cached plan before any further movement',async()=>{
 const data={atoms:[atom('a',0),atom('b',200),atom('c',400)],links:[makeLink('a','b'),makeLink('b','c')]},h=await setup(data);
 h.controller.beginDrag('a');h.controller.drag('a',100,50);
 h.controller.sync({...data,atoms:data.atoms.map(a=>a.id==='b'?{...a,pinned:true}:a)},h.prefs,0);
 h.controller.drag('a',900,900);await h.controller.endDrag(false);await vi.advanceTimersByTimeAsync(0);
 expect(h.node('a')).toMatchObject({x:0,y:0});expect(h.node('b')).toMatchObject({x:200,y:0});expect(h.node('c')).toMatchObject({x:400,y:0});expect(h.persist).not.toHaveBeenCalled();
});

it('a state drop restores and persists the full response without waking physics',async()=>{
 const data={atoms:[atom('a',0),atom('b',200)],links:[makeLink('a','b')]},step=vi.fn(still);data.atoms[0].spatial.resistance=2;const h=await setup(data,step);
 h.controller.beginDrag('a');h.controller.drag('a',200,80);await h.controller.endDrag(true);await vi.advanceTimersByTimeAsync(1000);
 expect(h.node('a')).toMatchObject({x:0,y:0});expect(h.node('b')).toMatchObject({x:200,y:0});expect(step).not.toHaveBeenCalled();
 expect(h.persist.mock.calls[0][0].find(p=>p.id==='a')?.resistance).toBe(2);
 expect(h.persist.mock.calls[0][0].map(p=>[p.id,p.x,p.y])).toEqual(expect.arrayContaining([['a',0,0],['b',200,0]]));
});

it('completed layout transitions use their final geometry as the next spring rest state',async()=>{
 const data={atoms:[atom('a',0),atom('b',250)],links:[makeLink('a','b')]},step=vi.fn(still),h=await setup(data,step);
 h.providers.structure.set('wide',{id:'wide',name:'Wide',description:'Wide',physicsId:'motion',defaults:h.prefs.physics,arrange:({data})=>({positions:data.atoms.map(a=>({id:a.id,x:a.x*3,y:a.y})),skeleton:data.links.map(l=>l.id)})});
 h.controller.sync(data,{...h.prefs,graphModel:'wide'},1);await vi.advanceTimersByTimeAsync(1000);
 expect(h.node('b').x).toBe(750);expect(step).not.toHaveBeenCalled();
 h.controller.beginDrag('a');h.controller.drag('a',-100,0);await h.controller.endDrag(false);await vi.advanceTimersByTimeAsync(32);
 expect(step.mock.calls[0][0].links[0].distance).toBe(750);expect(h.error).not.toHaveBeenCalled();
});

it.each([100,500,1000])('measures cached drag at %i atoms without reading graph or projection arrays per move',async count=>{
 const atoms=Array.from({length:count},(_,i)=>atom('n'+i,(i%25)*50,Math.floor(i/25)*50));
 const data={atoms,links:atoms.slice(1).map(a=>makeLink('n0',a.id))},h=await setup(data);
 const start=performance.now();h.controller.beginDrag('n0');const preparation=performance.now()-start;
 const graph=vi.spyOn(data.links,Symbol.iterator).mockImplementation(()=>{throw Error('Graph scanned during move');});
 const projection=vi.spyOn(h.model.expanded!.nodes,Symbol.iterator).mockImplementation(()=>{throw Error('Projection scanned during move');});
 const started=performance.now();for(let i=0;i<1000;i++)h.controller.drag('n0',i*.1,i*.05);const moves=performance.now()-started;
 graph.mockRestore();projection.mockRestore();
 expect(h.node('n0')).toMatchObject({x:99.9,y:49.95});
 const affected=atoms.filter(a=>h.node(a.id).x!==a.x||h.node(a.id).y!==a.y).length;
 expect(affected).toBeLessThanOrEqual(DRAG_LIMIT+1);expect(affected).toBeGreaterThan(1);
 console.log(JSON.stringify({atoms:count,affected,prepareMs:+preparation.toFixed(3),meanMoveMs:+(moves/1000).toFixed(4)}));
 h.controller.cancelDrag();
});
