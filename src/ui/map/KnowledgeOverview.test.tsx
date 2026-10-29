import {render,screen,fireEvent} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import KnowledgeOverview from './KnowledgeOverview';
import type {LearningTreeSnapshot} from '../../types/learning';
const snapshot:LearningTreeSnapshot={tree:{id:'tree',title:'真实范围',topic:'topic',description:'完整范围说明',total_nodes:35,difficulty_level:'beginner'},nodes:Array.from({length:35},(_,index)=>({id:`node-${index}`,tree_id:'tree',title:`知识点 ${index}`,description:`真实解释 ${index}`,icon:'book',category:'基础',difficulty:1,estimated_minutes:25,depth_level:0,position_x:0,position_y:0,order_in_level:index,learning_objectives:null,key_concepts:null,recommended_depth:'Understand',depth_rationale:'',observable_evidence:''})),edges:[],blocks:[],node_block_assignments:[],progress:[{node_id:'node-34',progress_percent:40,status:'in_progress',evidence:''}],current_node_id:'node-34'};
it('shows every real node and preserves identity when viewing or searching',()=>{
  const select=vi.fn();render(<KnowledgeOverview snapshot={snapshot} onSelect={select} />);
  expect(screen.getAllByRole('listitem')).toHaveLength(35);expect(screen.getByText('真实解释 34')).toBeVisible();expect(screen.getByText('学到这里')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'知识点 34'}));expect(select).toHaveBeenCalledWith('node-34');
  fireEvent.change(screen.getByLabelText('搜索知识点'),{target:{value:'真实解释 34'}});
  expect(screen.getAllByRole('listitem')).toHaveLength(1);expect(screen.getByText('40%')).toBeVisible();
  expect(screen.getByText(/分类说明尚未补充/)).toBeVisible();
});
