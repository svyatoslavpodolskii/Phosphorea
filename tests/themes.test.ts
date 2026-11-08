import {it,expect} from 'vitest';
import {THEMES,createTheme,contrast,parseTheme,themeFile,patternImage,grainImage,validateTheme} from '../src/core/themes';
it('high-contrast variants retain strong text, edges and their rendering flag through export',()=>{
 for(const id of ['ink','chalk','paper-contrast','meadow-contrast']){const t=THEMES.find(t=>t.id===id)!;expect(t.base.contrast).toBe(1);expect(contrast(t.colors.edge,t.colors.background)).toBeGreaterThan(7);for(const bg of [t.colors.background,t.colors.surface,t.colors.surfaceAlt])expect(contrast(t.colors.muted,bg)).toBeGreaterThanOrEqual(7);expect(parseTheme(themeFile(t)).base.contrast).toBe(1);}
});
it('provides distinct readable contrast and soft presets without changing the default',()=>{
 expect(THEMES[0].id).toBe('phosphor');
 const presets=['dark-contrast','light-contrast','soft-dark','soft-light'].map(id=>THEMES.find(t=>t.id===id)!);
 expect(presets.map(t=>t.name)).toEqual(['Тёмная контрастная','Светлая контрастная','Мягкая тёмная','Мягкая светлая']);
 expect(presets.map(t=>t.dark)).toEqual([true,false,true,false]);
 expect(new Set(presets.map(t=>t.colors.background)).size).toBe(4);
 for(const t of presets){
  for(const bg of [t.colors.background,t.colors.surface,t.colors.surfaceAlt])for(const key of ['text','muted','accent','danger','warning'] as const)expect(contrast(t.colors[key],bg)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(t.colors.onAccent,t.colors.accent)).toBeGreaterThanOrEqual(4.5);
 }
 expect(contrast(presets[0].colors.text,presets[0].colors.background)).toBeGreaterThan(contrast(presets[2].colors.text,presets[2].colors.background));
 expect(contrast(presets[1].colors.text,presets[1].colors.background)).toBeGreaterThan(contrast(presets[3].colors.text,presets[3].colors.background));
});
it('round trips all background modes and defaults older themes to static',()=>{
 for(const mode of ['static','world','parallax'] as const){
  const t=createTheme('motion','Motion',THEMES[0].base,{...THEMES[0].effects,mode});
  expect(parseTheme(themeFile(t)).effects).toEqual(t.effects);
 }
 const legacy={...THEMES[0],effects:{...THEMES[0].effects}};delete legacy.effects.mode;
 expect(validateTheme(legacy).effects.mode).toBe('static');
 expect(parseTheme(themeFile(legacy)).effects.mode).toBe('static');
 for(const mode of ['invalid','World Attached','url(evil)',null,1,{}]){
  const invalid={...THEMES[0],effects:{...THEMES[0].effects,mode}};
  expect(()=>validateTheme(invalid)).toThrow('Некорректные параметры фона.');
  expect(()=>parseTheme(JSON.stringify({format:'phosphored-theme',version:2,theme:invalid}))).toThrow();
 }
 expect(()=>themeFile({...THEMES[0],effects:{...THEMES[0].effects,mode:'invalid' as 'static'}})).toThrow();
});
it('derived text, secondary text and actions stay readable for saturated, dark, light and middle backgrounds',()=>{
 const values=['#000000','#ffffff','#777777','#757575','#ff0000','#00ff00','#0000ff','#ff00ff','#00ffff','#ffff00',...Array.from({length:96},(_,i)=>'#'+((i*17431+87231)%16777216).toString(16).padStart(6,'0'))];
 for(const background of values)for(const accent of ['#000000','#ffffff','#877c88','#ffff00']){const t=createTheme('test','Test',{background,accent,tint:accent});for(const bg of [t.colors.background,t.colors.surface,t.colors.surfaceAlt])for(const key of ['text','muted','accent','danger','warning'] as const)expect(contrast(t.colors[key],bg),`${background} ${accent} ${key} ${bg}`).toBeGreaterThanOrEqual(4.5);expect(contrast(t.colors.onAccent,t.colors.accent)).toBeGreaterThanOrEqual(4.5);}
});
it('migrates the old nine-color format and exports only the three source colors',()=>{
 const old={format:'phosphored-theme',version:1,theme:{id:'legacy',name:'Legacy',dark:false,colors:{background:'#ffffff',surface:'#eeeeee',surfaceAlt:'#dddddd',text:'#aaaaaa',muted:'#bbbbbb',accent:'#eeeeee',border:'#cccccc',edge:'#bbbbbb',grid:'#eeeeee'}}};
 const t=parseTheme(JSON.stringify(old));expect(t.id).toBe('custom-legacy');expect(contrast(t.colors.text,t.colors.background)).toBeGreaterThanOrEqual(4.5);const file=JSON.parse(themeFile(t));expect(file.version).toBe(2);expect(Object.keys(file.theme.base)).toHaveLength(3);expect(file.theme.colors).toBeUndefined();expect(parseTheme(JSON.stringify(file))).toEqual(t);
});
it('persists decoration controls and rejects executable input and invalid effect values',()=>{
 for(const theme of THEMES){const t=parseTheme(themeFile(theme));expect(t.effects).toEqual(theme.effects);expect(t.colors).toEqual(theme.colors);}expect(patternImage(THEMES.find(t=>t.id==='meadow')!)).toContain('data:image/svg+xml');expect(grainImage(.5)).toContain('feTurbulence');expect(grainImage(0)).toBe('none');expect(()=>validateTheme({...THEMES[0],effects:{...THEMES[0].effects,pattern:'url(evil)'}})).toThrow();expect(()=>validateTheme({...THEMES[0],effects:{...THEMES[0].effects,grain:2}})).toThrow();
});
