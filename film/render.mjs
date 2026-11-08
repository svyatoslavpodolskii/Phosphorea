import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,extname,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
const root=dirname(fileURLToPath(import.meta.url)),out=resolve(root,'output');await mkdir(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.wav':'audio/wav','.mp3':'audio/mpeg','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),path=resolve(root,'.'+(name==='/'?'/index.html':name));if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}const data=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(4307,'127.0.0.1',r));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1080,height:1990},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
let encoder;
try{
 await page.goto('http://127.0.0.1:4307');await page.evaluate(()=>window.filmReady);const timeline=await page.evaluate(()=>window.timeline);
 if(errors.length)throw Error(errors.join('\n'));
 let frame=0;
 if(process.argv.includes('--stills')){
  const samples=[];for(const s of timeline.shots){const at=s.start+s.duration*.57;await page.evaluate(t=>window.drawTime(t),at);const png=await page.locator('canvas').screenshot();const path=resolve(out,s.id+'.png');await writeFile(path,png);samples.push({id:s.id,time:at,path});}
  for(const [id,offsets] of Object.entries({'02_spawn':[0,.3,2.9],'03_living_drag':[.5,1.65],'08_lasso':[1.55],'14_search':[.85,2.7,4.1],'17_folder_navigation':[.9,3.3],'22_growth':[0,.6,2.4,5.9],'26_world':[.2,4.35,5.99],'27_logo':[0,2.39],'28_end':[.01,4.7],'29_github':[2.2]})){
   const shot=timeline.shots.find(s=>s.id===id);for(const offset of offsets){const at=shot.start+offset;await page.evaluate(t=>window.drawTime(t),at);await writeFile(resolve(out,`check-${id}-${offset}.png`),await page.locator('canvas').screenshot());}
  }
  const seamChecks=await page.evaluate(()=>{const world=window.timeline.shots.find(s=>s.id==='26_world'),logo=window.timeline.shots.find(s=>s.id==='27_logo');const stats=t=>{window.drawTime(t);const d=document.querySelector('canvas').getContext('2d').getImageData(0,0,1080,1920).data;let max=0;for(let i=0;i<d.length;i+=4)max=Math.max(max,d[i],d[i+1],d[i+2]);return max;};return {worldLastMax:stats(world.start+world.duration-1/60),logoFirstMax:stats(logo.start),universeNodes:window.universeNodeCount};});
  if(seamChecks.worldLastMax>1||seamChecks.logoFirstMax!==0)throw Error('Fade to black seam failed '+JSON.stringify(seamChecks));
  await writeFile(resolve(out,'seam-checks.json'),JSON.stringify(seamChecks,null,2));
  await writeFile(resolve(out,'stills.json'),JSON.stringify(samples,null,2));console.log('Rendered',samples.length,'shot proofs.');
 }else{
  const ffmpeg=execFileSync('python',['-c','import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}}).trim();
  const target=resolve(out,'Phosphorea_Kinetic_Film_v8_1080x1920_60fps.mp4');
  // A score rebuild must not truncate audio being read by an active encode.
  const audioSnapshot=resolve(out,'render-audio.wav');await copyFile(resolve(out,'master.wav'),audioSnapshot);
  encoder=spawn(ffmpeg,['-y','-v','error','-f','image2pipe','-vcodec','mjpeg','-framerate',String(timeline.fps),'-i','pipe:0','-i',audioSnapshot,'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-c:a','aac','-b:a','256k','-movflags','+faststart','-shortest','-metadata','title=Phosphorea — от одной мысли до целого мира','-metadata','artist=Svyatoslav Podolskii',target],{stdio:['pipe','inherit','inherit']});
  const completed=once(encoder,'close');encoder.stdin.on('error',()=>{});
  const total=Math.round(timeline.duration*timeline.fps),started=Date.now();
  for(frame=0;frame<total;frame++){
   const jpeg=await page.evaluate(n=>window.drawFrame(n),frame);if(encoder.exitCode!==null)throw Error('Encoder stopped before frame '+frame);if(!encoder.stdin.write(Buffer.from(jpeg,'base64')))await Promise.race([once(encoder.stdin,'drain'),completed.then(([code])=>{throw Error('Encoder stopped while writing: '+code);})]);
   if(frame%300===0)console.log(JSON.stringify({frame,total,seconds:Math.round((Date.now()-started)/1000)}));
  }
  encoder.stdin.end();const [code]=await completed;if(code!==0)throw Error('Encoder exited '+code);
  console.log('Rendered:',target);
 }
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(resolve(out,process.argv.includes('--stills')?'proof-report.json':'render-report.json'),JSON.stringify({width:timeline.width,height:timeline.height,fps:timeline.fps,duration:timeline.duration,frames:frame,errors},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));if(encoder&&!encoder.killed)encoder.kill();}
