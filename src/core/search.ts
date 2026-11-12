import {attachments} from './attachments';
import MiniSearch from 'minisearch';
import {stemmer} from '@orama/stemmers/russian';
import type {Atom} from './model';

export function fold(text:string){return text.normalize('NFKC').toLowerCase().replace(/ё/g,'е');}
export function wordStem(word:string){const value=fold(word);return /^[а-я]+$/.test(value)?stemmer(value):value;}
export interface Fragment {text:string;match:boolean}
const words=(text:string)=>[...text.matchAll(/[\p{L}\p{N}]+/gu)];
export function excerpt(text:string,query:string,limit=160):Fragment[]{
 const terms=words(query).map(m=>wordStem(m[0]));const hits=words(text).filter(m=>terms.some(t=>wordStem(m[0])===t||wordStem(m[0]).startsWith(t)));
 let start=Math.max(0,(hits[0]?.index??0)-48),end=Math.min(text.length,start+limit);
 if(start){const space=text.indexOf(' ',start);if(space>=0&&space<start+20)start=space+1;}
 if(end<text.length){const space=text.lastIndexOf(' ',end);if(space>end-20)end=space;}
 const result:Fragment[]=[];let pos=start;if(start)result.push({text:'…',match:false});
 for(const m of hits){const at=m.index!;if(at<start||at>=end)continue;if(at>pos)result.push({text:text.slice(pos,at),match:false});result.push({text:text.slice(at,Math.min(end,at+m[0].length)),match:true});pos=Math.min(end,at+m[0].length);}
 if(pos<end)result.push({text:text.slice(pos,end),match:false});if(end<text.length)result.push({text:'…',match:false});return result;
}
export class NoteSearch {
 private index=new MiniSearch({fields:['title','aliases','content','tags'],tokenize:text=>words(text).map(m=>m[0]),processTerm:wordStem});
 private signatures=new Map<string,string>();
 sync(atoms:Atom[]){const ids=new Set(atoms.map(a=>a.id));for(const id of this.signatures.keys())if(!ids.has(id)){this.index.discard(id);this.signatures.delete(id);}for(const a of atoms){const doc={id:a.id,title:a.title,aliases:a.aliases.join(' '),content:a.content+' '+attachments(a).map(f=>f.transcript||'').join(' '),tags:JSON.stringify(a.properties.tags??'')};const key=JSON.stringify(doc);if(this.signatures.get(a.id)===key)continue;if(this.signatures.has(a.id))this.index.replace(doc);else this.index.add(doc);this.signatures.set(a.id,key);}}
 search(query:string,atoms:Atom[]){if(!query.trim())return[];const byId=new Map(atoms.map(a=>[a.id,a]));return this.index.search(query,{boost:{title:5,aliases:4,content:1,tags:2},combineWith:'AND',prefix:(_term,i,terms)=>i===terms.length-1,fuzzy:term=>term.length>=5?1:false}).map(r=>({a:byId.get(r.id)!,score:r.score*(fold(byId.get(r.id)?.title??'')===fold(query)?3:1)})).filter(r=>r.a).sort((a,b)=>b.score-a.score).slice(0,50).map(r=>r.a);}
}
