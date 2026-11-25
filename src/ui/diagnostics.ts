import {cameraMetrics} from '../graph/frame-metrics';
/** Explicit bug-report export: counts and runtime measurements, never note contents. */
export function diagnostics(counts:{atoms:number;links:number}){
 const map=document.querySelector<HTMLCanvasElement>('canvas.map'),gpu=document.querySelector<HTMLCanvasElement>('.gpu-map-host canvas');
 return {version:import.meta.env.VITE_APP_VERSION,build:import.meta.env.VITE_BUILD_ID,
  browser:navigator.userAgent,standalone:matchMedia('(display-mode: standalone)').matches,
  viewport:{width:innerWidth,height:innerHeight,visibleHeight:visualViewport?.height??innerHeight,dpr:devicePixelRatio},
  cameraPerformance:cameraMetrics.snapshot(),
  gpuSurface:gpu?{width:gpu.width,height:gpu.height,device:gpu.dataset.device||'',antialias:gpu.dataset.antialias,textureBuilds:Number(gpu.dataset.textureBuilds||0),curveBuilds:Number(gpu.dataset.curveBuilds||0)}:null,
  renderer:map?.dataset.renderer??'not-ready',rendererPending:map?.dataset.rendererPending==='true',
  firstMapMs:map?.dataset.startupMs?Number(map.dataset.startupMs):null,
  dataReadyMs:performance.getEntriesByName('phosphora:data-ready').at(-1)?.startTime??null,
  counts,visibleError:Boolean(document.querySelector('[role="alert"]'))};
}
