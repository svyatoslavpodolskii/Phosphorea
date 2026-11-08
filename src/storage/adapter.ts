import {trackSave} from './status';
import type {StorageAdapter,Mutation,Snapshot} from '../core/model';
import type {WorkspaceCatalog} from './workspaces';
export class SQLiteAdapter implements StorageAdapter {
 private worker:Worker;private stopped=false;
 private pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void}>();
 private seq=0;
 private release?:()=>void;
 constructor(){this.worker=new Worker(new URL('./sqlite.worker.ts',import.meta.url),{type:'module'});this.worker.onmessage=({data})=>{const p=this.pending.get(data.id);if(!p)return;this.pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);};this.worker.onerror=()=>{for(const p of this.pending.values())p.reject(Error('Worker хранилища остановлен. Перезапустите приложение; база не удалена.'));this.pending.clear();this.stopped=true;};}
 private call<T>(method:string,...args:any[]):Promise<T>{return new Promise((resolve,reject)=>{if(this.stopped){reject(Error('Storage worker is closed'));return;}const id=++this.seq;this.pending.set(id,{resolve,reject});try{this.worker.postMessage({id,method,args:args.map(arg=>arg instanceof Uint8Array?arg:JSON.parse(JSON.stringify(arg??null)))});}catch(e){this.pending.delete(id);reject(e);}});}
 async open(requested?:string){
 if(!navigator.storage?.getDirectory)throw Error('Этот браузер не поддерживает OPFS. Откройте приложение в современном браузере по HTTPS или localhost.');
 if(!navigator.locks)throw Error('Браузер не поддерживает безопасную блокировку базы.');
 await new Promise<void>((resolve,reject)=>{navigator.locks.request('phosphored-database',{ifAvailable:true},async lock=>{if(!lock){reject(Error('Карта уже открыта в другой вкладке. Закройте её и повторите запуск.'));return;}await new Promise<void>(release=>{this.release=release;resolve();});}).catch(reject);});
 try{await this.call('open',requested||new URLSearchParams(location.search).get('workspace')||undefined);}catch(e){this.close();throw e;}
 }
 snapshot(){return this.call<Snapshot>('snapshot');}
 syncExport(){return this.call<import('../sync/records').SyncRecord[]>('syncExport');}
 syncApply(records:unknown){return trackSave(()=>this.call<{received:number;conflicts:number}>('syncApply',records));}
 syncConflicts(){return this.call<import('../sync/records').SyncRecord[]>('syncConflicts');}
 syncResolve(key:string,expected:string,choice:string){return trackSave(()=>this.call<void>('syncResolve',key,expected,choice));}
 transaction(ops:Mutation[]){return trackSave(()=>this.call<void>('transaction',ops));}
 getSetting<T>(key:string){return this.call<T|undefined>('getSetting',key);}
 restoreDatabase(bytes:Uint8Array){return trackSave(()=>this.call<void>('restoreDatabase',bytes));}
 exportDatabase(){return this.call<Uint8Array>('exportDatabase');}
 workspaces(){return this.call<WorkspaceCatalog>('workspaces');}
 createWorkspace(name:string){return this.call<WorkspaceCatalog>('createWorkspace',name);}
 renameWorkspace(id:string,name:string){return this.call<WorkspaceCatalog>('renameWorkspace',id,name);}
 deleteWorkspace(id:string){return trackSave(()=>this.call<WorkspaceCatalog>('deleteWorkspace',id));}
 selectWorkspace(id:string){return this.call<WorkspaceCatalog>('selectWorkspace',id);}
 close(){this.stopped=true;this.worker.terminate();this.release?.();for(const p of this.pending.values())p.reject(Error('Хранилище закрыто.'));this.pending.clear();}
}
