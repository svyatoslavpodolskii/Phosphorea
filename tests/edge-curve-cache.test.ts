import {it,expect} from 'vitest';
import {EdgeCurves,edgeCurve} from '../src/graph/edge-curve';
it('reuses world curves on camera frames and invalidates when either endpoint moves or resizes',()=>{
 const cache=new EdgeCurves(),link={},a={x:0,y:0,radius:20},b={x:150,y:80,radius:25};
 const first=cache.get(link,a,b);expect(cache.get(link,{...a},{...b})).toBe(first);
 a.x=15;expect(cache.get(link,a,b)).toEqual(edgeCurve(a,b));expect(cache.get(link,a,b)).not.toBe(first);
 b.radius=40;expect(cache.get(link,a,b)).toEqual(edgeCurve(a,b));
 b.x=a.x;b.y=a.y;expect(cache.get(link,a,b)).toBeNull();
});
