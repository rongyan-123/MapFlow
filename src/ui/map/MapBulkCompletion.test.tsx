import { act,fireEvent,render,screen,waitFor,within } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import MapView from './MapView';
import type { LearningTreeSnapshot } from '../../types/learning';
import type { BatchProgressResult } from '../../domains/maps/types';
import type { SaveBatchProgress } from '../../domains/maps/useBulkNodeCompletion';

beforeEach(()=>vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}}));
afterEach(()=>{localStorage.clear();vi.unstubAllGlobals();});
const snapshot:LearningTreeSnapshot={tree:{id:'tree',topic:'批量进度',title:'批量进度',description:null,difficulty_level:'beginner',total_nodes:3,revision:1,layout_mode:'auto'},
 nodes:['zero','partial','done'].map(id=>({id,tree_id:'tree',title:id,description:null,icon:'code',category:'核心',difficulty:1,estimated_minutes:10,depth_level:0,position_x:0,position_y:0,order_in_level:0,learning_objectives:null,key_concepts:null,recommended_depth:'Understand',depth_rationale:'理解',observable_evidence:'[]'})),
 edges:[],progress:[{node_id:'partial',status:'in_progress',progress_percent:35,evidence:''},{node_id:'done',status:'completed',progress_percent:100,evidence:''}],current_node_id:null};
const lit=[{node_id:'zero',progress_percent:100},{node_id:'partial',progress_percent:100},{node_id:'done',progress_percent:100}];
const original=snapshot.progress.map(item=>({node_id:item.node_id,progress_percent:item.progress_percent!}));
const litSnapshot:LearningTreeSnapshot={...snapshot,progress:lit.map(item=>({...item,status:'completed',evidence:''}))};

it('lights the whole map together with one batch request and restores the original percentages in one undo',async()=>{
 let finish!:(value:BatchProgressResult)=>void;
 const batch=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}))
  .mockResolvedValueOnce({status:'applied',node_progress:[{node_id:'partial',progress_percent:35},{node_id:'done',progress_percent:100}]});
 const single=vi.fn().mockResolvedValue(undefined);
 render(<MapView snapshot={snapshot} displayMode="personal" accountId="owner" entryId="entry"
  onSetCompleted={single} onSetProgress={single} onSetBatchProgress={batch} onCancelBatchProgress={vi.fn()} />);
 fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 await waitFor(()=>expect(batch).toHaveBeenCalledTimes(1));
 expect(batch.mock.calls[0][0]).toEqual([
  {nodeId:'zero',expectedPercent:0,progressPercent:100},
  {nodeId:'partial',expectedPercent:35,progressPercent:100},
 ]);
 expect(single).not.toHaveBeenCalled();
 expect(screen.getByRole('button',{name:'取消等待'})).toBeEnabled();
 expect(screen.getByRole('progressbar',{name:'整体学习进度'})).toHaveAttribute('aria-valuenow','45');
 await act(async()=>finish({status:'applied',node_progress:lit}));
 expect(screen.getByRole('progressbar',{name:'整体学习进度'})).toHaveAttribute('aria-valuenow','100');
 fireEvent.click(screen.getByRole('button',{name:'撤销本次点亮'}));
 await waitFor(()=>expect(batch).toHaveBeenCalledTimes(2));
 expect(batch.mock.calls[1][0]).toEqual([
  {nodeId:'zero',expectedPercent:100,progressPercent:0},
  {nodeId:'partial',expectedPercent:100,progressPercent:35},
 ]);
 await waitFor(()=>expect(screen.getByRole('progressbar',{name:'整体学习进度'})).toHaveAttribute('aria-valuenow','45'));
 expect(single).not.toHaveBeenCalled();
});

it('can cancel a pending save and displays the unchanged server result without leaving an undo operation',async()=>{
 const batch=vi.fn<SaveBatchProgress>((_changes,signal)=>new Promise<never>((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))));
 const cancel=vi.fn().mockResolvedValue({status:'cancelled',node_progress:original});
 render(<MapView snapshot={snapshot} displayMode="personal" accountId="owner" entryId="entry" onSetBatchProgress={batch} onCancelBatchProgress={cancel} />);
 fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));
 await waitFor(()=>expect(batch).toHaveBeenCalledTimes(1));
 fireEvent.click(screen.getByRole('button',{name:'取消等待'}));
 await waitFor(()=>expect(screen.getByText('已停止，本次未保存。')).toBeVisible());
 expect(batch.mock.calls[0][1].aborted).toBe(true);
 expect(cancel.mock.calls[0][0]).toBe(batch.mock.calls[0][2]);
 expect(screen.getByRole('progressbar',{name:'整体学习进度'})).toHaveAttribute('aria-valuenow','45');
 expect(screen.queryByRole('button',{name:'撤销本次点亮'})).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'全部点亮'})).toBeEnabled();
});

it('reports an already committed batch honestly when cancellation arrives after the save',async()=>{
 let finish!:(value:BatchProgressResult)=>void;
 const batch=vi.fn<SaveBatchProgress>(()=>new Promise(resolve=>{finish=resolve;}));
 const cancel=vi.fn().mockResolvedValue({status:'applied',node_progress:lit});
 render(<MapView snapshot={snapshot} displayMode="personal" accountId="owner" entryId="entry" onSetBatchProgress={batch} onCancelBatchProgress={cancel} />);
 fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));
 fireEvent.click(screen.getByRole('button',{name:'取消等待'}));
 expect(await screen.findByText('全部节点已保存，可撤销本次点亮。')).toBeVisible();
 expect(screen.getByRole('progressbar',{name:'整体学习进度'})).toHaveAttribute('aria-valuenow','100');
 expect(screen.getByRole('button',{name:'撤销本次点亮'})).toBeEnabled();
 expect(screen.queryByText('已停止，本次未保存。')).not.toBeInTheDocument();
 await act(async()=>finish({status:'applied',node_progress:lit}));
 expect(screen.getByRole('progressbar',{name:'整体学习进度'})).toHaveAttribute('aria-valuenow','100');
});

it('keeps uncertain results blocked and lets the user retry reconciliation without repeating the save',async()=>{
 const batch=vi.fn<SaveBatchProgress>(()=>new Promise(()=>{}));
 const cancel=vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({status:'applied',node_progress:lit});
 render(<MapView snapshot={snapshot} displayMode="personal" accountId="owner" entryId="entry" onSetBatchProgress={batch} onCancelBatchProgress={cancel} />);
 fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));fireEvent.click(screen.getByRole('button',{name:'取消等待'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('暂时无法确认保存结果');
 expect(screen.getByRole('button',{name:'全部点亮'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'撤销本次点亮'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'重试核对'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'撤销本次点亮'})).toBeEnabled());
 expect(batch).toHaveBeenCalledTimes(1);expect(cancel).toHaveBeenCalledTimes(2);
 expect(cancel.mock.calls[0][0]).toBe(cancel.mock.calls[1][0]);
});

it('shows one dismissible failure after the server confirms the whole batch rolled back',async()=>{
 const batch=vi.fn().mockRejectedValue(new Error('Database unavailable'));
 const cancel=vi.fn().mockResolvedValue({status:'cancelled',node_progress:original});
 const header=document.createElement('header');document.body.append(header);
 try{
  const view=render(<MapView snapshot={snapshot} displayMode="personal" accountId="owner" entryId="entry" toolbarTarget={header} onSetBatchProgress={batch} onCancelBatchProgress={cancel} />);
  expect(view.container.querySelector('[role="toolbar"]')).toBeNull();
  fireEvent.click(within(header).getByRole('button',{name:'全部点亮'}));
  expect(await within(header).findByRole('alert')).toHaveTextContent('整批保存失败，未修改节点');
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.queryByRole('button',{name:'撤销本次点亮'})).not.toBeInTheDocument();
  fireEvent.click(within(header).getByRole('button',{name:'关闭地图提示'}));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.click(within(header).getByRole('button',{name:'全部点亮'}));
  expect(await within(header).findByRole('alert')).toHaveTextContent('整批保存失败');
 }finally{header.remove();}
});

it('preserves existing undo journals across reload and isolates them by account and map',async()=>{
 localStorage.setItem('mapflow.bulk-completion.v1.owner.entry.tree',JSON.stringify([{nodeId:'zero',percent:0},{nodeId:'partial',percent:35}]));
 const batch=vi.fn().mockResolvedValue({status:'applied',node_progress:original}),cancel=vi.fn();
 const props={snapshot:litSnapshot,displayMode:'personal' as const,accountId:'owner',entryId:'entry',onSetBatchProgress:batch,onCancelBatchProgress:cancel};
 const view=render(<MapView {...props} />);
 expect(screen.getByRole('button',{name:'撤销本次点亮'})).toBeEnabled();expect(batch).not.toHaveBeenCalled();
 view.rerender(<MapView {...props} accountId="other" />);expect(screen.queryByRole('button',{name:'撤销本次点亮'})).not.toBeInTheDocument();
 view.rerender(<MapView {...props} entryId="other" />);expect(screen.queryByRole('button',{name:'撤销本次点亮'})).not.toBeInTheDocument();
 view.rerender(<MapView {...props} />);fireEvent.click(screen.getByRole('button',{name:'撤销本次点亮'}));
 await waitFor(()=>expect(batch).toHaveBeenCalledTimes(1));
 expect(batch.mock.calls[0][0]).toEqual([{nodeId:'zero',expectedPercent:100,progressPercent:0},{nodeId:'partial',expectedPercent:100,progressPercent:35}]);
 await waitFor(()=>expect(screen.queryByRole('button',{name:'撤销本次点亮'})).not.toBeInTheDocument());
});

it('does not save anything when the undo journal cannot be persisted',async()=>{
 const storage=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('Full','QuotaExceededError');});
 const batch=vi.fn(),cancel=vi.fn();
 try{
  render(<MapView snapshot={snapshot} displayMode="personal" accountId="owner" entryId="entry" onSetBatchProgress={batch} onCancelBatchProgress={cancel} />);
  fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('无法保存撤销记录');
  expect(batch).not.toHaveBeenCalled();expect(cancel).not.toHaveBeenCalled();
 }finally{storage.mockRestore();}
});

it('preserves newer progress from another view when undoing this batch',async()=>{
 const batch=vi.fn().mockResolvedValueOnce({status:'applied',node_progress:lit})
  .mockResolvedValueOnce({status:'applied',node_progress:[{node_id:'partial',progress_percent:60},{node_id:'done',progress_percent:100}]});
 const props={snapshot,displayMode:'personal' as const,accountId:'owner',entryId:'entry',onSetBatchProgress:batch,onCancelBatchProgress:vi.fn()};
 const view=render(<MapView {...props} />);fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'撤销本次点亮'})).toBeEnabled());
 view.rerender(<MapView {...props} snapshot={{...litSnapshot,progress:[...litSnapshot.progress.filter(item=>item.node_id!=='partial'),{node_id:'partial',progress_percent:60,status:'in_progress',evidence:''}]}} />);
 fireEvent.click(screen.getByRole('button',{name:'撤销本次点亮'}));
 await waitFor(()=>expect(batch).toHaveBeenCalledTimes(2));
 expect(batch.mock.calls[1][0]).toEqual([{nodeId:'zero',expectedPercent:100,progressPercent:0}]);
 expect(await screen.findByText('已撤销本次点亮，保留之后调整的进度。')).toBeVisible();
 expect(screen.getByRole('progressbar',{name:'整体学习进度'})).toHaveAttribute('aria-valuenow','53');
});

it('aborts the previous map request and ignores its late response after switching maps',async()=>{
 let finish!:(value:BatchProgressResult)=>void;const batch=vi.fn<SaveBatchProgress>(()=>new Promise(resolve=>{finish=resolve;}));
 const cancel=vi.fn().mockResolvedValue({status:'cancelled',node_progress:original});
 const props={snapshot,displayMode:'personal' as const,accountId:'owner',entryId:'entry',onSetBatchProgress:batch,onCancelBatchProgress:cancel};
 const view=render(<MapView {...props} />);fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));
 view.rerender(<MapView {...props} entryId="next-entry" />);
 expect(batch.mock.calls[0][1].aborted).toBe(true);
 await act(async()=>finish({status:'applied',node_progress:lit}));
 expect(screen.getByRole('progressbar',{name:'整体学习进度'})).toHaveAttribute('aria-valuenow','45');
 expect(screen.getByRole('button',{name:'全部点亮'})).toBeEnabled();
 expect(screen.queryByRole('button',{name:'撤销本次点亮'})).not.toBeInTheDocument();
 expect(cancel.mock.calls[0][0]).toBe(batch.mock.calls[0][2]);
});

it('blocks duplicate and single-node writes while an atomic save is in flight',async()=>{
 const batch=vi.fn<SaveBatchProgress>(()=>new Promise(()=>{})),single=vi.fn();
 render(<MapView snapshot={snapshot} displayMode="personal" accountId="owner" entryId="entry" initialNodeId="zero"
  onSetCompleted={single} onSetProgress={single} onSetBatchProgress={batch} onCancelBatchProgress={vi.fn().mockResolvedValue({status:'cancelled',node_progress:original})} />);
 const light=screen.getByRole('button',{name:'全部点亮'});fireEvent.click(light);fireEvent.click(light);
 expect(light).toBeDisabled();expect(batch).toHaveBeenCalledTimes(1);
 expect(screen.getByRole('button',{name:'正在保存…'})).toBeDisabled();expect(single).not.toHaveBeenCalled();
});

it('retains a failed undo and preserves a later manual edit when retrying the remaining batch',async()=>{
 const batch=vi.fn().mockResolvedValueOnce({status:'applied',node_progress:lit})
  .mockRejectedValueOnce(new Error('Undo unavailable'))
  .mockResolvedValueOnce({status:'applied',node_progress:[{node_id:'zero',progress_percent:60},{node_id:'partial',progress_percent:35},{node_id:'done',progress_percent:100}]});
 const manual=vi.fn().mockResolvedValue(undefined);
 const cancel=vi.fn().mockResolvedValue({status:'cancelled',node_progress:lit});
 render(<MapView snapshot={snapshot} displayMode="personal" accountId="owner" entryId="entry" initialNodeId="zero"
  onSetProgress={manual} onSetBatchProgress={batch} onCancelBatchProgress={cancel} />);
 fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'撤销本次点亮'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'撤销本次点亮'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('整批保存失败');
 expect(screen.getByRole('button',{name:'撤销本次点亮'})).toBeEnabled();
 fireEvent.click(screen.getByRole('button',{name:'填写详细进度'}));
 fireEvent.change(screen.getByRole('spinbutton',{name:'节点完成百分比'}),{target:{value:'60'}});
 fireEvent.click(screen.getByRole('button',{name:'保存详细进度'}));
 await waitFor(()=>expect(manual).toHaveBeenCalledWith('zero',60));
 await waitFor(()=>expect(screen.getByRole('button',{name:'撤销本次点亮'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'撤销本次点亮'}));
 await waitFor(()=>expect(batch).toHaveBeenCalledTimes(3));
 expect(batch.mock.calls[2][0]).toEqual([{nodeId:'partial',expectedPercent:100,progressPercent:35}]);
 await waitFor(()=>expect(screen.queryByRole('button',{name:'撤销本次点亮'})).not.toBeInTheDocument());
});
