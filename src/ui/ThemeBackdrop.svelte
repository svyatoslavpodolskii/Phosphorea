<script lang="ts">
 import {onMount,untrack} from 'svelte';
 import {getAppliedTheme,decorationShape,type Theme} from '../core/themes';
 import type {Camera} from '../graph/model';
 import type {Viewport} from '../graph/camera';
 import {BACKGROUND_TILE,backgroundLayers,backgroundTransform} from './theme-background';
 let {camera={x:0,y:0,zoom:1},viewport}:{camera?:Camera;viewport?:Viewport}=$props();
 let theme=$state<Theme>(getAppliedTheme()),width=$state(1280),height=$state(800),reduced=$state(false),sleeping=$state(false);
 let root:HTMLDivElement;const canvases:HTMLCanvasElement[]=[];
 const view=$derived(viewport??{width,height}),mode=$derived(reduced?'static':theme.effects.mode??'static');
 type Plane={image:HTMLImageElement;base?:ReturnType<typeof backgroundTransform>;width:number;height:number};
 let planes:Plane[]=[],generation=0;
 function rebuild(){
  const version=++generation;planes=[];for(const canvas of canvases)canvas?.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);
  if(theme.effects.pattern==='none'||!theme.effects.strength)return;
  const shape=decorationShape(theme);
  const layers=backgroundLayers(theme.effects.pattern,theme.effects.density),source=mode==='static'?[{points:layers.flatMap(layer=>layer.points)}]:layers;
  for(const [i,layer] of source.entries()){
   const image=new Image(),body=layer.points.map(p=>`<g opacity="${p.opacity}" transform="translate(${p.x} ${p.y}) rotate(${p.rotation}) scale(${p.size})">${shape}</g>`).join('');
   image.onload=()=>{if(version===generation){planes[i]={image,width:0,height:0};refresh();}};
   image.src='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${BACKGROUND_TILE.width}" height="${BACKGROUND_TILE.height}">${body}</svg>`);
  }
 }
 /** SVG patternTransform repainted hundreds of stars every frame in Firefox.
  * Rasterise at bounded anchors; camera frames only move composited planes. */
 function refresh(){
  const w=view.width,h=view.height;if(!w||!h)return;
  const depths=[.18,.4,.7];
  for(const [i,plane] of planes.entries()){
   if(!plane)continue;const canvas=canvases[i];if(!canvas)continue;
   const next=backgroundTransform(mode,camera,view,depths[i]),base=plane.base;
   let ratio=base?next.scale/base.scale:1,dx=base?next.x-base.x*ratio:0,dy=base?next.y-base.y*ratio:0;
   const padX=mode==='static'?0:w*.5,padY=mode==='static'?0:h*.5,planeW=w+padX*2,planeH=h+padY*2,left=-padX*ratio+dx,top=-padY*ratio+dy;
   if(!base||plane.width!==w||plane.height!==h||ratio<.75||ratio>1.4||left>-padX*.15||top>-padY*.15||left+planeW*ratio<w+padX*.15||top+planeH*ratio<h+padY*.15){
    // All three planes together stay below 48 MiB, including 4K desktops.
    const resolution=Math.min(1,2048/planeW,2048/planeH);canvas.width=Math.ceil(planeW*resolution);canvas.height=Math.ceil(planeH*resolution);
    const ctx=canvas.getContext('2d')!,pattern=ctx.createPattern(plane.image,'repeat');if(!pattern)continue;
    ctx.setTransform(resolution,0,0,resolution,0,0);ctx.translate(padX+next.x,padY+next.y);ctx.scale(next.scale,next.scale);ctx.fillStyle=pattern;
    ctx.fillRect((-padX-next.x)/next.scale,(-padY-next.y)/next.scale,planeW/next.scale,planeH/next.scale);
    plane.base=next;plane.width=w;plane.height=h;ratio=1;dx=dy=0;
    canvas.style.width=planeW+'px';canvas.style.height=planeH+'px';canvas.style.left=-padX+'px';canvas.style.top=-padY+'px';
   }
   canvas.style.transform=`matrix(${ratio},0,0,${ratio},${padX*(1-ratio)+dx},${padY*(1-ratio)+dy})`;
   canvas.dataset.worldTransform=`${next.scale},${next.x},${next.y}`;
  }
 }
 $effect(()=>{mode;untrack(()=>{if(root)rebuild();});});
 $effect(()=>{camera.x;camera.y;camera.zoom;view.width;view.height;mode;untrack(refresh);});
 onMount(()=>{
  theme=getAppliedTheme();const update=(e:Event)=>untrack(()=>{theme=(e as CustomEvent<Theme>).detail;rebuild();});
  const media=matchMedia('(prefers-reduced-motion: reduce)'),motion=()=>reduced=media.matches,visibility=()=>sleeping=document.hidden;
  const observer=new ResizeObserver(([entry])=>{width=entry.contentRect.width;height=entry.contentRect.height;});observer.observe(root);
  window.addEventListener('phosphora-theme-change',update);media.addEventListener('change',motion);document.addEventListener('visibilitychange',visibility);motion();visibility();rebuild();
  return()=>{generation++;observer.disconnect();window.removeEventListener('phosphora-theme-change',update);media.removeEventListener('change',motion);document.removeEventListener('visibilitychange',visibility);planes=[];};
 });
</script>
<div class="theme-backdrop" class:sleeping bind:this={root} aria-hidden="true" data-pattern={theme.effects.pattern} data-mode={mode} style:opacity={theme.effects.strength}>
 {#each [0,1,2] as index}<canvas bind:this={canvases[index]} class:glimmer={!reduced&&mode!=='static'&&theme.effects.pattern!=='none'} style:visibility={mode==='static'&&index>0?'hidden':'visible'} style:animation-delay={`${index*-2.7}s`}></canvas>{/each}
</div>
<style>
 .theme-backdrop{overflow:hidden;contain:strict}.theme-backdrop canvas{position:absolute;pointer-events:none;transform-origin:0 0;will-change:transform}.theme-backdrop[data-mode=static] canvas{will-change:auto}.glimmer{animation:field-glimmer 9s ease-in-out infinite alternate}.sleeping canvas{animation-play-state:paused}
 @keyframes field-glimmer{from{opacity:.78}to{opacity:1}}
 @media(prefers-reduced-motion:reduce){.theme-backdrop[data-mode=static] canvas{will-change:auto}.glimmer{animation:none}}
</style>
