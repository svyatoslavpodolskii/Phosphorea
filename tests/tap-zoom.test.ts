import {it,expect} from 'vitest';
import {tapZoom} from '../src/graph/tap-zoom';
it('zooms in during a burst, returns to overview after a pause, and skips a redundant final stop',()=>{
 expect(tapZoom(.4,.4,4,Infinity)).toBe(.8);
 expect(tapZoom(.8,.4,4,700)).toBe(1.6);
 expect(tapZoom(1.6,.4,4,700)).toBe(4);
 expect(tapZoom(1.6,.4,4,1800)).toBeNull();expect(tapZoom(4,.4,4,400)).toBeNull();
 expect(tapZoom(.4,.4,4,1800)).toBe(.8);
});
