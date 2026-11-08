import {PeerServer} from 'peer';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist'),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const peer=PeerServer({port:4311,path:'/sync',allow_discovery:false});
const servers=[];
for(const port of [4312,4313]){const server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,path=resolve(root,'.'+(name==='/'?'/index.html':name));if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}const data=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(port,'127.0.0.1',r));servers.push(server);}
console.log('Sync test peers at 4311; isolated app origins at 4312 and 4313');
process.on('SIGTERM',()=>{for(const s of servers)s.close();peer.close();});
