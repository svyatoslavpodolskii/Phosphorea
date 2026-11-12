/** Bounded Canvas fallback atlas. Camera frames reuse pixels rather than
 * re-rasterising gradients, glyphs and labels on every visible atom. */
export class RasterCache{
 private entries=new Map<string,{canvas:HTMLCanvasElement;bytes:number}>();private bytes=0;
 constructor(private budget=32*1024*1024){}
 get(key:string,width:number,height:number,paint:(context:CanvasRenderingContext2D)=>void){
  const known=this.entries.get(key);if(known){this.entries.delete(key);this.entries.set(key,known);return known.canvas;}
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(width*2));canvas.height=Math.max(1,Math.ceil(height*2));
  const ctx=canvas.getContext('2d')!;ctx.scale(2,2);paint(ctx);const bytes=canvas.width*canvas.height*4;
  if(bytes>this.budget)return canvas;
  while(this.bytes+bytes>this.budget&&this.entries.size){const id=this.entries.keys().next().value!,entry=this.entries.get(id)!;this.bytes-=entry.bytes;entry.canvas.width=entry.canvas.height=0;this.entries.delete(id);}
  this.entries.set(key,{canvas,bytes});this.bytes+=bytes;return canvas;
 }
 clear(){for(const entry of this.entries.values())entry.canvas.width=entry.canvas.height=0;this.entries.clear();this.bytes=0;}
}
