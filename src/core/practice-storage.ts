import {validateAtom,validateLink,type StorageAdapter,type Snapshot,type Mutation} from './model';
/** Disposable learning workspace. It never opens OPFS or shares device settings. */
export class PracticeStorage implements StorageAdapter{
 private data:Snapshot={atoms:[],links:[]};private settings=new Map<string,unknown>();
 async open(){}
 async snapshot(){return structuredClone(this.data);}
 async getSetting<T>(key:string){return structuredClone(this.settings.get(key)) as T|undefined;}
 async transaction(ops:Mutation[]){
  const data=structuredClone(this.data),settings=new Map(this.settings);
  for(const op of ops){
   if(op.kind==='setting')settings.set(op.key,structuredClone(op.value));
   if(op.kind==='atom'){validateAtom(op.atom);const i=data.atoms.findIndex(a=>a.id===op.atom.id);if(op.expectedRevision!==undefined&&data.atoms[i]?.revision!==op.expectedRevision)throw Error('Practice revision changed');if(i<0)data.atoms.push(structuredClone(op.atom));else data.atoms[i]=structuredClone(op.atom);}
   if(op.kind==='link'){validateLink(op.link);data.links=data.links.filter(l=>l.id!==op.link.id);data.links.push(structuredClone(op.link));}
   if(op.kind==='unlink')data.links=data.links.filter(l=>l.id!==op.id);
   if(op.kind==='delete'){data.atoms=data.atoms.filter(a=>a.id!==op.id);data.links=data.links.filter(l=>l.from!==op.id&&l.to!==op.id);}
   if(op.kind==='positions')for(const p of op.positions){const atom=data.atoms.find(a=>a.id===p.id);if(atom){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Invalid practice position');atom.x=p.x;atom.y=p.y;}}
  }
  if(data.links.some(l=>!data.atoms.some(a=>a.id===l.from)||!data.atoms.some(a=>a.id===l.to)))throw Error('Practice link endpoint missing');
  this.data=data;this.settings=settings;
 }
 async exportDatabase(){return new TextEncoder().encode(JSON.stringify({format:'phosphorea-practice',data:this.data}));}
 close(){this.data={atoms:[],links:[]};this.settings.clear();}
}
