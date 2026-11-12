import type {SyncRecord} from './records';
export interface SyncWorkspace {id:string;name:string;scope:string;hasData:boolean}
export interface WorkspaceTransfer {id:string;name:string;scope:string;records:SyncRecord[];attachments?:import('../core/attachments').AttachmentPayload[]}
/** Only authenticated, explicitly approved manifests may reach storage. */
export function validateWorkspaces(value:unknown):asserts value is SyncWorkspace[]{
 if(!Array.isArray(value)||value.length>100)throw Error('Некорректный список хранилищ.');
 const ids=new Set<string>(),scopes=new Set<string>();
 for(const w of value){if(!w||typeof w.id!=='string'||w.id.length>80||typeof w.name!=='string'||!w.name.trim()||w.name.length>80||typeof w.scope!=='string'||!/^[a-f0-9-]{36}$/.test(w.scope)||typeof w.hasData!=='boolean'||ids.has(w.id)||scopes.has(w.scope))throw Error('Некорректное хранилище.');ids.add(w.id);scopes.add(w.scope);}
}
