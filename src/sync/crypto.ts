import {canonical} from './records';
const enc=new TextEncoder();
export const bytes=(text:string)=>enc.encode(text);
export function b64(data:Uint8Array){let s='';for(const b of data)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function unb64(text:string){if(!/^[A-Za-z0-9_-]*$/.test(text))throw Error('Некорректный код.');return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
export async function hash(data:Uint8Array){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',data as BufferSource)));}
export async function fingerprint(jwk:JsonWebKey){validPublic(jwk);return hash(bytes(canonical({kty:'EC',crv:'P-256',x:jwk.x,y:jwk.y})));}
// PeerJS rejects consecutive/leading '-' or '_' separators in base64url IDs.
export function peerId(key:string){return 'phosphorea-'+[...unb64(key)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function validPublic(jwk:JsonWebKey){if(!jwk||jwk.kty!=='EC'||jwk.crv!=='P-256'||jwk.d||typeof jwk.x!=='string'||typeof jwk.y!=='string'||unb64(jwk.x).length!==32||unb64(jwk.y).length!==32)throw Error('Некорректный открытый ключ.');}
export interface Identity {privateKey:CryptoKey;publicKey:JsonWebKey;id:string}
export async function generateIdentity():Promise<Identity>{const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']) as CryptoKeyPair;const publicKey=await crypto.subtle.exportKey('jwk',pair.publicKey);return{privateKey:pair.privateKey,publicKey,id:await fingerprint(publicKey)};}
let identityPromise:Promise<Identity>|undefined;
export function identity(){return identityPromise??=loadIdentity().catch(e=>{identityPromise=undefined;throw e;});}
async function loadIdentity():Promise<Identity>{
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('phosphorea-device-identity',1);req.onupgradeneeded=()=>req.result.createObjectStore('keys');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 try{const found=await new Promise<Identity|undefined>((resolve,reject)=>{const req=db.transaction('keys').objectStore('keys').get('identity');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});if(found)return found;
  const created=await generateIdentity();return await new Promise<Identity>((resolve,reject)=>{const tx=db.transaction('keys','readwrite'),store=tx.objectStore('keys'),req=store.get('identity');let result=created;req.onsuccess=()=>{if(req.result)result=req.result;else store.put(created,'identity');};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
 }finally{db.close();}
}
export interface Hello {v:1;identity:JsonWebKey;ephemeral:JsonWebKey;nonce:string;name:string;invite:string;scope:string}
export interface Invitation {v:1;peer:string;key:string;secret:string;expires:number}
export function invitationUrl(invite:Invitation){const url=new URL(location.href);url.search='';url.hash='pair='+b64(bytes(JSON.stringify(invite)));return url.href;}
export function parseInvitation(text:string):Invitation{
 if(text.length>3000)throw Error('Ссылка слишком длинная.');let url:URL;try{url=new URL(text);}catch{throw Error('Вставьте ссылку подключения из Phosphoreya.');}
 const encoded=new URLSearchParams(url.hash.slice(1)).get('pair');if(!encoded)throw Error('В ссылке нет кода подключения.');
 let i:Invitation;try{i=JSON.parse(new TextDecoder().decode(unb64(encoded))) as Invitation;}catch{throw Error('Код подключения повреждён. Покажите новый QR.');}
 if(!i||i.v!==1||typeof i.key!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(i.key)||i.peer!==peerId(i.key)||typeof i.secret!=='string'||unb64(i.secret).length!==32||!Number.isFinite(i.expires)||i.expires<Date.now()||i.expires>Date.now()+11*60_000)throw Error('Код истёк или повреждён. Покажите новый QR.');return i;
}
export async function createHello(identity:Identity,name:string,invite='',scope=''){
 const ephemeral=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveBits']) as CryptoKeyPair;
 const hello:Hello={v:1,identity:identity.publicKey,ephemeral:await crypto.subtle.exportKey('jwk',ephemeral.publicKey),nonce:b64(crypto.getRandomValues(new Uint8Array(32))),name:name.slice(0,80),invite,scope};return{hello,privateKey:ephemeral.privateKey};
}
export function validateHello(value:unknown):asserts value is Hello{const h=value as Hello;if(!h||h.v!==1||typeof h.name!=='string'||h.name.length>80||typeof h.scope!=='string'||h.scope!==''&&!/^[a-f0-9-]{36}$/.test(h.scope)||typeof h.invite!=='string'||h.invite.length>50||typeof h.nonce!=='string'||unb64(h.nonce).length!==32)throw Error('Неверный протокол подключения.');validPublic(h.identity);validPublic(h.ephemeral);}
const EMOJI=['🌙','🌻','🍋','🍒','🍉','🥝','🥑','🍄','🌵','🌲','🌴','🍁','🌸','🌼','🌊','🔥','⭐','🌈','☂️','❄️','⚡','🎈','🎁','🎨','🎵','🎸','🎹','🥁','📷','💡','🔑','🧭','🚲','🚀','⛵','🏔️','🏝️','🏠','🏰','🎡','🐶','🐱','🦊','🐻','🐼','🐨','🐯','🦁','🐸','🐙','🦋','🐝','🐢','🐬','🦉','🦚','🐧','🦄','🐳','🦕','🐘','🦒','🐿️','🦔'];
export class SecureChannel {
 private sent=0;private received=0;
 constructor(private sendKey:CryptoKey,private receiveKey:CryptoKey,readonly transcript:string,readonly emojis:string[]){}
 async seal(value:unknown){const sequence=++this.sent;if(!Number.isSafeInteger(sequence))throw Error('Session counter exhausted');const iv=new Uint8Array(12);new DataView(iv.buffer).setBigUint64(4,BigInt(sequence));const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:bytes(this.transcript)},this.sendKey,bytes(JSON.stringify(value)));const packet=new Uint8Array(8+ciphertext.byteLength);new DataView(packet.buffer).setBigUint64(0,BigInt(sequence));packet.set(new Uint8Array(ciphertext),8);return packet.buffer;}
 async open(packet:ArrayBuffer){if(packet.byteLength<24||packet.byteLength>70000)throw Error('Неверный зашифрованный пакет.');const sequence=Number(new DataView(packet).getBigUint64(0));if(!Number.isSafeInteger(sequence)||sequence!==this.received+1)throw Error('Повтор или нарушение порядка сообщений.');const iv=new Uint8Array(12);new DataView(iv.buffer).setBigUint64(4,BigInt(sequence));const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:bytes(this.transcript)},this.receiveKey,packet.slice(8));this.received=sequence;return JSON.parse(new TextDecoder().decode(raw));}
}
export async function establish(local:{hello:Hello;privateKey:CryptoKey},remote:Hello,role:'host'|'guest',secret:string){
 validateHello(remote);const transcript=canonical({protocol:'phosphorea-sync/1',host:role==='host'?local.hello:remote,guest:role==='guest'?local.hello:remote});
 const publicKey=await crypto.subtle.importKey('jwk',remote.ephemeral,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const shared=await crypto.subtle.deriveBits({name:'ECDH',public:publicKey},local.privateKey,256),material=await crypto.subtle.importKey('raw',shared,'HKDF',false,['deriveKey','deriveBits']);
 const salt=await crypto.subtle.digest('SHA-256',bytes(secret+'|'+transcript));
 const key=async(direction:string)=>crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt,info:bytes('phosphorea-sync/1/'+direction)},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 const sas=new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info:bytes('phosphorea-sync/1/sas')},material,48));
 const channel=new SecureChannel(await key(role==='host'?'host-to-guest':'guest-to-host'),await key(role==='host'?'guest-to-host':'host-to-guest'),transcript,[...sas].map(b=>EMOJI[b&63]));
 return channel;
}
export async function sign(identity:Identity,transcript:string){return b64(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},identity.privateKey,bytes(transcript))));}
export async function verify(publicKey:JsonWebKey,transcript:string,signature:string){const key=await crypto.subtle.importKey('jwk',publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,unb64(signature) as BufferSource,bytes(transcript)))throw Error('Подпись устройства не прошла проверку.');}
