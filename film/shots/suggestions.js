import {background,round,text,icon,touch,smooth} from '../engine.js';
export default function(c,t){
 background(c,t);const accepted=smooth((t-1.6)/.65)>.3;
 round(c,525,-40,870,1190,34,'#141414','#454545');
 text(c,'Вечерние мысли',585,75,46,'#eeeeee',600);
 text(c,'Хочу записать новый альбом.',585,240,35);
 text(c,'Собрать идеи для музыки',585,315,35);text(c,'и позвать друзей.',585,380,35);
 round(c,580,490,760,340,26,'#202020','#4a4a4a');text(c,'Связи из текста',625,545,28,'#aaaaaa');
 icon(c,'idea',635,635,30);text(c,'Новый альбом',680,635,35);icon(c,accepted?'check':'link',1270,635,33);
 icon(c,'person',635,750,30);text(c,'Друзья',680,750,35);icon(c,'link',1270,750,30);
 if(t>1.2&&t<2)touch(c,1270,635,t,{alpha:1-smooth((t-1.6)/.4)});
}
