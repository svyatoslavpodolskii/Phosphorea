/** A burst explores inward; after reading the detail, the same gesture goes home. */
export function tapZoom(current:number,overview:number,max:number,elapsed:number){
 if(current>=max*.94||Number.isFinite(elapsed)&&elapsed>1200&&current>overview*1.12)return null;
 const next=Math.min(max,current*2);return next>=max*.72?max:next;
}
