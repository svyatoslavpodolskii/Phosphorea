<script lang="ts">
 import type {Core} from '../core/core';
 import {SQLiteAdapter} from '../storage/adapter';
 import {packStorage,unpackStorage,backupFilename} from '../storage/native-backup';
 import {download} from '../core/backup';
 let {core,busy=$bindable(false)}:{core:Core;busy?:boolean}=$props();
 let error=$state(''),compactMessage=$state('');let pending=$state<Awaited<ReturnType<typeof unpackStorage>>|null>(null);
 async function run(action:()=>Promise<void>){busy=true;error='';try{await action();}catch(e){error=(e as Error).message;}finally{busy=false;}}
 async function save(){const storage=core.storage as SQLiteAdapter;const catalog=await storage.workspaces();const name=catalog.items.find(w=>w.id===catalog.current)?.name||'Хранилище';download(backupFilename(name),await packStorage(await storage.exportDatabase(),name),'application/octet-stream');}
 async function read(e:Event){const input=e.currentTarget as HTMLInputElement;const file=input.files?.[0];input.value='';pending=null;if(!file)return;await run(async()=>{if(file.size>256*1024*1024+100_000)throw Error('Копия превышает 256 МБ.');pending=await unpackStorage(new Uint8Array(await file.arrayBuffer()));});}
</script>
<section><small>ПОЛНАЯ РЕЗЕРВНАЯ КОПИЯ</small><p>Один файл со всеми заметками, связями, вложениями и настройками.</p><div class="button-wrap"><button disabled={busy} onclick={()=>run(save)}>Создать резервную копию</button><label class="file-button">Восстановить из копии<input disabled={busy} type="file" accept=".posphorea,.phosphora,.phosphored" aria-label="Полная резервная копия" onchange={read}/></label></div>
<button class="compact-storage" disabled={busy} onclick={()=>run(async()=>{const result=await (core.storage as SQLiteAdapter).compactDatabase();const freed=Math.max(0,result.before-result.after);compactMessage=freed?`Освобождено ${(freed/1024/1024).toFixed(1)} МБ. Заметки сохранены.`:'База уже компактна.';})}>Освободить место</button>{#if compactMessage}<p role="status">{compactMessage}</p>{/if}
{#if error}<p role="alert" class="inline-error">{error}</p>{/if}
{#if pending}<div class="confirm"><p>Восстановить «{pending.manifest.name}»? Заметки и настройки текущего хранилища будут заменены. Другие хранилища сохранятся.</p><div class="button-wrap"><button disabled={busy} onclick={()=>run(save)}>Сначала сохранить текущую копию</button><button disabled={busy} onclick={()=>run(async()=>{await (core.storage as SQLiteAdapter).restoreDatabase($state.snapshot(pending!).database);location.reload();})}>Восстановить хранилище</button><button disabled={busy} onclick={()=>pending=null}>Отмена</button></div></div>{/if}</section>
