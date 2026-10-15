import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {LearningTreeSnapshot} from '../../types/learning';
import MapView from './MapView';

const snapshot:LearningTreeSnapshot={
  tree:{id:'tree',topic:'testing',title:'学习路线',description:null,difficulty_level:'beginner',total_nodes:1},
  nodes:[{id:'node',tree_id:'tree',title:'基础知识',description:null,icon:'book',category:'基础',difficulty:1,estimated_minutes:20,depth_level:0,position_x:0,position_y:0,order_in_level:0,learning_objectives:null,key_concepts:null,recommended_depth:'Understand',depth_rationale:'理解基础',observable_evidence:'能够解释'}],
  edges:[],progress:[],current_node_id:null,
  blocks:[{id:'block',name:'入门学习块',color:'#147a5c',sort_order:0}],
  node_block_assignments:[{node_id:'node',block_id:'block'}],
};
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});});
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});

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
  expect(screen.getByRole('dialog',{name:'基础知识'})).toBeVisible();
});

it('explains why a map without node assignments keeps its relationship layout',()=>{
  render(<MapView snapshot={{...snapshot,node_block_assignments:[]}} displayMode="personal" accountId="account" />);
  fireEvent.click(screen.getByRole('button',{name:'按块排序'}));
  expect(screen.getByText(/暂无节点分组，仍显示知识关系/)).toBeVisible();
});
