import {safelyCollectAttachments,databaseAttachments} from './attachments';
import {attachmentReferences,ASSET_INDEX,sameAttachment,referencedAttachments,validatePayload,payloadOps} from '../core/attachments';
import {sharedSetting,profileSetting,visualSetting,APPEARANCE,pluginSyncMode,acceptsPluginSetting} from '../sync/profile';
import {restoreDatabase} from './restore';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import {migrate} from './schema';
import {snapshot,transact,transactWithRetry} from './operations';
import {exportRecords,applyRecords,conflicts,resolveConflict,initializeActor} from '../sync/storage';
import {identity} from '../sync/crypto';
import {catalog,changeWorkspace,removeWorkspace,EXCLUDED_SCOPES} from './workspaces';
import {validateWorkspaces,type SyncWorkspace,type WorkspaceTransfer} from '../sync/workspaces';
import {validateRecord} from '../sync/records';
const workspaceDbs=new Map<string,any>();
function setting(target:any,key:string,value?:unknown){if(arguments.length===3){target.exec({sql:'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',bind:[key,JSON.stringify(value)]});return value;}const raw=target.selectValue('SELECT value FROM settings WHERE key=?',[key]);return raw===undefined?undefined:JSON.parse(raw);}
async function workspaceDb(id:string){
 if(id==='default')return rootDb;
 if(!catalog(rootDb).items.some(w=>w.id===id)||!/^[a-f0-9-]{36}$/.test(id))throw Error('Хранилище не найдено.');
 if(workspaceDbs.has(id))return workspaceDbs.get(id);
 const pool=await sqlite.installOpfsSAHPoolVfs({name:'phosphored-opfs-'+id,directory:'.phosphored-'+id,initialCapacity:4});
 const target=new pool.OpfsSAHPoolDb('/phosphored.sqlite3');try{migrate(target);initializeActor(target,(await identity()).id);workspaceDbs.set(id,target);return target;}catch(e){target.close();throw e;}
}
async function syncWorkspaces():Promise<SyncWorkspace[]>{const result:SyncWorkspace[]=[];for(const w of catalog(rootDb).items){const target=await workspaceDb(w.id),scope=setting(target,'sync:scope-id')||setting(target,'sync:scope-id',crypto.randomUUID());result.push({...w,scope,hasData:Number(target.selectValue('SELECT count(*) FROM atoms'))>0||exportRecords(target).some(r=>r.heads.some(h=>h.value!==null))});}return result;}
async function syncApplyWorkspaces(transfers:WorkspaceTransfer[],approved:SyncWorkspace[],mapping:Record<string,string>){
 validateWorkspaces(approved);if(!Array.isArray(transfers)||transfers.length!==approved.length)throw Error('Список передачи не совпадает с разрешением.');
 const seen=new Set<string>();for(const w of transfers){const permission=approved.find(p=>p.scope===w.scope);if(!permission||permission.id!==w.id||permission.name!==w.name||seen.has(w.scope)||!Array.isArray(w.records)||w.records.length>200000)throw Error('Передача хранилища не разрешена.');seen.add(w.scope);for(const r of w.records)validateRecord(r);const references=attachmentReferences(w.records),refs=new Set(references.keys()),payloads=w.attachments||[];if(!Array.isArray(payloads)||payloads.length>2000||new Set(payloads.map(p=>p.meta.id)).size!==payloads.length)throw Error('Invalid attachments');for(const payload of payloads){if(!refs.has(payload.meta.id))throw Error('Unreferenced attachment');sameAttachment(references.get(payload.meta.id),payload.meta);await validatePayload(payload);}if([...refs].some(id=>!payloads.some(p=>p.meta.id===id)))throw Error('Обновите приложение на обоих устройствах: отсутствуют вложения.');}
 const local=await syncWorkspaces();let count=0;const next={...mapping};
 for(const w of transfers){let id:string|undefined=next[w.scope];if((setting(rootDb,EXCLUDED_SCOPES)||[]).includes(w.scope)){delete next[w.scope];continue;}if(id&&!local.some(p=>p.id===id&&p.scope===w.scope)){delete next[w.scope];id=undefined;}id ||= local.find(p=>p.scope===w.scope)?.id;
  if(!id){let name=w.name,index=1;while(catalog(rootDb).items.some(p=>p.name.toLocaleLowerCase()===name.toLocaleLowerCase()))name=w.name.slice(0,65)+' · '+(++index);const list=changeWorkspace(rootDb,'create',name);id=list.items.at(-1)!.id;setting(await workspaceDb(id),'sync:scope-id',w.scope);}
  const target=await workspaceDb(id),payloads=w.attachments||[],assetIds=JSON.parse(target.selectValue('SELECT value FROM settings WHERE key=?',[ASSET_INDEX])||'[]');for(const payload of payloads){const raw=target.selectValue('SELECT value FROM settings WHERE key=?',['note-asset:'+payload.meta.id+':meta']);sameAttachment(raw?JSON.parse(raw):undefined,payload.meta);}const extra=[...payloads.flatMap(payloadOps),...(payloads.length?[{kind:'setting' as const,key:ASSET_INDEX,value:[...new Set([...assetIds,...payloads.map(p=>p.meta.id)])]}]:[])];const result=applyRecords(target,w.records.filter(r=>r.kind!=='setting'&&r.kind!=='catalog'),transact,extra);safelyCollectAttachments(target);setting(target,'structural-layout-v2',true);count+=result.conflicts;next[w.scope]=id;
 }
 return{conflicts:count,mapping:next};
}
let db:any;let sqlite:any;let rootDb:any;let rootPool:any;let restored=false;
async function open(requested?:string) {
 if(db)return;
 sqlite=await sqlite3InitModule();
 const pool=await sqlite.installOpfsSAHPoolVfs({name:'phosphored-opfs',directory:'.phosphored',initialCapacity:8});
 rootPool=pool;const candidate=new pool.OpfsSAHPoolDb('/phosphored.sqlite3');
 try {migrate(candidate);rootDb=candidate;await cleanupDeleted();const list=catalog(rootDb);const current=requested||list.current;if(!list.items.some(w=>w.id===current))throw Error('Хранилище не найдено.');if(current==='default'){db=rootDb;}else{if(!/^[a-f0-9-]{36}$/.test(current))throw Error('Некорректный идентификатор хранилища.');const space=await sqlite.installOpfsSAHPoolVfs({name:'phosphored-opfs-'+current,directory:'.phosphored-'+current,initialCapacity:4});const target=new space.OpfsSAHPoolDb('/phosphored.sqlite3');try{migrate(target);db=target;workspaceDbs.set(current,target);}catch(e){target.close();throw e;}}const device=await identity().catch(()=>undefined);if(device){initializeActor(rootDb,device.id);if(db!==rootDb)initializeActor(db,device.id);}if(!setting(rootDb,'sync:profile-ready')){const ops=rootDb===db?[]:db.selectObjects('SELECT key,value FROM settings').filter((r:any)=>profileSetting(r.key)).map((r:any)=>({kind:'setting',key:r.key,value:JSON.parse(r.value)}));if(ops.length)transact(rootDb,ops);const pref=setting(rootDb,'preferences');if(pref)transact(rootDb,[{kind:'setting',key:APPEARANCE,value:{theme:pref.theme,customThemes:pref.customThemes||[]}}]);setting(rootDb,'sync:profile-ready',true);}safelyCollectAttachments(db);if(requested)changeWorkspace(rootDb,'select',current);} catch(e){candidate.close();throw e;}
}
async function cleanupDeleted(){
 const pending=JSON.parse(rootDb.selectValue("SELECT value FROM settings WHERE key='workspace-deletions'")||'[]') as string[];const remaining:string[]=[];
 for(const id of pending){if(!/^[a-f0-9-]{36}$/.test(id))continue;try{const pool=await sqlite.installOpfsSAHPoolVfs({name:'phosphored-opfs-'+id,directory:'.phosphored-'+id,initialCapacity:0});pool.unlink('/phosphored.sqlite3');if(!await pool.removeVfs())throw Error('Workspace pool is still in use');}catch(e){remaining.push(id);console.warn('Workspace cleanup deferred',e);}}
 if(pending.length)rootDb.exec({sql:'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',bind:['workspace-deletions',JSON.stringify(remaining)]});
}
let queue=Promise.resolve();
self.onmessage=({data:{id,method,args}})=>{queue=queue.then(async()=>{
 try {
 let result:any;
 if(method==='open')await open(args[0]);
 else {if(restored)throw Error('Reload required after restore');if(!db)throw Error('База не открыта.');
 if(method==='snapshot')result=snapshot(db);
 else if(method==='syncExportProfile')result=exportRecords(rootDb).filter(r=>r.kind==='setting');
 else if(method==='syncApplyProfile'){if(!Array.isArray(args[0])||args[0].some((r:any)=>r.kind!=='setting'))throw Error('Invalid profile');for(const r of args[0])validateRecord(r);const mode=pluginSyncMode(setting(rootDb,'sync:plugins')),installed=new Set<string>((setting(rootDb,'community-plugins')||[]).map((p:any)=>p.manifest.id));result=applyRecords(rootDb,args[0].filter((r:any)=>(args[1]||!visualSetting(r.id))&&acceptsPluginSetting(r.id,mode,installed)),transact);}
 else if(method==='syncWorkspaces')result=await syncWorkspaces();
 else if(method==='syncExportWorkspaces'){const all=await syncWorkspaces();if(!Array.isArray(args[0])||args[0].some((id:string)=>!all.some(w=>w.id===id)))throw Error('Хранилище не найдено.');result=[];for(const w of all.filter(w=>args[0].includes(w.id))){const target=await workspaceDb(w.id),records=exportRecords(target).filter(r=>r.kind!=='setting'&&r.kind!=='catalog');result.push({...w,records,attachments:databaseAttachments(target,referencedAttachments(records))});}}
 else if(method==='syncApplyWorkspaces')result=await syncApplyWorkspaces(args[0],args[1],args[2]);
 else if(method==='syncGetGlobal'||method==='syncSetGlobal'){if(typeof args[0]!=='string'||!/^sync:(trusted:|device-name$|visual$|plugins$|excluded-scopes$)/.test(args[0]))throw Error('Неверный ключ устройства.');result=method==='syncGetGlobal'?setting(rootDb,args[0]):setting(rootDb,args[0],args[1]);}
 else if(method==='syncExport')result=exportRecords(db);
 else if(method==='syncApply')result=applyRecords(db,args[0],transact);
 else if(method==='syncConflicts')result=[...conflicts(db).filter(r=>r.kind==='atom'||r.kind==='link'),...conflicts(rootDb).filter(r=>r.kind==='setting')];
 else if(method==='syncResolve')result=resolveConflict(typeof args[0]==='string'&&args[0].startsWith('sync:record:setting:')?rootDb:db,args[0],args[1],args[2],transact);
 else if(method==='workspaces')result=catalog(rootDb);
 else if(method==='createWorkspace')result=changeWorkspace(rootDb,'create',args[0]);
 else if(method==='renameWorkspace')result=changeWorkspace(rootDb,'rename',args[1],args[0]);
 else if(method==='deleteWorkspace'){const cached=workspaceDbs.get(args[0]);if(cached&&cached!==db){cached.close();workspaceDbs.delete(args[0]);}const current=catalog(rootDb).current,deletedScope=setting(await workspaceDb(args[0]),'sync:scope-id');result=removeWorkspace(rootDb,args[0],deletedScope);if(args[0]===current){if(db!==rootDb)db.close();restored=true;}if(args[0]!=='default')await cleanupDeleted();}
 else if(method==='selectWorkspace')result=changeWorkspace(rootDb,'select',args[0]);
 else if(method==='transaction'){const ops=args[0];await transactWithRetry(db,ops);const config=ops.filter((op:any)=>op.kind==='setting'&&profileSetting(op.key));for(const op of [...config])if(op.key==='preferences')config.push({kind:'setting',key:APPEARANCE,value:{theme:op.value.theme,customThemes:op.value.customThemes}});if(config.length)transact(rootDb,config);if(ops.some((op:any)=>op.kind==='atom'||op.kind==='delete'||op.kind==='setting'&&(['backups','last-deletion','recording-recovery'].includes(op.key)||op.key==='editor-checkpoint-v1'&&op.value===null)))safelyCollectAttachments(db);}
 else if(method==='getSetting'){const raw=(profileSetting(args[0])?rootDb:db).selectValue('SELECT value FROM settings WHERE key=?',[args[0]]);result=raw===undefined?undefined:JSON.parse(raw);}
 else if(method==='restoreDatabase'){let staged:any;try{rootPool.importDb('/restore.sqlite3',args[0]);staged=new rootPool.OpfsSAHPoolDb('/restore.sqlite3');restoreDatabase(db,staged);restored=true;}finally{try{staged?.close();rootPool.unlink('/restore.sqlite3');}catch(cleanupError){console.warn('Restore staging cleanup',cleanupError);}}}
 else if(method==='compactDatabase'){safelyCollectAttachments(db);const page=Number(db.selectValue('PRAGMA page_size')),before=Number(db.selectValue('PRAGMA page_count'))*page;db.exec('VACUUM');db.exec('PRAGMA optimize');result={before,after:Number(db.selectValue('PRAGMA page_count'))*page};}
 else if(method==='exportDatabase')result=sqlite.capi.sqlite3_js_db_export(db);
 else throw Error('Неизвестная операция хранилища.');}
 self.postMessage({id,result});
 }catch(e){self.postMessage({id,error:e instanceof Error?e.message:String(e)});}
 });};
