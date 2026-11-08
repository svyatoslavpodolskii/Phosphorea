<script lang="ts">
 import type {Camera} from '../graph/model';
 import {folderCameraTransform,type FolderTerritory} from '../graph/folders';
 let {territories,camera,width,height,activeId=null}:{territories:FolderTerritory[];camera:Camera;width:number;height:number;activeId?:string|null}=$props();
 // Paths are computed by the host on graph/position updates. Camera frames only
 // update this one SVG group transform; they never rebuild territory geometry.
 let transform=$derived(folderCameraTransform(camera,width,height));
 let visible=$derived(territories.filter(t=>{
  const b=t.bounds,z=camera.zoom,x=width/2+camera.x,y=height/2+camera.y;
  return b.maxX*z+x>=-8&&b.minX*z+x<=width+8&&b.maxY*z+y>=-8&&b.minY*z+y<=height+8;
 }).slice(0,64));
</script>

<svg class="folder-territories" {width} {height} aria-hidden="true">
 <defs><filter id="folder-soft-edge" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="8"/></filter></defs>
 <g {transform}>
  {#each visible as territory (territory.id)}
   <path filter="url(#folder-soft-edge)" d={territory.path} fill={territory.color} fill-opacity={activeId===territory.id ? .11 : .055} stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  {/each}
 </g>
</svg>

<style>
 .folder-territories{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:-1}
</style>
