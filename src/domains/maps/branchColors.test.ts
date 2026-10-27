import { describe, expect, it } from 'vitest';
import { getNodeBranches } from './branchColors';
import type { LearningTreeSnapshot, SkillNode } from '../../types/learning';

const node=(id:string,category:string)=>({id,category,title:'相同标题'} as SkillNode);
const graph={tree:{id:'map'},nodes:[node('python','Python 基础'),node('api','FastAPI'),node('llm','LLM API'),node('agent','Agent 核心'),node('rag','RAG'),node('chain','LangChain'),node('workflow','LangGraph')],edges:[],progress:[],current_node_id:null} as unknown as LearningTreeSnapshot;

describe('分支颜色身份',()=>{
  it('uses actual categories consistently across node ordering, progress, readiness and title changes',()=>{
    const branches=getNodeBranches(graph);
    expect(new Set([...branches.values()].map(branch=>branch.tone)).size).toBe(5);
    const reordered=getNodeBranches({...graph,nodes:[...graph.nodes].reverse().map(item=>({...item,title:'修改后的标题'})),progress:[{node_id:'python',status:'completed',progress_percent:100,evidence:''}]});
    expect([...reordered].sort()).toEqual([...branches].sort());
    expect(getNodeBranches({...graph,nodes:[...graph.nodes,node('same-category','Python 基础')]}).get('same-category')).toEqual(branches.get('python'));
  });

  it('prefers known block assignments and deterministically resolves multiple or stale assignments',()=>{
    const blocked={...graph,blocks:[{id:'later',name:'同名块',color:null,sort_order:2},{id:'first',name:'同名块',color:null,sort_order:1}],node_block_assignments:[{node_id:'python',block_id:'later'},{node_id:'python',block_id:'first'},{node_id:'api',block_id:'first'},{node_id:'llm',block_id:'deleted'}]};
    const branches=getNodeBranches(blocked);
    expect(branches.get('python')?.key).toBe('block:first');
    expect(branches.get('api')).toEqual(branches.get('python'));
    expect(branches.get('llm')?.key).toBe('category:LLM API');
    expect(getNodeBranches({...blocked,node_block_assignments:[...blocked.node_block_assignments].reverse()}).get('python')).toEqual(branches.get('python'));
  });
});
