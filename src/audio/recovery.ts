import type {Core} from '../core/core';
import {attachments,ATTACHMENTS} from '../core/attachments';
/** A microphone take is staged durably before touching its owning note. */
export async function recoverRecordings(core:Core){
 try{
 const entries=await core.storage.getSetting<{note:string;properties:Record<string,unknown>}[]>('recording-recovery')||[];
 for(const entry of entries){const files=attachments(entry);if(!files.length)continue;const note=core.data.atoms.find(a=>a.id===entry.note),recovered=core.data.atoms.find(a=>a.id===files[0].id);if(recovered)continue;
  let attached=false;if(note){const current=attachments(note),missing=files.filter(a=>!current.some(b=>b.id===a.id));if(!missing.length)attached=true;else try{await core.update(note.id,{properties:{...note.properties,[ATTACHMENTS]:[...current,...missing]}});attached=true;}catch{ /* Preserve the take separately if the owning note cannot accept it. */ }}
  if(!attached)await core.create({id:files[0].id,title:'Восстановленная аудиозапись',properties:{[ATTACHMENTS]:files}});
 }
 if(entries.length)await core.storage.transaction([{kind:'setting',key:'recording-recovery',value:[]}]);
 }catch(error){console.warn('Recording recovery deferred',error);core.emit('media:error',{message:'Не удалось восстановить запись. Она сохранена в базе; попробуйте освободить место и открыть приложение снова.'});}
}
