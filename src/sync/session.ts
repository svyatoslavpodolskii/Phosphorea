import {Peer,type DataConnection} from 'peerjs';
import type {SQLiteAdapter} from '../storage/adapter';
import type {Core} from '../core/core';
import {identity,createHello,validateHello,establish,fingerprint,peerId,sign,verify,hash,bytes,b64,unb64,invitationUrl,type Identity,type Invitation,type Hello,type SecureChannel} from './crypto';
import {validateWorkspaces,type SyncWorkspace} from './workspaces';
export interface TrustedDevice {id:string;name:string;scope:string;publicKey:JsonWebKey;pairedAt:string;lastSync?:string;mapping?:Record<string,string>;outgoing?:string[];incoming?:string[]}
export interface SyncStatus {phase:'idle'|'starting'|'ready'|'connecting'|'verify'|'waiting'|'syncing'|'done'|'error';message:string;invite?:string;emojis?:string[];remoteName?:string;progress?:number;devices:TrustedDevice[];conflicts:number;workspaces:SyncWorkspace[];selected:string[];remoteWorkspaces:SyncWorkspace[];remoteSelected:string[]}
const LIMIT=64*1024*1024,CHUNK=18000;
export class SyncSession {
 private peer?:Peer;private connection?:DataConnection;private me?:Identity;private name='Устройство';private alive=true;private invite?:Invitation;private invitationId='';private authorized=false;private localConfirmed=false;private remoteConfirmed=false;private proved=false;private channel?:SecureChannel;private remote?:Hello;private remoteId='';private local?:Awaited<ReturnType<typeof createHello>>;private role:'host'|'guest'='host';private expected='';private secret='';private receiveQueue=Promise.resolve();private sendQueue=Promise.resolve();private handshakeTimer?:ReturnType<typeof setTimeout>;private transferTimer?:ReturnType<typeof setTimeout>;private incoming?:{id:string;size:number;hash:string;parts:Uint8Array[];received:number;index:number};private sending=false;private syncId='';private applied=false;private acknowledged=false;private trusted:TrustedDevice[]=[];
 status:SyncStatus={phase:'idle',message:'',devices:[],conflicts:0,workspaces:[],selected:[],remoteWorkspaces:[],remoteSelected:[]};
 constructor(private core:Core,private changed:(state:SyncStatus)=>void){}
 private get storage(){return this.core.storage as SQLiteAdapter;}
 private publish(patch:Partial<SyncStatus>){if(!this.alive)return;this.status={...this.status,...patch};this.changed({...this.status});}
 private trustKey(){return 'sync:trusted:'+this.me!.id;}
 private scope='';private manifestReceived=false;
 private remoteCommit='';private localCommitted=false;private helloRevealed=false;
 private revealHello(){if(this.localCommitted&&this.remoteCommit&&!this.helloRevealed&&this.connection?.open&&this.local){this.helloRevealed=true;this.connection.send(JSON.stringify({t:'hello',hello:this.local.hello}));}}
 async start(){
  this.publish({phase:'starting',message:'Готовим защищённое соединение…'});
  try{
   this.me=await identity();this.name=await this.storage.syncGetGlobal<string>('sync:device-name')||await this.storage.getSetting<string>('sync:device-name')||(/Android|iPhone|iPad/.test(navigator.userAgent)?'Телефон':'Компьютер');
   this.scope=await this.storage.getSetting<string>('sync:scope-id')||crypto.randomUUID();await this.storage.transaction([{kind:'setting',key:'sync:scope-id',value:this.scope}]);
   this.trusted=await this.storage.syncGetGlobal<TrustedDevice[]>(this.trustKey())||await this.storage.getSetting<TrustedDevice[]>(this.trustKey())||[];const workspaces=await this.storage.syncWorkspaces();this.publish({workspaces,selected:workspaces.map(w=>w.id)});await this.refreshConflicts();if(!this.alive)return;
   // Production uses the same public PeerServer rendezvous as vmeste. Notes never enter it.
   const signal=import.meta.env.VITE_SYNC_SIGNALING as string|undefined;const url=signal?new URL(signal):null;
   this.peer=new Peer(peerId(this.me.id),{debug:0,...(url?{host:url.hostname,port:Number(url.port)||(url.protocol==='https:'?443:80),path:url.pathname,secure:url.protocol==='https:',...(['127.0.0.1','localhost'].includes(url.hostname)?{config:{iceServers:[]}}:{})}:{})});
   this.peer.on('open',()=>void this.ready());this.peer.on('connection',c=>{if(this.connection){c.close();return;}this.attach(c,'host');});
   this.peer.on('error',e=>this.fail(e.type==='unavailable-id'?'Подключение уже открыто в другом окне этого браузера.':e.type==='peer-unavailable'?'Устройство не в сети. Откройте «Устройства» на нём и повторите.':'Не удалось установить соединение. Проверьте интернет; некоторые сети блокируют WebRTC.'));
   this.peer.on('disconnected',()=>{if(!this.connection?.open)this.fail('Служба подключения недоступна. Закройте окно и попробуйте снова.');});
  }catch(e){this.fail((e as Error).message);}
 }
 private async ready(){if(!this.alive||!this.me)return;this.invite={v:1,peer:peerId(this.me.id),key:this.me.id,secret:b64(crypto.getRandomValues(new Uint8Array(32))),expires:Date.now()+10*60_000};this.invitationId=await hash(bytes(this.invite.secret));this.publish({phase:'ready',message:'Покажите QR другому своему устройству.',invite:invitationUrl(this.invite),devices:this.trusted});}
 async selectWorkspaces(ids:string[]){if(this.connection)throw Error('Сначала завершите соединение.');if(!ids.length||ids.some(id=>!this.status.workspaces.some(w=>w.id===id)))throw Error('Выберите хотя бы одно хранилище.');this.publish({selected:[...new Set(ids)]});}
 async setName(name:string){this.name=name.trim().slice(0,80)||'Устройство';await this.storage.syncSetGlobal('sync:device-name',this.name);}
 async connect(invite:Invitation){if(!this.peer?.open)throw Error('Дождитесь готовности подключения.');if(invite.key===this.me?.id)throw Error('Это QR этого же устройства. Откройте его на другом.');this.expected=invite.key;this.secret=invite.secret;const id=await hash(bytes(invite.secret));this.attach(this.peer.connect(invite.peer,{reliable:true,serialization:'raw'}),'guest',id);}
 reconnect(device:TrustedDevice){if(!this.peer?.open)throw Error('Дождитесь готовности подключения.');this.expected=device.id;this.secret='';this.attach(this.peer.connect(peerId(device.id),{reliable:true,serialization:'raw'}),'guest');}
 private attach(c:DataConnection,role:'host'|'guest',inviteId=''){
  if(this.connection){c.close();return;}this.connection=c;this.role=role;this.authorized=false;this.manifestReceived=false;this.localConfirmed=false;this.remoteConfirmed=false;this.proved=false;this.channel=undefined;this.remote=undefined;this.remoteCommit='';this.localCommitted=false;this.helloRevealed=false;this.syncId='';this.applied=false;this.acknowledged=false;
  this.publish({phase:'connecting',message:'Проверяем ключи устройства…',emojis:undefined,progress:undefined});
  this.handshakeTimer=setTimeout(()=>this.fail('Не удалось подключиться. Покажите новый QR и попробуйте снова.'),15_000);
  const helloReady=createHello(this.me!,this.name,inviteId,this.scope).then(local=>{if(this.connection===c)this.local=local;return local;});
  c.on('open',()=>{void helloReady.then(async local=>{const commit=await hash(bytes(JSON.stringify(local.hello)));if(this.alive&&this.connection===c){c.send(JSON.stringify({t:'commit',commit}));this.localCommitted=true;this.revealHello();}}).catch(e=>{if(this.connection===c)this.fail(e.message);});});
  c.on('data',data=>{this.receiveQueue=this.receiveQueue.then(async()=>{await helloReady;if(this.connection===c)await this.receive(data,c);}).catch(e=>{if(this.connection===c)this.fail(e instanceof DOMException?'Не удалось проверить ключи или QR. Подключение отменено.':e.message||'Проверка защищённого соединения не пройдена.');});});
  c.on('error',()=>this.fail('Соединение прервано. Ваши данные сохранены на устройстве.'));
  c.on('close',()=>{if(!this.alive||this.connection!==c)return;if(this.status.phase==='done'){this.disconnect();void this.ready();}else if(this.status.phase!=='error')this.fail('Устройство отключилось. Незавершённая передача не заменяет данные.');});
 }
 private async receive(data:unknown,connection:DataConnection){
  const current=()=>{if(!this.alive||this.connection!==connection)throw Error('Соединение закрыто.');};
  if(!this.alive||!this.connection)return;
  if(typeof data==='string'){
   if(data.length>4000||this.remote)throw Error('Неверный запрос подключения.');const msg=JSON.parse(data);
   if(msg.t==='commit'){if(this.remoteCommit||typeof msg.commit!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(msg.commit))throw Error('Некорректное обязательство ключа.');this.remoteCommit=msg.commit;this.revealHello();return;}
   if(msg.t!=='hello'||!this.remoteCommit||!this.localCommitted)throw Error('Ключ раскрыт до взаимного обязательства.');validateHello(msg.hello);const commitment=await hash(bytes(JSON.stringify(msg.hello)));current();if(commitment!==this.remoteCommit)throw Error('Ключ устройства подменён.');this.remote=msg.hello;const remoteId=await fingerprint(this.remote!.identity);current();this.remoteId=remoteId;
   if(this.connection.peer!==peerId(this.remoteId))throw Error('Ключ устройства не соответствует адресу.');
   if(this.role==='guest'&&this.remoteId!==this.expected)throw Error('Ключ устройства изменился. Подключение отменено.');
   const trusted=this.trusted.find(d=>d.id===this.remoteId);
   if(this.role==='host'){
    const invitation=this.remote!.invite&&this.invite&&this.invite.expires>Date.now()&&this.remote!.invite===this.invitationId;
    if(!trusted&&!invitation)throw Error('Для нового устройства нужен действующий QR или ссылка.');
    this.secret=invitation?this.invite!.secret:'';
   }
   // The open callback creates the hello before the remote can answer it.
   if(!this.local)throw Error('Подключение ещё не готово. Повторите.');
   const channel=await establish(this.local,this.remote!,this.role,this.secret);current();this.channel=channel;
   const signature=await sign(this.me!,channel.transcript);current();this.localConfirmed=false;await this.send({t:'proof',signature});current();
   this.publish({remoteName:this.remote!.name||'Другое устройство'});return;
  }
  const packet=data instanceof ArrayBuffer?data:data instanceof Uint8Array?data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength):null;
  if(!packet||!this.channel)throw Error('Данные пришли до проверки ключей.');const msg=await this.channel.open(packet as ArrayBuffer);current();
  if(msg.t==='proof'){
   if(this.proved||typeof msg.signature!=='string'||msg.signature.length>200)throw Error('Неверное подтверждение ключа.');await verify(this.remote!.identity,this.channel.transcript,msg.signature);current();this.proved=true;
   clearTimeout(this.handshakeTimer);this.handshakeTimer=setTimeout(()=>this.fail('Подтверждение не завершено. Покажите новый QR и попробуйте снова.'),120_000);
   await this.send({t:'manifest',workspaces:this.status.workspaces,selected:this.status.selected});return;
  }
  if(msg.t==='manifest'){
   if(!this.proved||this.manifestReceived)throw Error('Проверка списка хранилищ не пройдена.');validateWorkspaces(msg.workspaces);
   if(!Array.isArray(msg.selected)||!msg.selected.length||new Set(msg.selected).size!==msg.selected.length||msg.selected.some((id:unknown)=>typeof id!=='string'||!msg.workspaces.some((w:SyncWorkspace)=>w.id===id)))throw Error('Проверка списка хранилищ не пройдена.');
   this.manifestReceived=true;this.publish({remoteWorkspaces:msg.workspaces,remoteSelected:msg.selected});
   const trusted=this.trusted.find(d=>d.id===this.remoteId),incoming=msg.workspaces.filter((w:SyncWorkspace)=>msg.selected.includes(w.id)).map((w:SyncWorkspace)=>w.scope),outgoing=this.status.workspaces.filter(w=>this.status.selected.includes(w.id)).map(w=>w.scope);
   const unchanged=trusted?.incoming&&incoming.every((scope:string)=>trusted.incoming!.includes(scope))&&outgoing.every(scope=>trusted.outgoing?.includes(scope));
   const empty=!this.status.workspaces.some(w=>w.hasData);
   this.localConfirmed=Boolean(unchanged||empty);
   this.publish({phase:this.localConfirmed?'waiting':'verify',message:empty?'Подтвердите на устройстве с дневником.':this.localConfirmed?'Проверяем разрешённые хранилища…':'Сравните эмодзи и разрешите обмен хранилищами.',emojis:this.channel!.emojis});
   if(this.localConfirmed)await this.send({t:'confirm'});await this.maybeAuthorized();return;
  }
  if(!this.proved)throw Error('Подпись устройства ещё не подтверждена.');
  if(msg.t==='confirm'){if(!this.manifestReceived)throw Error('Проверка списка хранилищ не пройдена.');this.remoteConfirmed=true;await this.maybeAuthorized();return;}
  if(!this.authorized)throw Error('Передача заметок до подтверждения запрещена.');
  if(msg.t==='start'){
   if(this.status.phase==='done')void this.sync().catch(e=>this.fail(e.message));
   if(this.incoming||typeof msg.id!=='string'||msg.id.length>60||!Number.isSafeInteger(msg.size)||msg.size<2||msg.size>LIMIT||typeof msg.hash!=='string'||msg.hash.length!==43)throw Error('Некорректный размер карты.');
   this.incoming={id:msg.id,size:msg.size,hash:msg.hash,parts:[],received:0,index:0};this.applied=false;this.publish({phase:'syncing',message:'Получаем изменения…',progress:0});this.armTransfer();return;
  }
  if(msg.t==='chunk'){
   const s=this.incoming;if(!s||msg.id!==s.id||msg.index!==s.index++||typeof msg.data!=='string'||msg.data.length>CHUNK*1.5)throw Error('Нарушен порядок передачи.');const part=unb64(msg.data);s.received+=part.length;if(part.length>CHUNK||s.received>s.size)throw Error('Карта превышает заявленный размер.');s.parts.push(part);this.publish({progress:Math.round(s.received/s.size*100)});this.armTransfer();return;
  }
  if(msg.t==='end'){
   const s=this.incoming;if(!s||msg.id!==s.id||s.received!==s.size)throw Error('Передача карты не завершена.');const raw=new Uint8Array(s.size);let offset=0;for(const part of s.parts){raw.set(part,offset);offset+=part.length;}
   if(await hash(raw)!==s.hash)throw Error('Переданные данные повреждены.');const envelope=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));if(envelope.format!=='phosphorea-sync'||envelope.version!==1)throw Error('Неизвестная версия синхронизации.');
   if(!Array.isArray(envelope.workspaces))throw Error('Проверка списка хранилищ не пройдена.');const approved=this.status.remoteWorkspaces.filter(w=>this.status.remoteSelected.includes(w.id)),device=this.trusted.find(d=>d.id===this.remoteId)!;const result=await this.storage.syncApplyWorkspaces(envelope.workspaces,approved,device.mapping||{});device.mapping=result.mapping;await this.saveTrust();await this.core.refresh();this.core.emit('preferences:plugin-setting',{plugin:'builtin.templates',key:'catalog'});this.incoming=undefined;this.applied=true;this.publish({conflicts:result.conflicts});await this.send({t:'ack',id:s.id});await this.finish();return;
  }
  if(msg.t==='ack'){if(msg.id!==this.syncId)throw Error('Неверное подтверждение передачи.');this.acknowledged=true;await this.finish();return;}
  throw Error('Неизвестное сообщение синхронизации.');
 }
 private armTransfer(){clearTimeout(this.transferTimer);this.transferTimer=setTimeout(()=>this.fail('Передача остановилась. Сохранённые версии не потеряны; повторите синхронизацию.'),60_000);}
 async confirm(){if(!this.proved||!this.channel||!this.manifestReceived)return;this.localConfirmed=true;this.publish({phase:'waiting',message:'Ждём подтверждения на втором экране…'});await this.send({t:'confirm'});await this.maybeAuthorized();}
 private async maybeAuthorized(){if(!this.localConfirmed||!this.remoteConfirmed||!this.proved||this.authorized)return;this.authorized=true;this.invite=undefined;this.invitationId='';clearTimeout(this.handshakeTimer);
  const prior=this.trusted.find(d=>d.id===this.remoteId);const mapping={...prior?.mapping};const current=(await this.storage.workspaces()).current;const remoteCurrent=this.status.remoteWorkspaces.find(w=>w.scope===this.remote!.scope);if(!prior&&remoteCurrent&&this.status.remoteSelected.includes(remoteCurrent.id)&&this.status.selected.includes(current)&&!this.status.workspaces.some(w=>w.scope===remoteCurrent.scope))mapping[remoteCurrent.scope]=current;
  const entry:TrustedDevice={id:this.remoteId,name:this.remote!.name,scope:this.remote!.scope,publicKey:this.remote!.identity,pairedAt:prior?.pairedAt||new Date().toISOString(),mapping,outgoing:this.status.workspaces.filter(w=>this.status.selected.includes(w.id)).map(w=>w.scope),incoming:this.status.remoteWorkspaces.filter(w=>this.status.remoteSelected.includes(w.id)).map(w=>w.scope)};this.trusted=[...this.trusted.filter(d=>d.id!==entry.id),entry].slice(-32);await this.saveTrust();void this.sync().catch(e=>this.fail(e.message));
 }
 private async saveTrust(){await this.storage.syncSetGlobal(this.trustKey(),this.trusted);this.publish({devices:this.trusted});}
 async forget(id:string){this.trusted=this.trusted.filter(d=>d.id!==id);await this.saveTrust();if(id===this.remoteId)this.disconnect();}
 private send(msg:unknown){const next=this.sendQueue.then(async()=>{if(!this.alive||!this.connection?.open||!this.channel)throw Error('Соединение закрыто.');const c=this.connection;
   const start=Date.now();while(c.dataChannel?.bufferedAmount>256000){if(!this.alive||!c.open||Date.now()-start>15000)throw Error('Соединение не успевает принимать данные.');await new Promise(r=>setTimeout(r,20));}c.send(await this.channel!.seal(msg));});this.sendQueue=next.catch(()=>{});return next;}
 async sync(){if(!this.authorized||this.sending)return;this.sending=true;this.applied=false;this.acknowledged=false;this.syncId=crypto.randomUUID();this.publish({phase:'syncing',message:'Сверяем обе карты…',progress:0});this.armTransfer();
  try{const workspaces=await this.storage.syncExportWorkspaces(this.status.selected),raw=bytes(JSON.stringify({format:'phosphorea-sync',version:1,workspaces}));if(raw.length>LIMIT)throw Error('Карта больше 64 МБ. Используйте полную резервную копию для переноса.');const id=this.syncId;await this.send({t:'start',id,size:raw.length,hash:await hash(raw)});for(let i=0;i<raw.length;i+=CHUNK)await this.send({t:'chunk',id,index:i/CHUNK,data:b64(raw.subarray(i,i+CHUNK))});await this.send({t:'end',id});}
  finally{this.sending=false;}
 }
 private async finish(){if(!this.applied||!this.acknowledged)return;clearTimeout(this.transferTimer);this.trusted=this.trusted.map(d=>d.id===this.remoteId?{...d,lastSync:new Date().toISOString()}:d);await this.saveTrust();await this.refreshConflicts();this.publish({phase:'done',message:this.status.conflicts?'Изменения получены. Выберите, какие версии оставить.':'Изменения переданы в обе стороны.',progress:100});}
 async refreshConflicts(){const list=await this.storage.syncConflicts();this.publish({conflicts:list.length,devices:this.trusted});return list;}
 disconnect(){this.connection?.removeAllListeners();this.connection?.close();this.connection=undefined;this.channel=undefined;this.incoming=undefined;this.authorized=false;this.receiveQueue=Promise.resolve();this.sendQueue=Promise.resolve();clearTimeout(this.handshakeTimer);clearTimeout(this.transferTimer);}
 private fail(message:string){this.disconnect();this.publish({phase:'error',message,progress:undefined});}
 async reset(){this.disconnect();if(!this.peer?.open){this.peer?.destroy();this.peer=undefined;await this.start();}else await this.ready();}
 destroy(){this.alive=false;this.disconnect();this.peer?.destroy();}
}
