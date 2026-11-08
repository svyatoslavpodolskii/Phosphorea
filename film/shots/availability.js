import {text,smooth} from '../engine.js';
import {platformIcon} from '../platforms.js';
export default function(c,t){c.fillStyle='#000000';c.fillRect(-4000,-4000,10000,10000);c.save();c.globalAlpha=smooth(t/.35);
 text(c,'Уже доступно на GitHub',960,490,54,'#f1f5f1',500,'center');text(c,'Бесплатно',960,590,42,'#b8b8b8',400,'center');
 const platforms=[['android','Android',62],['apple','iOS / macOS',52],['windows','Windows',50],['linux','Linux',56],['googlechrome','ChromeOS',52]];
 platforms.forEach(([id,label,size],i)=>{const x=680+i*140;platformIcon(c,id,x,750,size);text(c,label,x,815,20,'#a5a5a5',400,'center');});
 text(c,'github.com/svyatoslavpodolskii/Phosphorea',960,950,24,'#777777',400,'center');c.restore();}
