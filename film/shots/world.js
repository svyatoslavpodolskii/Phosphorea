import {universe} from '../universe.js';
import {smooth,mix} from '../engine.js';
export default function(c,t,s){c.fillStyle='#000000';c.fillRect(-4000,-4000,10000,10000);const p=t/s.duration,z=1.8*Math.exp(-p*1.28),fade=1-smooth((t-(s.duration-1.6))/1.6);universe(c,z,fade*smooth(t/.35));}
