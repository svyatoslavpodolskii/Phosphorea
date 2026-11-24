import {cameraMetrics} from '../graph/frame-metrics';
/** Explicit bug-report export: counts and runtime measurements, never note contents. */
export function diagnostics(counts:{atoms:number;links:number}){
 const map=document.querySelector<HTMLCanvasElement>('canvas.map');
 return {version:import.meta.env.VITE_APP_VERSION,build:import.meta.env.VITE_BUILD_ID,
  browser:navigator.userAgent,standalone:matchMedia('(display-mode: standalone)').matches,
  viewport:{width:innerWidth,height:innerHeight,visibleHeight:visualViewport?.height??innerHeight,dpr:devicePixelRatio},
  cameraPerformance:cameraMetrics.snapshot(),
  renderer:map?.dataset.renderer??'not-ready',rendererPending:map?.dataset.rendererPending==='true',
  firstMapMs:map?.dataset.startupMs?Number(map.dataset.startupMs):null,
  dataReadyMs:performance.getEntriesByName('phosphora:data-ready').at(-1)?.startTime??null,
  counts,visibleError:Boolean(document.querySelector('[role="alert"]'))};
}
