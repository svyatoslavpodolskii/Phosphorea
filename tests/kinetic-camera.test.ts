import {it,expect} from 'vitest';
import {CameraRig,screenToWorld} from '../src/graph/camera';
function flick(reduced=false,pause=0){let time=0;const rig=new CameraRig(()=>time),view={width:390,height:844},point={x:160,y:300};rig.resize(view);rig.setReduced(reduced);rig.set({x:30,y:-20,zoom:.5});const held=screenToWorld(point,rig.value,view);for(let i=0;i<6;i++){time+=16;rig.pinchTo(point,.5*Math.exp(i*.05));rig.step(16);}time+=pause;const target=rig.intended.zoom;rig.endPinch();return{rig,view,point,held,target};}
it('a pinch flick continues smoothly, preserves its anchor, then yields immediately to a new grab',()=>{
 const {rig,point,view,held,target}=flick();let last=rig.value.zoom;for(let i=0;i<25;i++){const next=rig.step(16).zoom;expect(next).toBeGreaterThanOrEqual(last);expect(next/last).toBeLessThan(1.15);last=next;expect(screenToWorld(point,rig.value,view).x).toBeCloseTo(held.x,8);}
 expect(rig.value.zoom).toBeGreaterThan(target*1.1);rig.halt();const stopped={...rig.value};for(let i=0;i<30;i++)rig.step(16);expect(rig.value).toEqual(stopped);
});
it('holding still before release and reduced motion do not add inertia',()=>{
 for(const [reduced,pause] of [[true,0],[false,150]] as const){const {rig,target}=flick(reduced,pause);for(let i=0;i<120;i++)rig.step(16);expect(rig.value.zoom).toBeCloseTo(target,8);}
});
