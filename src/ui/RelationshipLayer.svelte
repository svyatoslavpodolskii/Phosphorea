<script lang="ts">
 import {onDestroy} from 'svelte';
 import {transientUndo} from './transient-undo';
 import {makeLink,type Link,type Snapshot} from '../core/model';
 import type {Camera,GraphNode} from '../graph/model';
 import type {EdgeCurves} from '../graph/edge-curve';
 import {linkCurve} from '../graph/relationships';
 let {curves,data,nodes,camera,width,height,selected,paused,activeLink=$bindable(''),interacting=$bindable(false),onchange}:{curves?:EdgeCurves;data:Snapshot;nodes:GraphNode[];camera:Camera;width:number;height:number;selected:string;paused:boolean;activeLink:string;interacting:boolean;onchange:(before:Link|null,after:Link|null)=>Promise<void>}=$props();
 let drag=$state<{pointer:number;fixed:string;side:'from'|'to';original:Link|null;x:number;y:number;target:string}|null>(null),busy=$state(false),error=$state('');
 let captured:HTMLElement|null=null;
 let undo=$state<{before:Link|null;after:Link|null}|null>(null);
 const undoToast=transientUndo<{before:Link|null;after:Link|null}>(value=>undo=value);
 onDestroy(()=>undoToast.dispose());
 const positions=$derived(new Map((selected||activeLink||drag?nodes:[]).filter(n=>!n.members).map(n=>[n.id,n])));
 const link=$derived(data.links.find(l=>l.id===activeLink));
 const source=$derived(positions.get(selected));
 const screen=(p:{x:number;y:number})=>({x:width/2+camera.x+p.x*camera.zoom,y:height/2+camera.y+p.y*camera.zoom});
 const curve=$derived.by(()=>{const a=link&&positions.get(link.from),b=link&&positions.get(link.to);return a&&b?(curves?.get(link!,a,b)??linkCurve(a,b)):null;});
 const path=$derived(curve?`M ${screen({x:curve.ax,y:curve.ay}).x} ${screen({x:curve.ax,y:curve.ay}).y} Q ${screen({x:curve.cx,y:curve.cy}).x} ${screen({x:curve.cx,y:curve.cy}).y} ${screen({x:curve.bx,y:curve.by}).x} ${screen({x:curve.bx,y:curve.by}).y}`:'');
 const fixed=$derived(drag&&positions.get(drag.fixed));
 const rubber=$derived.by(()=>{if(!drag||!fixed)return '';const a=screen(fixed),target=positions.get(drag.target),b=target?screen(target):drag;return `M ${a.x} ${a.y} Q ${(a.x+b.x)/2-8} ${(a.y+b.y)/2+8} ${b.x} ${b.y}`;});
 $effect(()=>{interacting=Boolean(drag)||busy;});
 $effect(()=>{if(paused){drag=null;activeLink='';}if(activeLink&&!link)activeLink='';});
 function begin(e:PointerEvent,fixed:string,side:'from'|'to',original:Link|null){if(busy||e.button!==0)return;e.preventDefault();e.stopPropagation();captured=e.currentTarget as HTMLElement;captured.focus({preventScroll:true});captured.setPointerCapture(e.pointerId);drag={pointer:e.pointerId,fixed,side,original,x:e.clientX,y:e.clientY,target:''};error='';}
 function move(e:PointerEvent){if(!drag||e.pointerId!==drag.pointer)return;e.preventDefault();let target='',best=Infinity;for(const n of positions.values()){if(n.id===drag.fixed)continue;const p=screen(n),d=Math.hypot(e.clientX-p.x,e.clientY-p.y);if(d<=Math.max(24,n.radius*camera.zoom+10)&&d<best){best=d;target=n.id;}}drag={...drag,x:e.clientX,y:e.clientY,target};}
 export async function apply(before:Link|null,after:Link|null){if(busy)return;busy=true;error='';try{await onchange(before,after);undoToast.show({before,after});activeLink=after?.id||'';}catch(e){error=(e as Error).message;}finally{busy=false;}}
 function end(e:PointerEvent){if(!drag||e.pointerId!==drag.pointer)return;move(e);const value=drag;drag=null;e.preventDefault();e.stopPropagation();if(!value?.target)return;const from=value.side==='to'?value.fixed:value.target,to=value.side==='to'?value.target:value.fixed;const after=value.original?{...value.original,from,to}:makeLink(from,to);if(value.original?.from===from&&value.original?.to===to)return;void apply(value.original,after);}
 async function revert(){if(!undo||busy)return;const value=undo;busy=true;error='';try{await onchange(value.after,value.before);activeLink=value.before?.id||'';undoToast.dismiss();}catch(e){error=(e as Error).message;}finally{busy=false;}}
 function cancel(){if(drag&&captured?.hasPointerCapture(drag.pointer))captured.releasePointerCapture(drag.pointer);captured=null;drag=null;}
</script>
<svelte:window onkeydown={e=>{if(e.key==='Escape'&&(drag||activeLink)){e.preventDefault();drag=null;activeLink='';}}} onpointerdown={e=>{if(drag&&e.pointerId!==drag.pointer)cancel();}}/>
{#if !paused}
 <div class="relationship-layer">
 <svg width={width} height={height} aria-hidden="true">{#if path}<path d={path}/>{/if}{#if rubber}<path class="rubber" d={rubber}/>{/if}{#if drag?.target}{@const target=positions.get(drag.target)!}{@const p=screen(target)}<circle cx={p.x} cy={p.y} r={target.radius*camera.zoom+7}/>{/if}</svg>
 {#if source&&!link}{@const p=screen(source)}<button class="link-handle create" style:left={`${p.x+source.radius*camera.zoom+22}px`} style:top={`${p.y}px`} disabled={busy} aria-label="Создать связь" title="Перетяните к другому атому" onpointerdown={e=>begin(e,source.id,'to',null)} onpointermove={move} onpointerup={end} onpointercancel={cancel}>&#8599;</button>{/if}
 {#if link&&curve}
 {#each ['from','to'] as side}{@const p=screen(side==='from'?{x:curve.ax,y:curve.ay}:{x:curve.bx,y:curve.by})}<button class="link-handle endpoint" style:--endpoint-size={`${Math.max(6,Math.min(18,22*camera.zoom))}px`} style:left={`${p.x}px`} style:top={`${p.y}px`} disabled={busy} aria-label={side==='from'?'Переподключить начало связи':'Переподключить конец связи'} title="Перетяните к другому атому" onpointerdown={e=>begin(e,side==='from'?link.to:link.from,side as 'from'|'to',link)} onpointermove={move} onpointerup={end} onpointercancel={cancel}><i></i></button>{/each}
 <div class="link-actions"><span>{link.relation==='related'?'Связь':link.relation}</span><button disabled={busy} onclick={()=>apply(link,null)}>Разорвать</button><button disabled={busy} onclick={()=>activeLink=''} aria-label="Закрыть">&#215;</button></div>
 {/if}
 {#if drag}<div class="link-hint" role="status">Отпустите на атоме для связи</div>{/if}
 </div>
{/if}
{#if undo}<div class="link-undo" role="status"><button disabled={busy} onclick={revert}>Отменить изменение связи</button><button aria-label="Скрыть уведомление" onclick={()=>undoToast.dismiss()}>&#215;</button></div>{/if}
{#if error}<div class="link-error" role="alert">{error}<button onclick={()=>error=''} aria-label="Закрыть">&#215;</button></div>{/if}
<style>
 .relationship-layer{position:absolute;inset:0;pointer-events:none;z-index:3;overflow:hidden}
 .relationship-layer svg{position:absolute;inset:0;overflow:visible;fill:none;stroke:var(--theme-accent);stroke-width:2.5;stroke-linecap:round}
 .rubber{stroke-dasharray:5 5}
 .link-handle{position:absolute;transform:translate(-50%,-50%);width:44px;height:44px;min-height:44px;border-radius:50%;padding:0;pointer-events:auto;touch-action:none;user-select:none;background:var(--theme-surface);color:var(--theme-text);box-shadow:0 3px 14px #0003}
 .endpoint{border:0;background:transparent;box-shadow:none}.endpoint i{display:block;margin:auto;width:var(--endpoint-size);height:var(--endpoint-size);border:1.5px solid var(--theme-accent);border-radius:50%;background:var(--theme-surface)}.create{font-size:22px}
 .link-actions,.link-hint,.link-error,.link-undo{position:absolute;left:50%;transform:translateX(-50%);bottom:130px;border-radius:16px;background:var(--theme-surface);padding:6px;pointer-events:auto;box-shadow:0 4px 20px #0003}
 .link-actions{display:flex;align-items:center;gap:8px;max-width:90vw}
 .link-actions span{padding-left:10px;font-size:12px;max-width:30vw;overflow:hidden;text-overflow:ellipsis}
 .link-actions button,.link-undo button:first-child{white-space:nowrap}
 .link-undo{display:flex;align-items:center;gap:8px;z-index:5;bottom:calc(104px + env(safe-area-inset-bottom));max-width:calc(100vw - 24px)}
 .link-hint{bottom:calc(165px + env(safe-area-inset-bottom));font-size:13px;pointer-events:none}
 .link-error{bottom:calc(220px + env(safe-area-inset-bottom));max-width:90vw;z-index:5}.link-error button{margin-left:8px}
</style>
