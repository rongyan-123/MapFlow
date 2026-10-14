import { afterEach, expect, it, vi } from 'vitest';
import { StreamingPresentation } from './streamingPresentation';

afterEach(()=>vi.useRealTimers());

it('paces bursty answer and reasoning without breaking emoji and drains before completion', async()=>{
  vi.useFakeTimers();
  const snapshots:{answer:string;reasoning:string}[]=[];
  const presentation=new StreamingPresentation((answer,process)=>snapshots.push({answer,reasoning:process.filter(event=>event.type==='reasoning').map(event=>event.text).join('')}));
  presentation.reasoning('先分析🌙再回答'.repeat(12));
  presentation.answer('你好👨‍👩‍👧‍👦，这是完整答案。'.repeat(10));
  expect(snapshots).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(80);
  expect(snapshots.length).toBeGreaterThan(0);
  expect(snapshots[snapshots.length-1]!.reasoning.length).toBeGreaterThan(0);
  expect(snapshots[snapshots.length-1]!.reasoning).not.toBe('先分析🌙再回答'.repeat(12));
  const drained=presentation.drain();
  await vi.advanceTimersByTimeAsync(400);
  await drained;
  expect(snapshots[snapshots.length-1]).toEqual({answer:'你好👨‍👩‍👧‍👦，这是完整答案。'.repeat(10),reasoning:'先分析🌙再回答'.repeat(12)});
  expect(snapshots.every(snapshot=>!/[\uD800-\uDBFF]$/.test(snapshot.answer)&&!/[\uD800-\uDBFF]$/.test(snapshot.reasoning))).toBe(true);
});

it('shows tool status immediately and flushes received text on stop without leaking timers',()=>{
  vi.useFakeTimers();const publish=vi.fn();
  const presentation=new StreamingPresentation(publish);
  presentation.reasoning('思考内容');presentation.answer('已收到的正文');
  presentation.tool({type:'tool',name:'read_canvas',state:'started'});
  expect(publish).toHaveBeenCalled();
  expect(publish.mock.calls[publish.mock.calls.length-1]![1]).toContainEqual({type:'tool',name:'read_canvas',state:'started'});
  presentation.flush();presentation.dispose();
  expect(publish.mock.calls[publish.mock.calls.length-1]![0]).toBe('已收到的正文');
  const count=publish.mock.calls.length;vi.advanceTimersByTime(1000);
  expect(publish).toHaveBeenCalledTimes(count);expect(vi.getTimerCount()).toBe(0);
});

it('restores a process snapshot after a lagged stream without duplicating queued reasoning',()=>{
  vi.useFakeTimers();const publish=vi.fn();
  const presentation=new StreamingPresentation(publish);
  presentation.reasoning('old');presentation.answer('answer');
  presentation.restore([{type:'reasoning',text:'restored'},{type:'tool',name:'read_canvas',state:'completed'}]);
  presentation.reasoning(' next');presentation.flush();
  expect(publish.mock.calls[publish.mock.calls.length-1]![0]).toBe('answer');
  expect(publish.mock.calls[publish.mock.calls.length-1]![1]).toEqual([{type:'reasoning',text:'restored'},{type:'tool',name:'read_canvas',state:'completed'},{type:'reasoning',text:' next'}]);
});
