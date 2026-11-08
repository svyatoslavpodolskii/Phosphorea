export interface ThemeBase {background:string;accent:string;tint:string;contrast?:number}
export type Pattern='none'|'daisies'|'stars'|'fireflies'|'night-sky';
export type BackgroundMode='static'|'world'|'parallax';
export interface ThemeEffects {pattern:Pattern;grain:number;density:number;strength:number;mode?:BackgroundMode}
export interface Theme {id:string;name:string;dark:boolean;base:ThemeBase;effects:ThemeEffects;colors:Record<'background'|'surface'|'surfaceAlt'|'text'|'muted'|'border'|'accent'|'onAccent'|'edge'|'grid'|'danger'|'warning'|'shadow',string>}
const channels=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
export function mix(a:string,b:string,amount:number){const x=channels(a),y=channels(b);return '#'+x.map((n,i)=>Math.round(n+(y[i]-n)*amount).toString(16).padStart(2,'0')).join('');}
export function luminance(hex:string){const c=channels(hex).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
export function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function readable(color:string,backgrounds:string[],minimum=4.5){const score=(c:string)=>Math.min(...backgrounds.map(bg=>contrast(c,bg)));if(score(color)>=minimum)return color;const end=score('#ffffff')>score('#000000')?'#ffffff':'#000000';for(let i=1;i<=100;i++){const c=mix(color,end,i/100);if(score(c)>=minimum)return c;}return end;}
export function createTheme(id:string,name:string,base:ThemeBase,effects:Partial<ThemeEffects>={}):Theme{
 const {background,tint}=base;const dark=luminance(background)<.179;const ink=dark?'#ffffff':'#000000',opposite=dark?'#000000':'#ffffff';
 const surfaceAt=(n:number)=>{let c=mix(mix(background,tint,.035),dark?ink:opposite,n);for(let i=0;contrast(ink,c)<4.8&&i<100;i++)c=mix(c,opposite,.025);return c;};
 const surface=surfaceAt(dark?.035:.55),surfaceAlt=surfaceAt(dark?.075:.28),backgrounds=[background,surface,surfaceAlt];
 const text=readable(mix(ink,tint,.09),backgrounds),muted=readable(mix(text,background,.35),backgrounds,base.contrast===1?7:4.5),accent=readable(base.accent,backgrounds);
 return{id,name,base:{...base},dark,effects:{pattern:'none',grain:0,density:.45,strength:.2,...effects,mode:effects.mode??'static'},colors:{background,surface,surfaceAlt,text,muted,accent,onAccent:readable(ink,[accent],base.contrast===1?7:4.5),border:mix(background,text,base.contrast===1?.55:.26),edge:mix(background,text,base.contrast===1?.8:.42),grid:mix(background,text,.12),danger:readable(mix('#d95365',tint,.15),backgrounds),warning:readable(mix('#b98529',tint,.12),backgrounds),shadow:mix('#000000',tint,.08)}};
}
export const THEMES:Theme[]=[
 createTheme('phosphor','Фосфор',{background:'#101b1a',accent:'#b4ecc1',tint:'#68a483'},{pattern:'fireflies',strength:.13}),
 createTheme('dark-contrast','Тёмная контрастная',{background:'#080a0d',accent:'#a9d7ff',tint:'#9baabc'}),
 createTheme('light-contrast','Светлая контрастная',{background:'#ffffff',accent:'#174c83',tint:'#798ba0'}),
 createTheme('soft-dark','Мягкая тёмная',{background:'#25282d',accent:'#bad5c8',tint:'#9baaa3'}),
 createTheme('soft-light','Мягкая светлая',{background:'#eeeae2',accent:'#486655',tint:'#b4a48f'}),
 createTheme('dark','Тёмная',{background:'#111216',accent:'#c2cbff',tint:'#7a86ad'}),
 createTheme('light','Светлая',{background:'#f6f5f0',accent:'#246e4b',tint:'#88a17e'}),
 createTheme('neon','Неон',{background:'#0c0a19',accent:'#da9dff',tint:'#9a66d4'},{pattern:'none',strength:.2}),
 createTheme('paper','Бумага',{background:'#f5eddd',accent:'#663c24',tint:'#c1a779'},{grain:.10}),
 createTheme('meadow','Ромашки',{background:'#aebc9b',accent:'#35573b',tint:'#e5bd65'},{pattern:'daisies',grain:.15,strength:.65,density:.35}),
 createTheme('midnight','Сказочные звёзды',{background:'#10192b',accent:'#e7cb85',tint:'#7e9dc8'},{pattern:'stars',grain:.12,strength:.32,density:.3}),
];
for(const [id,name,base,pattern] of [
 ['ink','Чёрный бархат',{background:'#020304',accent:'#ffffff',tint:'#aebed0'},'none'],
 ['chalk','Чистый свет',{background:'#ffffff',accent:'#122b50',tint:'#455b78'},'none'],
 ['paper-contrast','Бумага · чёткая',{background:'#fff7e7',accent:'#392817',tint:'#9c7846'},'none'],
 ['meadow-contrast','Ромашки · чёткие',{background:'#f1f5de',accent:'#183d25',tint:'#e3b63d'},'daisies'],
 ] as const){const t=createTheme(id,name,{...base,contrast:1},{pattern,strength:.22,grain:0});THEMES.push(t);}
THEMES.push(createTheme('observatory','Звёздная ночь',{background:'#060b16',accent:'#aec8e8',tint:'#557eaf'},{pattern:'night-sky',strength:.75,grain:.08,density:.6}));
const hex=(v:unknown):v is string=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
export function validateTheme(value:unknown):Theme{
 const t=value as Partial<Theme>;if(!t||typeof t.id!=='string'||!/^[-a-z0-9]{1,80}$/.test(t.id)||typeof t.name!=='string'||!t.name.trim()||t.name.length>60)throw Error('Некорректный файл темы.');
 if(t.colors&&Object.values(t.colors).some(c=>!hex(c)))throw Error('В теме нужны цвета в формате #RRGGBB.');
 const base=t.base||{background:t.colors?.background,accent:t.colors?.accent,tint:t.colors?.surface,contrast:undefined};if(!hex(base.background)||!hex(base.accent)||!hex(base.tint))throw Error('Укажите три базовых цвета темы в формате #RRGGBB.');
 if(base.contrast!==undefined&&base.contrast!==0&&base.contrast!==1)throw Error('Некорректный контраст темы.');
 const e=t.effects;if(e!==undefined&&(!e||!['none','daisies','stars','fireflies','night-sky'].includes(e.pattern)||(e.mode!==undefined&&!['static','world','parallax'].includes(e.mode))||[e.grain,e.density,e.strength].some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1)))throw Error('Некорректные параметры фона.');
 return createTheme(t.id,t.name.trim(),base as ThemeBase,e);
}
export function parseTheme(text:string){if(text.length>16000)throw Error('Файл темы слишком большой.');const input=JSON.parse(text);if(input.format!=='phosphored-theme'||![1,2].includes(input.version))throw Error('Выберите файл темы Phosphorea.');const theme=validateTheme(input.theme);return validateTheme({...theme,id:theme.id.startsWith('custom-')?theme.id:'custom-'+theme.id});}
export function themeFile(value:Theme){const theme=validateTheme(value);return JSON.stringify({format:'phosphored-theme',version:2,theme:{id:theme.id,name:theme.name,base:theme.base,effects:theme.effects}},null,2);}
export function currentTheme(id:string,custom:Theme[]=[]){return custom.find(t=>t.id===id)||THEMES.find(t=>t.id===id)||THEMES[0];}
/** Disambiguate display names without rewriting a user's imported theme data. */
export function themeNames(themes:Theme[]){const used=new Set<string>(),names=new Map<string,string>();for(const theme of themes){const base=theme.name.trim();let name=base,index=2;while(used.has(name.toLocaleLowerCase('ru-RU')))name=`${base} · ${index++}`;used.add(name.toLocaleLowerCase('ru-RU'));names.set(theme.id,name);}return names;}
const svgUrl=(body:string)=>`url("data:image/svg+xml,${encodeURIComponent(body)}")`;
export interface Decoration {x:number;y:number;size:number;rotation:number;phase:number;duration:number;opacity:number}
export function decorations(pattern:Pattern,width:number,height:number,density:number):Decoration[]{
 let seed=91723+[...pattern].reduce((n,c)=>n+c.charCodeAt(0),0);const random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 const night=pattern==='night-sky';const count=Math.min(night?240:64,Math.round(width*height/(night?9500:42000)*(.35+density)));const items:Decoration[]=[];
 for(let attempt=0;items.length<count&&attempt<count*30;attempt++){const x=random()*width,y=random()*height;const center=x>width*.3&&x<width*.7&&y>height*.23&&y<height*.7;if(center&&random()>.12)continue;const size=night?.5+random()**3*1.4:pattern==='fireflies'?1+random()*2:pattern==='stars'?3+random()**2*10:9+random()**2*24;if(items.some(p=>Math.hypot(p.x-x,p.y-y)<(p.size+size)*(night?4:1.7)+12))continue;items.push({x,y,size,rotation:random()*360,phase:random()*-20,duration:(pattern==='daisies'?13:4)+random()*10,opacity:.45+random()*.55});}return items;
}
export function decorationShape(theme:Theme){const pattern=theme.effects.pattern;if(pattern==='daisies'){let petals='';for(let j=0;j<10;j++)petals+=`<ellipse cx="0" cy="-.57" rx=".18" ry=".43" transform="rotate(${j*36})" fill="${mix('#ffffff',theme.base.tint,.12)}"/>`;return petals+`<circle r=".23" fill="${theme.base.tint}"/><circle cx="-.06" cy="-.06" r=".08" fill="${mix(theme.base.tint,'#ffffff',.3)}"/>`;}
 if(pattern==='stars')return `<path d="M0 -1 .2 -.2 1 0 .2 .2 0 1 -.2 .2 -1 0 -.2 -.2Z" fill="${theme.colors.accent}"/>`;
 return `<circle r="1" fill="${pattern==='night-sky'?mix(theme.colors.text,theme.base.tint,.15):theme.colors.accent}"/>`;
}
export function patternImage(theme:Theme){if(theme.effects.pattern==='none'||theme.effects.strength===0)return 'none';const shapes=decorations(theme.effects.pattern,640,480,theme.effects.density).map(p=>`<g opacity="${p.opacity}" transform="translate(${p.x} ${p.y}) rotate(${p.rotation}) scale(${p.size})">${decorationShape(theme)}</g>`).join('');return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><g opacity="${theme.effects.strength}">${shapes}</g></svg>`);}
let appliedTheme:Theme|undefined;
export const getAppliedTheme=()=>appliedTheme||THEMES[0];
export function grainImage(amount:number){return amount===0?'none':svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".82" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" opacity="${amount*.18}" filter="url(#n)"/></svg>`);}
export function applyTheme(theme:Theme){appliedTheme=theme;const root=document.documentElement;root.dataset.theme=theme.id;root.style.setProperty('--theme-strong',String(theme.base.contrast||0));root.dataset.colorMode=theme.dark?'dark':'light';root.dataset.pattern=theme.effects.pattern;root.style.colorScheme=theme.dark?'dark':'light';for(const [key,value] of Object.entries(theme.colors))root.style.setProperty('--theme-'+key,value);root.style.setProperty('--theme-pattern-image',patternImage(theme));root.style.setProperty('--theme-grain-image',grainImage(theme.effects.grain));document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme.colors.background);window.dispatchEvent(new CustomEvent('phosphora-theme-change',{detail:theme}));}
