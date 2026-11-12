import {registerSW} from 'virtual:pwa-register';

export interface UpdateStatus {available:boolean;checking:boolean;message:string;deferredUntil?:number}
const deferKey='phosphorea:update-deferred';
/** Update the worker on foregrounding; replacing a running app always stays explicit. */
export function appUpdates(changed:(status:UpdateStatus)=>void){
 let registration:ServiceWorkerRegistration|undefined,disposed=false,lastCheck=0,applying=false;
 let deferredUntil=0;try{const saved=Number(localStorage.getItem(deferKey));if(Number.isFinite(saved)&&saved>Date.now()&&saved<=Date.now()+86400_000)deferredUntil=saved;}catch{}
 let status:UpdateStatus={available:false,checking:false,message:'',deferredUntil};
 const publish=(patch:Partial<UpdateStatus>)=>{status={...status,...patch};if(!disposed)changed(status);};
 registerSW({immediate:true,onNeedRefresh:()=>publish({available:true,message:'Новая версия готова'}),onNeedReload:()=>publish({available:true,message:'Новая версия готова'}),onRegisteredSW:(_url,value)=>{registration=value;if(value?.waiting)publish({available:true});void check(false);},onRegisterError:()=>publish({message:'Не удалось проверить обновление. Проверьте подключение.'})});
 async function check(manual=true){
  if(disposed||status.checking)return;if(manual){try{localStorage.removeItem(deferKey);}catch{}publish({deferredUntil:0});}if(!navigator.onLine){if(manual)publish({message:'Проверим обновление, когда появится интернет.'});return;}
  if(!manual&&Date.now()-lastCheck<60_000)return;lastCheck=Date.now();publish({checking:true,message:''});
  try{registration??=await navigator.serviceWorker?.getRegistration();if(!registration){publish({message:'Обновление станет доступно после первого запуска онлайн.'});return;}await registration.update();if(registration.waiting)publish({available:true});publish({message:status.available?'Новая версия готова':registration.installing?'Новая версия загружается…':'Установлена актуальная версия'});}
  catch{publish({message:'Не удалось проверить обновление. Попробуйте позже.'});}
  finally{publish({checking:false});}
 }
 const foreground=()=>{if(!document.hidden){if(status.deferredUntil&&status.deferredUntil<=Date.now())publish({deferredUntil:0});void check(false);}};
 document.addEventListener('visibilitychange',foreground);window.addEventListener('online',foreground);
 const timer=setInterval(foreground,15*60_000);
 async function apply(){
  if(applying)return;const waiting=registration?.waiting;
  try{localStorage.removeItem(deferKey);}catch{}publish({deferredUntil:0});
  // Another tab may already have activated the worker. The current JS still needs a reload.
  if(!waiting){location.reload();return;}
  applying=true;
  await new Promise<void>((resolve,reject)=>{
   const activated=()=>{clearTimeout(timeout);resolve();location.reload();};
   const timeout=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',activated);applying=false;reject(Error('Обновление ещё не завершено. Попробуйте снова.'));},15000);
   navigator.serviceWorker.addEventListener('controllerchange',activated,{once:true});
   waiting.postMessage({type:'SKIP_WAITING'});
  });
 }
 function postpone(){const until=Date.now()+86400_000;try{localStorage.setItem(deferKey,String(until));}catch{}publish({deferredUntil:until});}
 return {check,apply,postpone,dispose(){disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',foreground);window.removeEventListener('online',foreground);}};
}
