import {afterEach,describe,it,expect,vi} from 'vitest';
import {transientUndo} from '../src/ui/transient-undo';

afterEach(()=>vi.useRealTimers());
describe('transient relationship Undo',()=>{
 it('expires 3.2 seconds after the mutation without needing another render',()=>{
  vi.useFakeTimers();const changed=vi.fn(),toast=transientUndo(changed);
  toast.show('create');vi.advanceTimersByTime(3199);expect(changed).toHaveBeenLastCalledWith('create');
  vi.advanceTimersByTime(1);expect(changed).toHaveBeenLastCalledWith(null);
 });
 it('replaces the deadline only for a new mutation',()=>{
  vi.useFakeTimers();const changed=vi.fn(),toast=transientUndo(changed);
  toast.show('create');vi.advanceTimersByTime(6000);toast.show('break');
  vi.advanceTimersByTime(2000);expect(changed).toHaveBeenLastCalledWith('break');
  vi.advanceTimersByTime(6000);expect(changed).toHaveBeenLastCalledWith(null);
 });
 it('dismissal and disposal clear pending callbacks',()=>{
  vi.useFakeTimers();const changed=vi.fn(),toast=transientUndo(changed);
  toast.show('create');toast.dismiss();expect(changed).toHaveBeenLastCalledWith(null);
  expect(vi.getTimerCount()).toBe(0);toast.show('edit');toast.dispose();changed.mockClear();
  vi.advanceTimersByTime(10000);expect(changed).not.toHaveBeenCalled();
 });
});
