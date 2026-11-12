export const MODELS=[
 {id:'Xenova/whisper-tiny',name:'Tiny · многоязычная',size:'около 40 МБ',description:'Самая лёгкая. Быстрые короткие записи на телефоне; точность ниже на шуме и сложной речи.'},
 {id:'Xenova/whisper-base',name:'Base · многоязычная',size:'около 80 МБ',description:'Баланс скорости и точности для телефона. Русский, английский и другие языки.'},
 {id:'Xenova/whisper-small',name:'Small · многоязычная',size:'около 250 МБ',description:'Рекомендуется для русского и смешанной речи, если хватает памяти. Медленнее Tiny и Base.'},
 {id:'Xenova/whisper-medium',name:'Medium · многоязычная',size:'около 800 МБ',description:'Для компьютера с запасом памяти. Потенциально точнее, но намного тяжелее; на телефоне может не запуститься.'},
 {id:'Xenova/whisper-small.en',name:'Small.en · только английский',size:'около 250 МБ',description:'Специализированная английская модель. Для русского выбирайте многоязычную, без .en.'},
] as const;
export const DEFAULT_MODEL='Xenova/whisper-small';
export const modelCache=(id:string)=>'phosphoreya-whisper:'+id;
export function checkedModel(id:string){if(!MODELS.some(m=>m.id===id))throw Error('Неизвестная модель распознавания.');return id;}
export async function downloadedModels(){const names=await caches.keys();return names.filter(n=>n.startsWith('phosphoreya-whisper:')).map(n=>n.slice('phosphoreya-whisper:'.length)).filter(id=>{try{return !!localStorage.getItem('whisper-ready:'+id);}catch{return false;}});}
