import type {PlacementInput} from './placement';
import type {Snapshot,Link} from '../core/model';
import type {GraphModel} from './model';
import type {PhysicsInput,PhysicsOutput} from './physics';
import type {PhysicsSettings} from './physics';
export interface StructuralInput{data:Snapshot;settings:PhysicsSettings;intent?:'resume'|'reflow';locked?:string[]}
export interface StructuralOutput{positions:{id:string;x:number;y:number}[];skeleton:string[]}
export interface StructuralProvider extends Provider{description:string;physicsId:string;defaults:PhysicsSettings;arrange:(input:StructuralInput)=>StructuralOutput|Promise<StructuralOutput>}
export interface Provider {id:string;name:string}
export interface MapTool extends Provider {kind:'lasso'|'ambient-lens'}
export interface PhysicsProvider extends Provider {step:(input:PhysicsInput)=>PhysicsOutput|Promise<PhysicsOutput>}
export interface LayoutProvider extends Provider {place:(input:PlacementInput)=>{x:number;y:number}|Promise<{x:number;y:number}>}
export interface ClusteringProvider extends Provider {project:(input:{data:Snapshot;lens:string;zoom:number;selected:string})=>GraphModel|Promise<GraphModel>}
export interface LinkReductionProvider extends Provider {reduce:(input:{data:Snapshot;selected:string})=>Link[]|Promise<Link[]>}
export interface NodeWeightProvider extends Provider {weigh:(data:Snapshot)=>Record<string,number>|Promise<Record<string,number>>}
const staticPhysics:PhysicsProvider={id:'static',name:'Static',step:input=>({nodes:input.nodes,energy:0})};
export class GraphProviders {
 tools=new Map<string,MapTool>();
 hasTool(kind:MapTool['kind']){return [...this.tools.values()].some(tool=>tool.kind===kind);}
 structure=new Map<string,StructuralProvider>();
 physics=new Map<string,PhysicsProvider>();layout=new Map<string,LayoutProvider>();clustering=new Map<string,ClusteringProvider>();reduction=new Map<string,LinkReductionProvider>();weight=new Map<string,NodeWeightProvider>();
 active<T>(map:Map<string,T>):T{const value=[...map.values()].at(-1);if(!value)throw Error('Провайдер карты не зарегистрирован.');return value;}
 structural(id?:string){return this.structure.get(id||'')||this.structure.values().next().value;}
 // Standalone community physics retains its public override behavior. The stable
 // fallback identity also lets controllers detect actual provider replacement.
 motion(id?:string){const model=this.structural(id),paired=new Set([...this.structure.values()].map(p=>p.physicsId));const custom=[...this.physics.values()].filter(p=>!paired.has(p.id)).at(-1);return custom||(model&&this.physics.get(model.physicsId))||[...this.physics.values()].at(-1)||staticPhysics;}
}
