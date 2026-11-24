import {describe,it,expect} from 'vitest';
import {FrameMetrics} from '../src/graph/frame-metrics';
describe('local camera timing samples',()=>{
 it('reports preparation separately from presentation cadence',()=>{const m=new FrameMetrics();m.record(10,2,true);m.record(26,3,false);m.record(58,4,true);const s=m.snapshot();expect(s.samples).toBe(3);expect(s.cameraOnlyFrames).toBe(2);expect(s.prepareMs?.median).toBe(3);expect(s.intervalMs?.p95).toBe(32);});
 it('keeps the latest 120 samples and ignores idle time between gestures',()=>{const m=new FrameMetrics();for(let i=0;i<200;i++)m.record(10+i*10,i,i>=80);m.idle();m.record(5000,1,false);const s=m.snapshot();expect(s.samples).toBe(120);expect(s.cameraOnlyFrames).toBe(119);expect(s.intervalMs?.max).toBe(10);expect(s.prepareMs?.max).toBe(199);});
 it('ignores invalid timing samples',()=>{const m=new FrameMetrics();m.record(NaN,1,true);m.record(10,-1,false);expect(m.snapshot().samples).toBe(0);});
});
