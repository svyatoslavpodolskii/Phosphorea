<script lang="ts">
 import {bindings,connectVault,syncVault,directSupported} from '../storage/direct-vault';
 import {onMount} from 'svelte';
 import type {Core} from '../core/core';
 import {readVaultFiles,importVault,exportVault,listVaults,type VaultFile,type Vault} from '../core/vault';
 import {download} from '../core/backup';
 let connected=$state<Awaited<ReturnType<typeof bindings>>>([]);
 let {core}:{core:Core}=$props();let files=$state.raw<VaultFile[]|null>(null);let name=$state('');let busy=$state(false);let message=$state('');let error=$state('');let vaults=$state<Vault[]>([]);let selected=$state('');
 onMount(()=>{bindings(core).then(v=>connected=v).catch(e=>error=e.message);listVaults(core.storage).then(v=>vaults=v).catch(e=>error=e.message);});
 async function run(fn:()=>Promise<void>){busy=true;error='';try{await fn();}catch(e){error=(e as Error).message;}finally{busy=false;}}
 async function pick(e:Event){const input=e.currentTarget as HTMLInputElement;const picked=Array.from(input.files||[]);input.value='';if(!picked.length)return;await run(async()=>{files=await readVaultFiles(picked);name=picked[0].webkitRelativePath?.split('/')[0]||picked[0].name.replace(/\.zip$/i,'');message='';});}
</script>
<section><small>MARKDOWN · OBSIDIAN</small><p>Перенесите хранилище целиком: заметки, подпапки и вложения. Экспортированный ZIP распакуйте и откройте как хранилище в Obsidian.</p><div class="button-wrap"><label class="file-button">Выбрать папку<input aria-label="Папка Obsidian" type="file" webkitdirectory multiple disabled={busy} onchange={pick}/></label><label class="file-button">Выбрать ZIP<input aria-label="ZIP Obsidian" type="file" accept=".zip" disabled={busy} onchange={pick}/></label></div>
 {#if files}<div class="confirm"><p>{files.filter(f=>/\.md$/i.test(f.path)).length} заметок · {files.length} файлов. Файлы будут добавлены в текущее хранилище. Существующие записи сохранятся.</p><button class="primary" disabled={busy} onclick={()=>run(async()=>{const result=await importVault(core,files!,name);files=null;vaults=await listVaults(core.storage);message=`Добавлено ${result.notes} заметок. Все ${result.files} файлов сохранены на устройстве.`;})}>Импортировать хранилище</button><button disabled={busy} onclick={()=>files=null}>Отмена</button></div>{/if}
 <div class="button-wrap">{#if vaults.length}<select aria-label="Источник для экспорта" bind:value={selected}><option value="">Всё хранилище</option>{#each vaults as v}<option value={v.id}>{v.name}</option>{/each}</select>{/if}<button disabled={busy} onclick={()=>run(async()=>download('Phosphorea-vault.zip',await exportVault(core,selected||undefined),'application/zip'))}>Экспорт Markdown</button></div>
 {#if directSupported()}<div class="button-wrap"><button disabled={busy} onclick={()=>run(async()=>{await connectVault(core);connected=await bindings(core);vaults=await listVaults(core.storage);message='Папка подключена. Синхронизация читает изменения Obsidian и записывает ваши правки.';})}>Подключить Obsidian Vault</button>{#each connected as binding}<button disabled={busy} onclick={()=>run(async()=>{const result=await syncVault(core,binding.vault);message=`${binding.name}: записано ${result.written}, прочитано ${result.read}.`;})}>Синхронизировать · {binding.name}</button>{/each}</div>{/if}
 {#if busy}<p role="status">Обрабатываем файлы…</p>{/if}{#if message}<p role="status">{message}</p>{/if}{#if error}<p role="alert" class="inline-error">{error}</p>{/if}
</section>
