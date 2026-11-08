import type {AtomType} from '../plugins/api';
import {typeIcon} from './icons';
export const NOTE_TYPES_KEY='plugin:builtin.templates:catalog';
export const defaultNoteTypes:AtomType[]=[{id:'note',name:'Заметка'},{id:'person',name:'Человек',appearance:{color:'#e9b482'}},{id:'project',name:'Проект',appearance:{color:'#9bbef2'}},{id:'idea',name:'Идея',appearance:{color:'#d4a2e5'}},{id:'reference',name:'Источник'},{id:'media',name:'Медиа'},{id:'event',name:'Событие'}].map(t=>({...t,icon:typeIcon(t.id)}));
export function noteTypes(value:unknown,usedTypes:string[]=[]):AtomType[]{
 if(value===undefined){const used=new Set(usedTypes.map(t=>t.replace(/^builtin\.templates:/,'')));return structuredClone([...defaultNoteTypes,...[{id:'hub',name:'Тема'},{id:'area',name:'Область'},{id:'folder',name:'Папка (старый тип)'}].filter(t=>used.has(t.id)).map(t=>({...t,icon:typeIcon(t.id)}))]);}
 if(!Array.isArray(value)||value.length>100)throw Error('Не более 100 типов заметок.');
 const ids=new Set<string>();
 const result=value.map(t=>{if(!t||typeof t.id!=='string'||!/^[-a-z0-9_]{1,70}$/.test(t.id)||ids.has(t.id)||typeof t.name!=='string'||!t.name.trim()||t.name.length>60||t.content!==undefined&&(typeof t.content!=='string'||t.content.length>100_000)||t.icon!==undefined&&(typeof t.icon!=='string'||!/^icon:[a-z]+$/.test(t.icon)))throw Error('Некорректный тип заметки.');ids.add(t.id);if(t.appearance?.color&&!/^#[0-9a-f]{6}$/i.test(t.appearance.color))throw Error('Некорректный цвет типа.');return{id:t.id,name:t.name.trim(),icon:t.icon||'icon:note',...(t.content?{content:t.content}:{}),...(t.appearance?.color?{appearance:{color:t.appearance.color}}:{})};});
 if(!ids.has('note')){if(result.length>=100)throw Error('Не более 100 типов, включая базовую заметку.');result.unshift({id:'note',name:'Заметка',icon:'icon:note'});}
 return result;
}
