import {storedBytes,listVaults,type StoredFile,type Vault} from './vault-files';
export {storedBytes,listVaults,type Vault} from './vault-files';
import {notePath,references,resolvePath,resolveAtom,type SourcePath} from './note-references';
export {notePath,references,resolvePath,resolveAtom,type SourcePath} from './note-references';
import {metadata as noteMetadata,readProperties,writeProperties} from './note-metadata';
import {unzip,zip,strToU8} from 'fflate';
import {parseDocument,stringify} from 'yaml';
import {makeAtom,makeLink,validateAtom,type Atom,type Mutation,type StorageAdapter} from './model';
import type {Core} from './core';

export interface VaultFile {path:string;bytes:Uint8Array}
const LIMIT=512*1024*1024,CHUNK=3*1024*1024;
interface GraphFile {format:'phosphored-vault';version:1;notes:{path:string;atom:Omit<Atom,'content'>}[];links:{from:string;to:string;relation:string;source:string}[]}
function graphFile(bytes:Uint8Array):GraphFile|undefined{try{const value=JSON.parse(new TextDecoder().decode(bytes));if(value.format!=='phosphored-vault'||value.version!==1||!Array.isArray(value.notes)||!Array.isArray(value.links))return;for(const n of value.notes){safePath(n.path);validateAtom({...n.atom,content:''});}return value;}catch{return;}}
export function safePath(path:string){if(!path||path.startsWith('/')||path.includes('\\')||path.includes('\0')||/^[a-z]:/i.test(path)||path.split('/').some(p=>p==='..'||p==='.'))throw Error('Недопустимый путь в хранилище: '+path);return path;}
export async function readVaultFiles(files:File[]):Promise<VaultFile[]>{
 if(files.reduce((n,f)=>n+f.size,0)>LIMIT)throw Error('Хранилище превышает 512 МБ. Импорт не выполнен.');
 if(files.length===1&&/\.zip$/i.test(files[0].name)){const bytes=new Uint8Array(await files[0].arrayBuffer());return new Promise((resolve,reject)=>{let total=0,problem='';const names=new Set<string>();unzip(bytes,{filter:f=>{total+=f.originalSize;try{safePath(f.name);}catch(e){problem=(e as Error).message;}if(names.has(f.name))problem='В архиве повторяется путь '+f.name;names.add(f.name);if(names.size>30000)problem='В архиве больше 30 000 файлов.';return !problem&&total<=LIMIT;}},(error,result)=>{if(error)return reject(error);if(problem)return reject(Error(problem));if(total>LIMIT)return reject(Error('Распакованное хранилище превышает 512 МБ.'));resolve(Object.entries(result).map(([path,bytes])=>({path,bytes})));});});}
 return Promise.all(files.map(async f=>({path:safePath(f.webkitRelativePath?f.webkitRelativePath.split('/').slice(1).join('/'):f.name),bytes:new Uint8Array(await f.arrayBuffer())})));
}
export function splitNote(text:string){const match=/^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n(?:---|\.\.\.)\r?\n|\r?\n(?:---|\.\.\.)$)/.exec(text);return match?{header:match[0],yaml:match[2],body:text.slice(match[0].length)}:{header:'',yaml:'',body:text};}
function aliasesOf(yaml:string):string[]{try{const value=parseDocument(yaml,{logLevel:'silent'}).toJS({maxAliasCount:100})?.aliases;return (Array.isArray(value)?value:typeof value==='string'?[value]:[]).filter((v:unknown):v is string=>typeof v==='string'&&v.length<=500).slice(0,100);}catch{return[];}}
function relocateWiki(text:string,source:string,paths:string[],prefix:string){const note=splitNote(text);return note.header+note.body.replace(/(^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\2[ \t]*$|`+[^`]*`+)|(!?\[\[)([^\]\n]+)(\]\])/gm,(raw,code,_fence,open,body,close)=>{if(code)return raw;const target=body.split(/[|#]/)[0];const path=resolvePath(target,source,paths);return path?open+prefix+path.replace(/\.md$/i,'')+body.slice(target.length)+close:raw;});}
function base64(bytes:Uint8Array){let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);}
export async function cacheVaultFiles(storage:StorageAdapter,id:string,files:VaultFile[],atoms:Atom[]):Promise<Mutation[]>{
 const vaults=await listVaults(storage),vault=vaults.find(v=>v.id===id);if(!vault)throw Error('Источник не найден.');const previous=new Map(vault.files.map(f=>[f.path,f])),notes=new Map(atoms.filter(a=>notePath(a)?.vault===id).map(a=>[notePath(a)!.path,a.id]));const ops:Mutation[]=[],stored:StoredFile[]=[];
 for(const file of files){safePath(file.path);const old=previous.get(file.path),bytes=old?await storedBytes(storage,old):undefined;if(old&&bytes?.length===file.bytes.length&&bytes.every((value,i)=>value===file.bytes[i])){stored.push({...old,note:notes.get(file.path)});continue;}const entry:StoredFile={path:file.path,key:old?.key||'vault-file:'+crypto.randomUUID(),chunks:Math.ceil(file.bytes.length/CHUNK),note:notes.get(file.path)};for(let i=0;i<entry.chunks;i++)ops.push({kind:'setting',key:entry.key+':'+i,value:base64(file.bytes.subarray(i*CHUNK,(i+1)*CHUNK))});stored.push(entry);}
 vault.files=stored;ops.push({kind:'setting',key:'vaults',value:vaults});return ops;
}
export async function importVault(core:Core,files:VaultFile[],name:string){
 if(files.length>30000||files.reduce((n,f)=>n+f.bytes.length,0)>LIMIT)throw Error('Хранилище слишком большое: максимум 30 000 файлов и 512 МБ.');
 const paths=new Set<string>();for(const f of files){safePath(f.path);if(paths.has(f.path))throw Error('Повторяется путь '+f.path);paths.add(f.path);}
 const vault:Vault={id:crypto.randomUUID(),name:name||'Хранилище',files:[]};const atoms:Atom[]=[],ops:Mutation[]=[];
 const metadata=files.filter(f=>/^\.phosphored\/graph(?:-\d+)?\.json$/.test(f.path)).map(f=>graphFile(f.bytes)).find(Boolean);
 const previous=new Map(metadata?.notes.map(n=>[n.path,n.atom]));
 for(const [index,file] of files.entries()){
  const stored:StoredFile={path:file.path,key:'vault-file:'+crypto.randomUUID(),chunks:Math.ceil(file.bytes.length/CHUNK)};
  if(/\.md$/i.test(file.path)){let text:string;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(file.bytes);}catch{throw Error(file.path+': Markdown должен быть в UTF-8. Исходные данные не изменены.');}const note=splitNote(text),properties=readProperties(note.yaml),prior={...previous.get(file.path),...noteMetadata(properties)};const a=makeAtom({title:file.path.split('/').at(-1)!.replace(/\.md$/i,''),x:Math.cos(index*2.39996)*170*Math.sqrt(index),y:Math.sin(index*2.39996)*170*Math.sqrt(index),...prior,id:prior.id||crypto.randomUUID(),content:note.body,aliases:aliasesOf(note.yaml),properties:{...prior?.properties,obsidian:properties,tags:properties.tags??[],vault:{vault:vault.id,path:file.path}}});if(core.data.atoms.some(existing=>existing.id===a.id))throw Error('Этот Phosphorea ID уже есть в хранилище: '+a.title);stored.note=a.id;atoms.push(a);ops.push({kind:'atom',atom:a});}
  for(let i=0;i<stored.chunks;i++)ops.push({kind:'setting',key:stored.key+':'+i,value:base64(file.bytes.subarray(i*CHUNK,(i+1)*CHUNK))});vault.files.push(stored);
 }
 for(const a of atoms){const properties=a.properties.obsidian as Record<string,any>;for(const link of Array.isArray(properties.phosphored_links)?properties.phosphored_links:[]){if(atoms.some(b=>b.id===link.to)&&link.to!==a.id)ops.push({kind:'link',link:makeLink(a.id,link.to,link.relation||'related',link.source||'markdown')});}}
 const ids=new Map(atoms.map(a=>[notePath(a)!.path,a.id]));for(const link of metadata?.links||[]){const from=ids.get(link.from),to=ids.get(link.to);if(from&&to&&from!==to)ops.push({kind:'link',link:makeLink(from,to,link.relation,link.source)});}
 for(const a of atoms){const seen=new Set(ops.flatMap(op=>op.kind==='link'&&op.link.from===a.id?[op.link.to]:[]));for(const ref of references(a.content)){const b=resolveAtom(ref,a,atoms);if(b&&b.id!==a.id&&!seen.has(b.id)){seen.add(b.id);ops.push({kind:'link',link:makeLink(a.id,b.id,'related','markdown')});}}}
 ops.push({kind:'setting',key:'vaults',value:[...await listVaults(core.storage),vault]});await core.commit(ops);return{notes:atoms.length,files:files.length,vault:vault.id};
}
export function exportedNote(a:Atom,original?:Uint8Array,links:import('./model').Link[]=[]){const text=original?new TextDecoder('utf-8',{ignoreBOM:true}).decode(original):'';const split=splitNote(text);let header=writeProperties(a,links,split.yaml,notePath(a)?.path||a.title+'.md');if(text.includes('\r\n'))header=header.replace(/\n/g,'\r\n');return strToU8((text.startsWith('\uFEFF')?'\uFEFF':'')+header+a.content);}
export async function exportVault(core:Core,id?:string):Promise<Uint8Array>{
 const vaults=await listVaults(core.storage),selected=id?vaults.filter(v=>v.id===id):vaults;const files:Record<string,Uint8Array>=Object.create(null);const paths=new Map<string,string>();const byId=new Map(core.data.atoms.map(a=>[a.id,a]));
 for(const v of selected)for(const f of v.files){const prefix=selected.length>1?v.name.replace(/[\\/:*?"<>|]/g,'_')+'-'+v.id.slice(0,8)+'/':'';const path=prefix+f.path;if(f.note&&!byId.has(f.note))continue;const bytes=await storedBytes(core.storage,f);if(f.note){const a=byId.get(f.note)!;const exported=exportedNote(a,bytes,core.data.links);files[path]=prefix?strToU8(relocateWiki(new TextDecoder('utf-8',{ignoreBOM:true}).decode(exported),f.path,v.files.map(f=>f.path),prefix)):exported;paths.set(a.id,path);}else files[path]=bytes;}
 for(const a of core.data.atoms){if(paths.has(a.id)||notePath(a)&&id&&notePath(a)!.vault!==id)continue;let name=a.title.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_')||'Заметка',path=name+'.md',suffix=1;while(files[path])path=name+' '+(++suffix)+'.md';files[path]=exportedNote(a,undefined,core.data.links);paths.set(a.id,path);}
 // Graph-only relations become ordinary wiki links; existing note text stays intact.
 for(const a of core.data.atoms){const path=paths.get(a.id);if(!path)continue;const existing=new Set(references(a.content).map(ref=>resolveAtom(ref,a,core.data.atoms)?.id));const extra=core.data.links.filter(l=>l.from===a.id&&paths.has(l.to)&&!existing.has(l.to));if(extra.length){const links=[...new Set(extra.map(l=>paths.get(l.to)!))].map(p=>'[['+p.replace(/\.md$/i,'')+']]');files[path]=strToU8(new TextDecoder('utf-8',{ignoreBOM:true}).decode(files[path])+'\n\n'+links.join('\n')+'\n');}}
 const graph:GraphFile={format:'phosphored-vault',version:1,notes:core.data.atoms.filter(a=>paths.has(a.id)).map(({content,...atom})=>({path:paths.get(atom.id)!,atom})),links:core.data.links.filter(l=>paths.has(l.from)&&paths.has(l.to)).map(l=>({from:paths.get(l.from)!,to:paths.get(l.to)!,relation:l.relation,source:l.source}))};
 let metadataPath='.phosphored/graph.json',suffix=0;while(files[metadataPath]&&!graphFile(files[metadataPath]))metadataPath=`.phosphored/graph-${++suffix}.json`;files[metadataPath]=strToU8(JSON.stringify(graph));
 return new Promise((resolve,reject)=>zip(files,{level:6},(e,data)=>e?reject(e):resolve(data)));
}
