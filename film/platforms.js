const paths=new Map();
export async function loadPlatformIcons(){
 await Promise.all(['android','apple','linux','googlechrome'].map(async id=>{
  const response=await fetch(`assets/platforms/${id}.svg`);if(!response.ok)throw Error('Platform icon: '+id);
  const doc=new DOMParser().parseFromString(await response.text(),'image/svg+xml');
  paths.set(id,[...doc.querySelectorAll('path')].map(p=>new Path2D(p.getAttribute('d'))));
 }));
}
export function platformIcon(c,id,x,y,size){
 c.save();c.translate(x-size/2,y-size/2);c.scale(size/24,size/24);c.fillStyle='#d4d4d4';
 if(id==='windows'){for(const [a,b] of [[1,1],[13,1],[1,13],[13,13]])c.fillRect(a,b,10,10);}
 else for(const path of paths.get(id)||[])c.fill(path);
 c.restore();
}
