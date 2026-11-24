/** A local, opt-in decoration. Holding never activates the surrounding button. */
const KEY='phosphoreya:logo-spin';
export function spinningLogo(node:HTMLElement){
 let enabled=false,rotation:Animation|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 let pointer:number|undefined,x=0,y=0,suppressClick=false;
 try{enabled=localStorage.getItem(KEY)==='true';}catch{/* Storage may be unavailable in a private session. */}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function paint(){
  node.dataset.spinning=String(enabled);
  if(enabled&&!document.hidden&&!reduced.matches){
   if(!rotation){const svg=node.querySelector('svg');if(svg)rotation=svg.animate([{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:12000,iterations:Infinity,easing:'linear'});}
   rotation?.play();
  }else rotation?.pause();
 }
 function clear(){clearTimeout(timer);timer=undefined;}
 function down(e:PointerEvent){
  if(!e.isPrimary||e.button!==0||node.closest('button')?.disabled)return;
  clear();suppressClick=false;pointer=e.pointerId;x=e.clientX;y=e.clientY;node.setPointerCapture(pointer);
  timer=setTimeout(()=>{timer=undefined;enabled=!enabled;suppressClick=true;try{localStorage.setItem(KEY,String(enabled));}catch{}paint();},650);
 }
 function move(e:PointerEvent){if(e.pointerId===pointer&&Math.hypot(e.clientX-x,e.clientY-y)>10){clear();suppressClick=true;}}
 function up(e:PointerEvent){if(e.pointerId!==pointer)return;clear();pointer=undefined;}
 function click(e:MouseEvent){if(suppressClick){suppressClick=false;e.preventDefault();e.stopImmediatePropagation();}}
 function context(e:Event){if(pointer!==undefined||suppressClick)e.preventDefault();}
 node.addEventListener('pointerdown',down);node.addEventListener('pointermove',move);node.addEventListener('pointerup',up);node.addEventListener('pointercancel',up);node.addEventListener('lostpointercapture',up);node.addEventListener('click',click,true);node.addEventListener('contextmenu',context);
 const visibility=()=>{clear();pointer=undefined;paint();};document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',paint);paint();
 return{destroy(){clear();rotation?.cancel();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',paint);node.removeEventListener('pointerdown',down);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',up);node.removeEventListener('pointercancel',up);node.removeEventListener('lostpointercapture',up);node.removeEventListener('click',click,true);node.removeEventListener('contextmenu',context);}};
}
