import {it,expect} from 'vitest';
import {EdgeCurves,edgeCurve} from '../src/graph/edge-curve';
it('routes a long connection around an intermediate body, reuses it on camera frames, and updates after the obstacle moves',()=>{const cache=new EdgeCurves(),a={id:'a',x:0,y:0,radius:20},b={id:'b',x:400,y:0,radius:20},obstacle={id:'middle',x:200,y:0,radius:35},link={};cache.prepare([a,b,obstacle]);const curve=cache.get(link,a,b)!;const middle={x:curve.ax*.25+curve.cx*.5+curve.bx*.25,y:curve.ay*.25+curve.cy*.5+curve.by*.25};expect(Math.hypot(middle.x-obstacle.x,middle.y-obstacle.y)).toBeGreaterThan(obstacle.radius);cache.prepare([a,b,obstacle]);expect(cache.get(link,a,b)).toBe(curve);obstacle.y=250;cache.prepare([a,b,obstacle]);expect(cache.get(link,a,b)).toEqual(edgeCurve(a,b));});
it('reuses world curves on camera frames and invalidates when either endpoint moves or resizes',()=>{
 const cache=new EdgeCurves(),link={},a={x:0,y:0,radius:20},b={x:150,y:80,radius:25};
 const first=cache.get(link,a,b);expect(cache.get(link,{...a},{...b})).toBe(first);
 a.x=15;expect(cache.get(link,a,b)).toEqual(edgeCurve(a,b));expect(cache.get(link,a,b)).not.toBe(first);
 b.radius=40;expect(cache.get(link,a,b)).toEqual(edgeCurve(a,b));
 b.x=a.x;b.y=a.y;expect(cache.get(link,a,b)).toBeNull();
});
