import {zip,unzipSync,strToU8,strFromU8} from 'fflate';
import {SCHEMA_VERSION} from './schema';
const LIMIT=256*1024*1024;
export interface NativeManifest {format:'phosphored-storage';version:1;schema:number;name:string;createdAt:string;sha256:string}
async function digest(bytes:Uint8Array){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function backupFilename(name:string,date=new Date()){
 const safe=name.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/g,'').slice(0,80)||'Хранилище';
 const pad=(n:number)=>String(n).padStart(2,'0');
 return `${safe}_${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.posphorea`;
}
export async function packStorage(database:Uint8Array,name:string){
 if(database.length>LIMIT)throw Error('Копия превышает 256 МБ.');
 const manifest:NativeManifest={format:'phosphored-storage',version:1,schema:SCHEMA_VERSION,name,createdAt:new Date().toISOString(),sha256:await digest(database)};
 return new Promise<Uint8Array>((resolve,reject)=>zip({'manifest.json':strToU8(JSON.stringify(manifest)),'storage.sqlite3':database},{level:6},(error,result)=>error?reject(error):resolve(result)));
}
export async function unpackStorage(bytes:Uint8Array){
 if(bytes.length>LIMIT+100_000)throw Error('Копия превышает 256 МБ.');
 let total=0;
 const files=unzipSync(bytes,{filter:file=>{total+=file.originalSize;if(total>LIMIT+100_000||!['manifest.json','storage.sqlite3'].includes(file.name))throw Error('Некорректный состав копии.');return true;}});
 if(!files['manifest.json']||!files['storage.sqlite3']||files['manifest.json'].length>10_000)throw Error('Это не полная копия хранилища.');
 const manifest=JSON.parse(strFromU8(files['manifest.json'])) as NativeManifest;
 if(manifest.format!=='phosphored-storage'||manifest.version!==1||!Number.isInteger(manifest.schema)||manifest.schema<1||manifest.schema>SCHEMA_VERSION||typeof manifest.name!=='string'||manifest.name.length>80)throw Error('Формат или версия копии не поддерживается.');
 const database=files['storage.sqlite3'];
 if(database.length<512||strFromU8(database.subarray(0,16))!=='SQLite format 3\0'||await digest(database)!==manifest.sha256)throw Error('Копия повреждена. Рабочие данные не изменены.');
 return {manifest,database};
}
