import {Color, Geometry, Mesh, Shader, UniformGroup} from 'pixi.js';
import type {GpuEdge} from './gpu-renderer';
const SEGMENTS=24;
/** Retained centerlines: camera scale is a uniform, never a vertex-buffer upload. */
export class GpuCurves {
 private uniforms=new UniformGroup({uZoom:{value:1,type:'f32'}});
 private geometry=new Geometry({attributes:{aPosition:{buffer:new Float32Array(4),format:'float32x2'},aOffset:{buffer:new Float32Array(4),format:'float32x2'},aColor:{buffer:new Float32Array(8),format:'float32x4'}},indexBuffer:new Uint32Array(6)});
 private shader=Shader.from({gl:{vertex:`#version 300 es
 in vec2 aPosition; in vec2 aOffset; in vec4 aColor;
 uniform mat3 uProjectionMatrix; uniform mat3 uWorldTransformMatrix; uniform mat3 uTransformMatrix; uniform float uZoom;
 out vec4 vColor;
 void main(){vColor=aColor;gl_Position=vec4((uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix*vec3(aPosition+aOffset/uZoom,1.)).xy,0.,1.);}
 `,fragment:`#version 300 es
 in vec4 vColor; out vec4 finalColor;
 void main(){finalColor=vec4(vColor.rgb*vColor.a,vColor.a);}
 `},resources:{curveUniforms:this.uniforms}});
 readonly mesh=new Mesh({geometry:this.geometry,shader:this.shader});
 private previous:number[]=[];
 private paths=new Map<string,string>();
 builds=0;
 constructor(){this.mesh.visible=false;}
 setZoom(zoom:number){this.uniforms.uniforms.uZoom=zoom;}
 paint(edges:GpuEdge[],zoom:number){
  this.setZoom(zoom);
  const values:number[]=[],color=new Color(),paths=new Map<string,string>();
  for(const e of edges){color.setValue(e.color);const [r,g,b]=color.toArray();const width=Math.round(e.width*zoom*1000)/1000;
   values.push(e.ax,e.ay,e.cx,e.cy,e.bx,e.by,width,r,g,b,e.alpha);
   const path=[e.ax,e.ay,e.cx,e.cy,e.bx,e.by].join(',');paths.set(e.id,path);if(this.paths.get(e.id)!==path)this.builds++;
  }
  this.paths=paths;
  if(values.length===this.previous.length&&values.every((v,i)=>v===this.previous[i]))return false;
  this.previous=values;this.mesh.visible=edges.length>0;if(!edges.length)return true;
  const count=edges.length*(SEGMENTS+1)*2,positions=new Float32Array(count*2),offsets=new Float32Array(count*2),colors=new Float32Array(count*4),indices=new Uint32Array(edges.length*SEGMENTS*6);
  for(let j=0;j<edges.length;j++){
   const v=j*11,ax=values[v],ay=values[v+1],cx=values[v+2],cy=values[v+3],bx=values[v+4],by=values[v+5],half=values[v+6]/2,base=j*(SEGMENTS+1)*2;
   for(let i=0;i<=SEGMENTS;i++){
    const t=i/SEGMENTS,u=1-t,x=u*u*ax+2*u*t*cx+t*t*bx,y=u*u*ay+2*u*t*cy+t*t*by,dx=2*(u*(cx-ax)+t*(bx-cx)),dy=2*(u*(cy-ay)+t*(by-cy)),d=Math.hypot(dx,dy)||1;
    for(let side=0;side<2;side++){const at=base+i*2+side,sign=side? -1:1;positions[at*2]=x;positions[at*2+1]=y;offsets[at*2]=-dy/d*half*sign;offsets[at*2+1]=dx/d*half*sign;for(let c=0;c<4;c++)colors[at*4+c]=values[v+7+c];}
    if(i<SEGMENTS){const at=base+i*2;indices.set([at,at+1,at+2,at+1,at+3,at+2],(j*SEGMENTS+i)*6);}
   }
  }
  this.geometry.getBuffer('aPosition').data=positions;this.geometry.getBuffer('aOffset').data=offsets;this.geometry.getBuffer('aColor').data=colors;this.geometry.indexBuffer!.data=indices;return true;
 }
 destroy(){this.mesh.destroy();this.geometry.destroy(true);this.shader.destroy();}
}
