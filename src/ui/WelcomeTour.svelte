<script lang="ts">
 import {surface} from './surfaces';
 import type {Preferences} from '../core/preferences';
 import type {AtomType} from '../plugins/api';
 let {onclose,prefs,types}:{onclose:()=>void;prefs:Preferences;types:AtomType[]}=$props();
 let started=$state(false);const loadPractice=()=>import('./Practice.svelte');
</script>
<div class="tour-layer" use:surface={{close:onclose}} role="dialog" aria-modal="true" aria-label={started?'Интерактивное обучение':'Знакомство с Phosphoreya'} tabindex="-1">
 {#if started}{#await loadPractice()}<div class="tour-card"><p>Готовим учебную карту…</p><button onclick={onclose}>Закрыть</button></div>{:then m}<m.default {prefs} {types} {onclose}/>{:catch error}<div class="tour-card"><p role="alert">{error.message}</p><button onclick={onclose}>Закрыть</button></div>{/await}
 {:else}<div class="tour-card"><small>ОТ ПЕРВОЙ МЫСЛИ К СВОЕЙ КАРТЕ</small><h2>Попробуем вместе?</h2><p>Создайте мысль, соедините её с другой, обведите лассо и найдите через поиск. Всё — своими руками.</p><p class="tour-note">Учебная карта отдельная: ваши записи и настройки останутся на месте. Любой шаг можно пропустить.</p><div class="tour-actions"><button onclick={onclose}>Не сейчас</button><button class="tour-next" onclick={()=>started=true}>Попробовать</button></div><span>Около двух минут. Можно повторить в настройках.</span></div>{/if}
</div>
<style>
 .tour-layer{position:fixed;inset:0;z-index:120;isolation:isolate;background:color-mix(in srgb,var(--theme-background),transparent 15%);display:grid;place-items:center}
 .tour-card{width:min(440px,calc(100% - 32px));padding:28px;border:1px solid var(--theme-border);border-radius:28px;background:var(--theme-surface);box-shadow:0 12px 50px #0002}.tour-card small{font-size:10px;letter-spacing:.12em;color:var(--theme-muted)}.tour-card h2{font-size:29px;line-height:1.15;letter-spacing:-.7px;margin:18px 0}.tour-card p{font-size:14px;line-height:1.65;margin:0 0 16px;color:var(--theme-text)}.tour-card .tour-note{font-size:12px;color:var(--theme-muted)}.tour-actions{display:flex;gap:12px;margin-top:24px}.tour-actions button{flex:1;border:0;background:var(--theme-surfaceAlt)}.tour-actions .tour-next{background:var(--theme-accent);color:var(--theme-onAccent)}.tour-card>span{display:block;margin-top:18px;text-align:center;color:var(--theme-muted);font-size:10px}
 @media(max-height:550px){.tour-card{padding:20px;max-height:90dvh;overflow:auto}}
</style>
