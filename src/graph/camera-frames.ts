import type {Camera} from './model';
import type {Viewport} from './camera';
export interface CameraFrame {camera:Camera;viewport:Viewport}
/** Presentation transport, deliberately outside reactive application state.
 * Subscribers update retained surfaces; only a settled camera is persisted. */
export class CameraFrames {
 private listeners=new Set<(frame:CameraFrame)=>void>();
 current:CameraFrame|null=null;
 publish(camera:Camera,viewport:Viewport){
  const old=this.current;
  if(old&&old.camera.x===camera.x&&old.camera.y===camera.y&&old.camera.zoom===camera.zoom&&old.viewport.width===viewport.width&&old.viewport.height===viewport.height)return;
  const frame={camera:{...camera},viewport:{...viewport}};this.current=frame;
  for(const listener of this.listeners)listener(frame);
 }
 subscribe(listener:(frame:CameraFrame)=>void){this.listeners.add(listener);if(this.current)listener(this.current);return()=>{this.listeners.delete(listener);};}
}
