import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {LearningTreeSnapshot} from '../../types/learning';
import MapView from './MapView';
import {PublicUiError} from '../../lib/publicErrors';

const snapshot:LearningTreeSnapshot={
  tree:{id:'tree',topic:'testing',title:'学习路线',description:null,difficulty_level:'beginner',total_nodes:1},
  nodes:[{id:'node',tree_id:'tree',title:'基础知识',description:null,icon:'book',category:'基础',difficulty:1,estimated_minutes:20,depth_level:0,position_x:0,position_y:0,order_in_level:0,learning_objectives:null,key_concepts:null,recommended_depth:'Understand',depth_rationale:'理解基础',observable_evidence:'能够解释'}],
  edges:[],progress:[],current_node_id:null,
  blocks:[{id:'block',name:'入门学习块',color:'#147a5c',sort_order:0}],
  node_block_assignments:[{node_id:'node',block_id:'block'}],
};
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});});
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});

it('places map actions and dismissible feedback in the existing page header without a second bar',async()=>{
  const header=document.createElement('header');document.body.append(header);
  const complete=vi.fn().mockResolvedValue(undefined),restore=vi.fn().mockResolvedValue(undefined);
  try{
    const view=render(<MapView snapshot={snapshot} displayMode="personal" accountId="account" toolbarTarget={header} onSetCompleted={complete} onSetProgress={restore} />);
    const toolbar=within(header).getByRole('toolbar',{name:'地图工具'});
    expect(view.container.querySelector('[role="toolbar"]')).toBeNull();
    fireEvent.click(within(toolbar).getByRole('button',{name:'全部点亮'}));
    await waitFor(()=>expect(complete).toHaveBeenCalledWith('node',true));
    expect(await within(header).findByRole('button',{name:'撤销本次点亮'})).toBeVisible();
    expect(view.container.querySelector('[role="toolbar"]')).toBeNull();
  }finally{header.remove();}
});

it('lights in one click without confirmation and restores zero and partial progress without changing completed nodes',async()=>{
  const saved:LearningTreeSnapshot={...snapshot,nodes:['zero','partial','done'].map(id=>({...snapshot.nodes[0],id,title:id})),progress:[
    {node_id:'partial',status:'in_progress',progress_percent:35,evidence:''},
    {node_id:'done',status:'completed',progress_percent:100,evidence:''},
  ]};
  const complete=vi.fn().mockResolvedValue(undefined),restore=vi.fn().mockResolvedValue(undefined);
  render(<MapView snapshot={saved} displayMode="personal" accountId="account" entryId="entry" onSetCompleted={complete} onSetProgress={restore} />);
  fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(()=>expect(complete.mock.calls).toEqual([['zero',true],['partial',true]]));
  const undo=await screen.findByRole('button',{name:'撤销本次点亮'});
  await waitFor(()=>expect(undo).toBeEnabled());
  fireEvent.click(undo);
  await waitFor(()=>expect(restore.mock.calls).toEqual([['zero',0],['partial',35]]));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'撤销本次点亮'})).not.toBeInTheDocument());
});

it('shows a bulk failure only once inside the toolbar, lets it close, and shows a new failure on retry',async()=>{
  const error=new PublicUiError('技能树请求失败，请稍后重试。');
  const complete=vi.fn().mockRejectedValue(error),restore=vi.fn().mockResolvedValue(undefined);
  render(<MapView snapshot={snapshot} displayMode="personal" accountId="account" onSetCompleted={complete} onSetProgress={restore} error={error} />);
  fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));
  await waitFor(()=>expect(screen.getAllByRole('alert')).toHaveLength(1));
  const toolbar=screen.getByRole('toolbar',{name:'地图工具'});
  expect(within(toolbar).getByRole('alert')).toHaveTextContent('0/1');
  fireEvent.click(within(toolbar).getByRole('button',{name:'关闭地图提示'}));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'撤销本次点亮'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('0/1');
  expect(complete).toHaveBeenCalledTimes(2);
  expect(screen.getAllByRole('alert')).toHaveLength(1);
});

it('keeps progress feedback in the toolbar and allows a later single-node error after dismissing the old one',()=>{
  const error=new PublicUiError('保存进度失败。');
  const props={snapshot,displayMode:'personal' as const,accountId:'account',error};
  const view=render(<MapView {...props} />);
  const toolbar=screen.getByRole('toolbar',{name:'地图工具'});
  expect(within(toolbar).getByRole('alert')).toHaveTextContent('保存进度失败');
  fireEvent.click(screen.getByRole('button',{name:'关闭地图提示'}));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  view.rerender(<MapView {...props} progressPending />);
  expect(within(toolbar).getByRole('status')).toHaveTextContent('正在保存进度');
  view.rerender(<MapView {...props} error={new PublicUiError('保存进度失败。')} />);
  expect(within(toolbar).getByRole('alert')).toHaveTextContent('保存进度失败');
});

it('keeps undo after reload, isolates it by account and map, and does not repeat writes on mount',async()=>{
  const complete=vi.fn().mockResolvedValue(undefined),restore=vi.fn().mockResolvedValue(undefined);
  const props={snapshot,displayMode:'personal' as const,accountId:'first',entryId:'entry',onSetCompleted:complete,onSetProgress:restore};
  const first=render(<MapView {...props} />);
  fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'撤销本次点亮'})).toBeEnabled());
  first.unmount();
  const second=render(<MapView {...props} />);
  expect(screen.getByRole('button',{name:'撤销本次点亮'})).toBeEnabled();
  expect(complete).toHaveBeenCalledTimes(1);
  second.rerender(<MapView {...props} accountId="another-account" />);
  expect(screen.queryByRole('button',{name:'撤销本次点亮'})).not.toBeInTheDocument();
  second.rerender(<MapView {...props} entryId="another-map" />);
  expect(screen.queryByRole('button',{name:'撤销本次点亮'})).not.toBeInTheDocument();
  second.rerender(<MapView {...props} />);
  fireEvent.click(screen.getByRole('button',{name:'撤销本次点亮'}));
  await waitFor(()=>expect(restore).toHaveBeenCalledWith('node',0));
  expect(complete).toHaveBeenCalledTimes(1);
});

it('stops after a failed bulk request and keeps attempted nodes recoverable without claiming success',async()=>{
  const saved={...snapshot,nodes:['first','uncertain','untouched'].map(id=>({...snapshot.nodes[0],id,title:id})),
    progress:[{node_id:'uncertain',status:'in_progress' as const,progress_percent:35,evidence:''}]};
  const complete=vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Lost response'));
  const restore=vi.fn().mockResolvedValue(undefined);
  render(<MapView snapshot={saved} displayMode="personal" accountId="account" onSetCompleted={complete} onSetProgress={restore} />);
  fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('1/3');
  expect(screen.queryByText('已点亮全部节点，可撤销本次点亮。')).not.toBeInTheDocument();
  expect(complete.mock.calls).toEqual([['first',true],['uncertain',true]]);
  fireEvent.click(screen.getByRole('button',{name:'撤销本次点亮'}));
  await waitFor(()=>expect(restore.mock.calls).toEqual([['first',0],['uncertain',35]]));
});

it('prevents duplicate and single-node writes during a bulk save and stops the queue when its map changes',async()=>{
  let finish!:()=>void;
  const complete=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;})),restore=vi.fn().mockResolvedValue(undefined);
  const twoNodes={...snapshot,nodes:[snapshot.nodes[0],{...snapshot.nodes[0],id:'next'}]};
  const props={snapshot:twoNodes,displayMode:'personal' as const,accountId:'account',entryId:'old',initialNodeId:'node',onSetCompleted:complete,onSetProgress:restore};
  const view=render(<MapView {...props} />);
  fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));
  expect(screen.getByRole('button',{name:'全部点亮'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'正在保存…'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));
  expect(complete).toHaveBeenCalledTimes(1);
  view.rerender(<MapView {...props} entryId="new" snapshot={{...twoNodes,tree:{...twoNodes.tree,id:'new-tree'}}} />);
  await act(async()=>finish());
  expect(complete.mock.calls).toEqual([['node',true]]);
  expect(screen.queryByRole('button',{name:'撤销本次点亮'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'标记为已完成'})).toBeEnabled();
});

it('does not begin bulk writes if the browser cannot retain a recoverable checkpoint',async()=>{
  const storage=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('Full','QuotaExceededError');});
  const complete=vi.fn().mockResolvedValue(undefined),restore=vi.fn().mockResolvedValue(undefined);
  try{
    render(<MapView snapshot={snapshot} displayMode="personal" accountId="account" onSetCompleted={complete} onSetProgress={restore} />);
    fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('无法保存撤销记录');
    expect(complete).not.toHaveBeenCalled();
    expect(screen.queryByRole('button',{name:'撤销本次点亮'})).not.toBeInTheDocument();
  }finally{storage.mockRestore();}
});

it('keeps failed undo entries available and removes later manual edits from the undo record',async()=>{
  const complete=vi.fn().mockResolvedValue(undefined);
  const restore=vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue(undefined);
  render(<MapView snapshot={snapshot} displayMode="personal" accountId="account" initialNodeId="node" onSetCompleted={complete} onSetProgress={restore} />);
  fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'撤销本次点亮'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'撤销本次点亮'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('恢复');
  expect(screen.getByRole('button',{name:'撤销本次点亮'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'填写详细进度'}));
  fireEvent.change(screen.getByRole('spinbutton',{name:'节点完成百分比'}),{target:{value:'60'}});
  fireEvent.click(screen.getByRole('button',{name:'保存详细进度'}));
  await waitFor(()=>expect(restore).toHaveBeenLastCalledWith('node',60));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'撤销本次点亮'})).not.toBeInTheDocument());
});

it('preserves a newer percentage from another view when undoing a previous bulk light',async()=>{
  const initial={...snapshot,progress:[{node_id:'node',status:'in_progress' as const,progress_percent:35,evidence:''}]};
  const complete=vi.fn().mockResolvedValue(undefined),restore=vi.fn().mockResolvedValue(undefined);
  const props={snapshot:initial,displayMode:'personal' as const,accountId:'account',onSetCompleted:complete,onSetProgress:restore};
  const view=render(<MapView {...props} />);
  fireEvent.click(screen.getByRole('button',{name:'全部点亮'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'撤销本次点亮'})).toBeEnabled());
  view.rerender(<MapView {...props} snapshot={{...initial,progress:[{...initial.progress[0],progress_percent:60}]}} />);
  fireEvent.click(screen.getByRole('button',{name:'撤销本次点亮'}));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'撤销本次点亮'})).not.toBeInTheDocument());
  expect(restore).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('保留之后调整的进度');
});

it('sorts the real map into learning blocks from one button and can return to relationships',async()=>{
  render(<MapView snapshot={snapshot} displayMode="personal" accountId="account" />);
  const sort=screen.getByRole('button',{name:'按块排序'});
  expect(sort).toHaveAttribute('aria-pressed','false');
  fireEvent.click(sort);
  expect(sort).toHaveAttribute('aria-pressed','true');
  await screen.findByText('入门学习块');
  expect(screen.getByRole('button',{name:'按块排序'})).toBeVisible();
  expect(screen.queryByRole('button',{name:'知识关系'})).not.toBeInTheDocument();
  fireEvent.click(sort);
  expect(sort).toHaveAttribute('aria-pressed','false');
  await waitFor(()=>expect(screen.queryByText('入门学习块')).not.toBeInTheDocument());
});

it('retains an existing block-layout deep link and selected node',async()=>{
  render(<MapView snapshot={snapshot} displayMode="personal" accountId="account" initialLayout="blocks" initialNodeId="node" />);
  expect(screen.getByRole('button',{name:'按块排序'})).toHaveAttribute('aria-pressed','true');
  expect(screen.getByRole('complementary',{name:'节点详情'})).toBeVisible();
});

it('keeps selected relationships visible while details are collapsed, until the user clears the selection',()=>{
  render(<MapView snapshot={snapshot} displayMode="personal" accountId="account" initialLayout="blocks" initialNodeId="node" />);
  const details=screen.getByRole('complementary',{name:'节点详情'});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.getElementById('root')?.inert).not.toBe(true);
  fireEvent.click(within(details).getByRole('button',{name:'收起节点详情'}));
  expect(screen.queryByRole('complementary',{name:'节点详情'})).not.toBeInTheDocument();
  expect(screen.getByText('→ 选中节点 →')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'查看节点详情：基础知识'}));
  expect(screen.getByRole('complementary',{name:'节点详情'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'取消选择'}));
  expect(screen.queryByRole('complementary',{name:'节点详情'})).not.toBeInTheDocument();
  expect(screen.queryByText('→ 选中节点 →')).not.toBeInTheDocument();
});

it('explains why a map without node assignments keeps its relationship layout',()=>{
  render(<MapView snapshot={{...snapshot,node_block_assignments:[]}} displayMode="personal" accountId="account" />);
  fireEvent.click(screen.getByRole('button',{name:'按块排序'}));
  expect(screen.getByText(/暂无节点分组，仍显示知识关系/)).toBeVisible();
});

it('shows progress for this map only and keeps personal progress out of the public preview',()=>{
  const progressing:LearningTreeSnapshot={...snapshot,
    nodes:['one','two','three','four'].map(id=>({...snapshot.nodes[0],id,title:id})),
    progress:[
      {node_id:'two',status:'in_progress',evidence:'',progress_percent:50},
      {node_id:'three',status:'completed',evidence:'',progress_percent:100},
      {node_id:'four',status:'mastered',evidence:''},
      {node_id:'another-map-node',status:'completed',evidence:'',progress_percent:100},
    ],
  };
  const view=render(<MapView snapshot={progressing} displayMode="personal" accountId="account" />);
  expect(screen.getByRole('progressbar',{name:'整体学习进度'})).toHaveAttribute('aria-valuenow','63');
  expect(screen.getByText('已完成 2')).toBeVisible();
  expect(screen.getByText('进行中 1')).toBeVisible();
  expect(screen.getByText('未开始 1')).toBeVisible();
  view.rerender(<MapView snapshot={progressing} displayMode="showcase" accountId="account" />);
  expect(screen.queryByRole('progressbar',{name:'整体学习进度'})).not.toBeInTheDocument();
  expect(screen.queryByText('已完成 2')).not.toBeInTheDocument();
});

it('celebrates a completed node only after its save succeeds and prevents duplicate submissions',async()=>{
  let finish!:()=>void;
  const onSetCompleted=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
  render(<MapView snapshot={snapshot} displayMode="personal" accountId="account" initialNodeId="node" onSetCompleted={onSetCompleted} />);
  expect(screen.queryByText('此间事了')).not.toBeInTheDocument();
  const complete=screen.getByRole('button',{name:'标记为已完成'});
  fireEvent.click(complete);
  fireEvent.click(complete);
  expect(onSetCompleted).toHaveBeenCalledTimes(1);
  expect(onSetCompleted).toHaveBeenCalledWith('node',true);
  expect(screen.queryByText('此间事了')).not.toBeInTheDocument();
  await act(async()=>finish());
  expect(await screen.findByText('此间事了')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'收下这一步'}));
  expect(screen.queryByText('此间事了')).not.toBeInTheDocument();
});

it('also waits for confirmation when detailed progress is saved at 100 percent',async()=>{
  let finish!:()=>void;
  const onSetProgress=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
  render(<MapView snapshot={snapshot} displayMode="personal" accountId="account" initialNodeId="node" onSetProgress={onSetProgress} />);
  fireEvent.click(screen.getByRole('button',{name:'填写详细进度'}));
  fireEvent.change(screen.getByRole('spinbutton',{name:'节点完成百分比'}),{target:{value:'100'}});
  fireEvent.click(screen.getByRole('button',{name:'保存详细进度'}));
  expect(onSetProgress).toHaveBeenCalledWith('node',100);
  expect(screen.queryByText('此间事了')).not.toBeInTheDocument();
  await act(async()=>finish());
  expect(await screen.findByText('此间事了')).toBeVisible();
});

it('does not celebrate failed saves, refreshed history, or cancelling completion',async()=>{
  const save=vi.fn().mockRejectedValueOnce(new Error('Save rejected')).mockResolvedValue(undefined);
  const view=render(<MapView snapshot={snapshot} displayMode="personal" accountId="account" initialNodeId="node" onSetCompleted={save} />);
  fireEvent.click(screen.getByRole('button',{name:'标记为已完成'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'标记为已完成'})).toBeEnabled());
  expect(screen.queryByText('此间事了')).not.toBeInTheDocument();
  const finished:LearningTreeSnapshot={...snapshot,progress:[{node_id:'node',status:'completed',evidence:'',progress_percent:100}]};
  view.rerender(<MapView snapshot={finished} displayMode="personal" accountId="account" initialNodeId="node" onSetCompleted={save} />);
  expect(screen.queryByText('此间事了')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'取消完成'}));
  await waitFor(()=>expect(save).toHaveBeenLastCalledWith('node',false));
  expect(screen.queryByText('此间事了')).not.toBeInTheDocument();
});

it('ignores a late save from a previous map and keeps the new map usable',async()=>{
  let finish!:()=>void;
  const save=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
  const view=render(<MapView snapshot={snapshot} displayMode="personal" accountId="account" entryId="old-entry" initialNodeId="node" onSetCompleted={save} />);
  fireEvent.click(screen.getByRole('button',{name:'标记为已完成'}));
  view.rerender(<MapView snapshot={{...snapshot,tree:{...snapshot.tree,id:'other-tree'}}} displayMode="personal" accountId="account" entryId="new-entry" initialNodeId="node" onSetCompleted={save} />);
  await act(async()=>finish());
  expect(screen.queryByText('此间事了')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'标记为已完成'})).toBeEnabled();
});

it('keeps saving protection when a new node deep link opens inside the same map',async()=>{
  let finish!:()=>void;
  const save=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
  const twoNodes={...snapshot,nodes:[...snapshot.nodes,{...snapshot.nodes[0],id:'other',title:'下一步'}]};
  const view=render(<MapView snapshot={twoNodes} displayMode="personal" accountId="account" initialNodeId="node" onSetCompleted={save} />);
  fireEvent.click(screen.getByRole('button',{name:'标记为已完成'}));
  view.rerender(<MapView snapshot={twoNodes} displayMode="personal" accountId="account" initialNodeId="other" onSetCompleted={save} />);
  expect(screen.getByRole('button',{name:'正在保存…'})).toBeDisabled();
  await act(async()=>finish());
});

it.each(['Enter',' '])('opens real map node details with the %j key',async key=>{
  render(<MapView snapshot={snapshot} displayMode="personal" accountId="account" />);
  fireEvent.keyDown(await screen.findByTestId('rf__node-node'),{key});
  expect(screen.getByRole('complementary',{name:'节点详情'})).toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('discards an unsaved detailed-progress field when another map reuses the same node identity',()=>{
  const save=vi.fn().mockResolvedValue(undefined);
  const view=render(<MapView snapshot={snapshot} displayMode="personal" accountId="account" entryId="first" initialNodeId="node" onSetProgress={save} />);
  fireEvent.click(screen.getByRole('button',{name:'填写详细进度'}));
  fireEvent.change(screen.getByRole('spinbutton',{name:'节点完成百分比'}),{target:{value:'73'}});
  view.rerender(<MapView snapshot={{...snapshot,tree:{...snapshot.tree,id:'next-tree'}}} displayMode="personal" accountId="account" entryId="next" initialNodeId="node" onSetProgress={save} />);
  expect(screen.queryByRole('spinbutton',{name:'节点完成百分比'})).not.toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});
