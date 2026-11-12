let context:OffscreenCanvasRenderingContext2D|null|undefined;
const widths=new Map<string,number>(),wrapped=new Map<string,string[]>(),segmenter=new Intl.Segmenter(undefined,{granularity:'grapheme'});
// A 5000-note overview must not evict every label just before the next frame.
// Keep the cache bounded while allowing several measurements per visible title.
function cache<T>(map:Map<string,T>,key:string,value:T){if(map.size>=16384)map.delete(map.keys().next().value!);map.set(key,value);return value;}
export function measureText(text:string,size=13){
 const key=size+'\0'+text,known=widths.get(key);if(known!==undefined)return known;
 if(context===undefined)context=typeof OffscreenCanvas==='undefined'?null:new OffscreenCanvas(1,1).getContext('2d');
 if(context){context.font=size+'px system-ui';return cache(widths,key,context.measureText(text).width);}
 return cache(widths,key,[...segmenter.segment(text)].length*7.5*size/13);
}
export function labelLines(text:string){
 const known=wrapped.get(text);if(known)return known;
 const lines:string[]=[];let line='';
 for(const word of text.split(/\s+/).filter(Boolean)){
  if(line&&measureText(line+' '+word)>190){lines.push(line);line='';}
  if(measureText(word)<=190){line+=(line?' ':'')+word;continue;}
  for(const {segment} of segmenter.segment(word)){if(line&&measureText(line+segment)>190){lines.push(line);line='';}line+=segment;}
 }
 if(line)lines.push(line);
 const result=lines.slice(0,2);if(lines.length>2){const parts=[...segmenter.segment(result[1])].map(p=>p.segment);while(parts.length&&measureText(parts.join('')+'…')>190)parts.pop();result[1]=parts.join('')+'…';}
 return cache(wrapped,text,result);
}
export function footprint(label:string,radius:number,content=false){const lines=labelLines(label),halfWidth=Math.max(radius+8,...lines.map(s=>measureText(s)/2+8));return {halfWidth,top:radius+8,bottom:radius+16+lines.length*17+(content?24:0)};}
/** Font stays readable at overview scale, but stops growing before it fills a phone. */
export function labelSize(zoom:number,viewportWidth:number){return Math.floor(Math.min(22,Math.max(11,13*zoom),Math.max(1,viewportWidth-32)*13/190)/zoom*4)/4;}
const stateLabels:Record<string,string>={now:'◌ СЕЙЧАС',paused:'Ⅱ ПАУЗА',archived:'↓ АРХИВ'};
/** Shared by canvas text and screen-space obstacles, including the state caption. */
export function labelGeometry(label:string,radius:number,zoom:number,viewportWidth:number,state='normal'){
 const size=labelSize(zoom,viewportWidth),lines=labelLines(label),top=radius+12;
 const lineHeight=size+4,caption=stateLabels[state]??'',captionSize=Math.min(13,Math.max(10,10*zoom))/zoom;
 const captionTop=top+lines.length*lineHeight+6/zoom;
 const halfWidth=Math.max(0,...lines.map(line=>measureText(line,13)*size/26),caption?measureText(caption,13)*captionSize/26:0);
 const bottom=caption?captionTop+captionSize:top+lines.length*lineHeight;
 return {size,lines,top,lineHeight,caption,captionSize,captionTop,halfWidth,bottom};
}
export function visualFootprint(label:string,radius:number,zoom:number,viewportWidth:number,state='normal'){
 const text=labelGeometry(label,radius,zoom,viewportWidth,state);
 return {halfWidth:Math.max(radius+8,text.halfWidth+8),top:radius+8,bottom:text.bottom+8};
}
