import {validateSetting,sharedSetting} from './profile';
import {validateAtom,validateLink,type Atom,type Link} from '../core/model';
import {NOTE_TYPES_KEY,noteTypes} from '../core/note-types';
export type Kind='atom'|'link'|'catalog'|'setting';
export interface Head {id:string;clock:Record<string,number>;value:Atom|Link|unknown[]|Record<string,unknown>|string|number|boolean|null;at:string;device:string}
export interface SyncRecord {kind:Kind;id:string;heads:Head[]}
export const RECORD_PREFIX='sync:record:';
export const key=(r:Pick<SyncRecord,'kind'|'id'>)=>RECORD_PREFIX+r.kind+':'+r.id;
export function canonical(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
 return JSON.stringify(value);
}
export function semantic(value:Head['value']){if(value&&typeof value==='object'&&!Array.isArray(value)&&'created_at' in value&&'content' in value&&'title' in value){const {revision,updated_at,...rest}=value as Atom;return canonical(rest);}return canonical(value);}
export function dominates(a:Head,b:Head){const keys=new Set([...Object.keys(a.clock),...Object.keys(b.clock)]);let greater=false;for(const k of keys){if((a.clock[k]||0)<(b.clock[k]||0))return false;if((a.clock[k]||0)>(b.clock[k]||0))greater=true;}return greater;}
export function unionClock(heads:Head[]){const result:Record<string,number>=Object.create(null);for(const h of heads)for(const [k,n] of Object.entries(h.clock))result[k]=Math.max(result[k]||0,n);return result;}
export function mergeHeads(heads:Head[]):Head[]{
 // Never use wall-clock time or a revision number to discard an offline edit.
 let unique=[...new Map(heads.map(h=>[canonical(h),structuredClone(h)])).values()];
 unique=unique.filter((h,i)=>!unique.some((other,j)=>i!==j&&dominates(other,h)));
 const result=unique.sort((a,b)=>a.id.localeCompare(b.id));
 if(result.length>16)throw Error('У заметки слишком много неразобранных версий. Сначала выберите нужные.');
 return result;
}
export function hasConflict(r:SyncRecord){return new Set(r.heads.map(h=>semantic(h.value))).size>1;}
export function validateRecord(input:unknown):asserts input is SyncRecord{
 const r=input as SyncRecord;
 if(r?.kind==='setting'&&!sharedSetting(r.id))throw Error('Настройка не разрешена для синхронизации.');
 if(!r||!['atom','link','catalog','setting'].includes(r.kind)||typeof r.id!=='string'||!r.id||r.id.length>500||r.kind==='catalog'&&r.id!==NOTE_TYPES_KEY||!Array.isArray(r.heads)||!r.heads.length||r.heads.length>16)throw Error('Некорректная запись синхронизации.');
 for(const h of r.heads){
  if(!h||typeof h.id!=='string'||!/^[a-f0-9-]{36}$/.test(h.id)||typeof h.device!=='string'||h.device.length>80||!Number.isFinite(Date.parse(h.at))||!h.clock||Array.isArray(h.clock)||typeof h.clock!=='object'||Object.keys(h.clock).length>4096||!Object.keys(h.clock).length)throw Error('Некорректная история изменений.');
  for(const [actor,n] of Object.entries(h.clock))if(!/^[a-f0-9-]{36}$/.test(actor)||!Number.isSafeInteger(n)||n<1)throw Error('Некорректный счётчик изменений.');
  if(h.value===null)continue;
  if(r.kind==='atom'){validateAtom(h.value as Atom);if((h.value as Atom).id!==r.id)throw Error('ID заметки не совпадает.');}
  if(r.kind==='link'){validateLink(h.value as Link);if((h.value as Link).id!==r.id)throw Error('ID связи не совпадает.');}
  if(r.kind==='catalog')noteTypes(h.value);if(r.kind==='setting')validateSetting(r.id,h.value);
 }
}
