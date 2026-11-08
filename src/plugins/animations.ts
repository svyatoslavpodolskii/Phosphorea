import type {Plugin} from './api';

/** Visual entry never rewrites camera coordinates or persists a decorative zoom. */
export const animationsPlugin:Plugin={manifest:{id:'builtin.animations',name:'Анимации',description:'Мягкий вход на карту, открытие окон и отклик папок.',version:'1.0.0',apiVersion:1,permissions:['settings','ui'],settings:[
 {key:'entrance',label:'Приближение при входе',type:'boolean',default:true},
 {key:'panels',label:'Открытие окон',type:'boolean',default:true},
 {key:'folders',label:'Отклик папок',type:'boolean',default:true},
]},async activate(api){
 let alive=true,revision=0,entered=false;let options={entrance:true,panels:true,folders:true};
 const root=document.documentElement,main=document.querySelector('main'),media=matchMedia('(prefers-reduced-motion: reduce)'),active=new Set<Animation>();
 const cancel=()=>{for(const a of active)a.cancel();active.clear();};
 function animate(node:Element,frames:Keyframe[],duration:number){if(media.matches||!alive||!node.isConnected)return;const a=node.animate(frames,{duration,easing:'cubic-bezier(.23,1,.32,1)'});active.add(a);a.finished.catch(()=>{}).finally(()=>active.delete(a));}
 function enter(){if(entered||!main?.classList.contains('app-ready'))return;const scene=main.querySelector('.map-scene');if(!scene)return;entered=true;if(options.entrance)animate(scene,[{opacity:.25,transform:'scale(.975)'},{opacity:1,transform:'scale(1)'}],350);}
 const observer=new MutationObserver(records=>{enter();if(!options.panels)return;for(const record of records)for(const node of record.addedNodes){if(!(node instanceof HTMLElement))continue;const panel=node.matches('.scrim,.context-scrim')?node.firstElementChild:node.matches('.main-menu')?node:null;if(panel){animate(panel,[{opacity:0,transform:'translateY(8px) scale(.98)'},{opacity:1,transform:'translateY(0) scale(1)'}],200);}}});
 async function refresh(){const rev=++revision;const values=await Promise.all(['entrance','panels','folders'].map(key=>api.settings.get<boolean>(key)));if(!alive||rev!==revision)return;options={entrance:values[0]!==false,panels:values[1]!==false,folders:values[2]!==false};cancel();root.dataset.uiMotion='on';root.dataset.uiPanels=String(options.panels);enter();}
 const off=api.events.on('preferences:plugin-setting',e=>e.plugin==='builtin.animations'?refresh():undefined);
 const folder=(e:MouseEvent)=>{const node=(e.target as Element).closest('[data-folder-id]');if(node&&options.folders)animate(node,[{opacity:.7},{opacity:1}],160);};
 const readyObserver=new MutationObserver(enter);
 try{await refresh();if(main){observer.observe(main,{childList:true,subtree:true});readyObserver.observe(main,{attributes:true,attributeFilter:['class']});}document.addEventListener('click',folder,true);document.addEventListener('pointerdown',cancel,true);media.addEventListener('change',cancel);}catch(error){off();observer.disconnect();readyObserver.disconnect();throw error;}
 return()=>{alive=false;revision++;off();observer.disconnect();readyObserver.disconnect();cancel();document.removeEventListener('click',folder,true);document.removeEventListener('pointerdown',cancel,true);media.removeEventListener('change',cancel);root.dataset.uiMotion='off';root.dataset.uiPanels='false';};
}};
