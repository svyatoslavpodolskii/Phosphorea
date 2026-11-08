// A strict static host: no Vite fallback, COOP/COEP, or custom SW scope headers.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
createServer(async(req,res)=>{
 try{
  let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  for(const prefix of ['/Different-Repo','/Phosphora','/Phosphorea']){
   if(path===prefix){res.writeHead(301,{Location:prefix+'/'});res.end();return;}
   if(path.startsWith(prefix+'/')){path=path.slice(prefix.length);break;}
  }
  let file=resolve(root,'.'+path);
  if(file!==root&&!file.startsWith(root+sep))throw Error('Invalid path');
  if((await stat(file)).isDirectory())file=resolve(file,'index.html');
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(await readFile(file));
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(4185,'127.0.0.1');
