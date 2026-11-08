import {brand,text,smooth} from '../engine.js';
export default function(c,t){c.fillStyle='#000000';c.fillRect(-4000,-4000,10000,10000);brand(c,960,400,230);c.save();c.globalAlpha=smooth(t/1.25);text(c,'Phosphorea',960,620,86,'#f1f5f1',500,'center');c.globalAlpha=smooth((t-1.6)/1.7);text(c,'By Svyatoslav Podolskii',960,725,27,'#a9a9a9',400,'center');c.restore();}
