import {it,expect,vi} from 'vitest';
import {CameraFrames} from '../src/graph/camera-frames';
it('publishes immutable camera frames without repeated notifications and releases subscribers',()=>{
 const frames=new CameraFrames(),listener=vi.fn(),camera={x:0,y:0,zoom:1},viewport={width:390,height:844};
 const off=frames.subscribe(listener);frames.publish(camera,viewport);frames.publish({...camera},{...viewport});
 expect(listener).toHaveBeenCalledTimes(1);camera.x=42;expect(frames.current!.camera.x).toBe(0);
 frames.publish(camera,viewport);expect(listener).toHaveBeenCalledTimes(2);
 off();frames.publish({...camera,zoom:2},viewport);expect(listener).toHaveBeenCalledTimes(2);
 const late=vi.fn();frames.subscribe(late);expect(late).toHaveBeenCalledWith(frames.current);
});
