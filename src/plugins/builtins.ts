import type {Plugin} from './api';
import {noteTypes} from '../core/note-types';
export const templates:Plugin={manifest:{id:'builtin.templates',name:'Типы заметок',version:'1.1.0',apiVersion:1,permissions:['ui','settings','atoms.read','atoms.write','graph'],description:'Свои типы, названия, значки и шаблоны текста. Тип не меняет поведение заметки.'},async activate(app){
 let alive=true,revision=0;let remove:(()=>void)[]=[];
 async function refresh(){const version=++revision,stored=await app.settings.get('catalog'),catalog=noteTypes(stored,stored===undefined?(await app.atoms.list()).map(a=>a.type):[]);if(!alive||version!==revision)return;for(const off of remove)off();remove=catalog.map(type=>app.types.register(type));}
 const off=app.events.on('preferences:plugin-setting',e=>e.plugin==='builtin.templates'?refresh():undefined);
 try{await refresh();}catch(error){off();throw error;}
 app.ui.registerContextAction({id:'complete',name:'Архивировать мысль',async run(id){if(id)await app.atoms.setState(id,'archived');}});
 return()=>{alive=false;revision++;off();for(const cleanup of remove)cleanup();};
}};
