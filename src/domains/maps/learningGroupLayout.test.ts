import { describe, expect, it } from 'vitest';
import type { LearningTreeSnapshot, SkillEdge, SkillNode } from '../../types/learning';
import { computeLearningGroupLayout, computeLearningNodeLayout } from './learningGroupLayout';

const node = (id: string, depth: SkillNode['recommended_depth'] = 'Understand'): SkillNode => ({ id, tree_id:'tree',title:id,description:null,icon:'book',category:'基础',difficulty:1,estimated_minutes:10,depth_level:0,position_x:0,position_y:0,order_in_level:0,learning_objectives:null,key_concepts:null,recommended_depth:depth,depth_rationale:'',observable_evidence:'' });
const edge = (source: string, target: string, type = 'prerequisite'): SkillEdge => ({ id:`${source}-${target}`,source_node_id:source,target_node_id:target,edge_type:type,label:null });
export const groupedSnapshot: LearningTreeSnapshot = {
  tree:{id:'tree',title:'真实分叉',topic:'测试',description:null,difficulty_level:'beginner',total_nodes:8,generation_version:2},
  nodes:[node('start','Recognize'),node('a'),node('b','Use'),node('c','Use'),node('d','Transfer'),node('e'),node('f','Use'),node('end','DeepMastery')],
  edges:[edge('start','a'),edge('a','b'),edge('a','c'),edge('b','d'),edge('c','d'),edge('d','e'),edge('e','f'),edge('f','end')],
  learning_groups:[{group_id:'g1',title:'函数与分支',node_ids:['a','b','c','d']},{group_id:'g2',title:'实际调用',node_ids:['e','f']}],
  progress:[{node_id:'b',status:'in_progress',progress_percent:35,evidence:''}],current_node_id:'b',
};

describe('learning groups in the same canvas', () => {
  it('does not hide a real cycle inside a folded group',()=>{
    const layout=computeLearningGroupLayout({...groupedSnapshot,edges:[...groupedSnapshot.edges,edge('d','a')]},new Set());
    expect(layout.invalidGroups).toBe(true);
    expect(layout.visibleNodeIds.size).toBe(8);
  });
  it('folds only display endpoints, retaining real node IDs, forks and progress on expansion', () => {
    const original = structuredClone(groupedSnapshot);
    const collapsed = computeLearningGroupLayout(groupedSnapshot, new Set());
    expect([...collapsed.visibleNodeIds].sort()).toEqual(['end','start']);
    expect(collapsed.groups).toHaveLength(2);
    expect(collapsed.edges).toHaveLength(3);
    const open = computeLearningGroupLayout(groupedSnapshot, new Set(['g1','g2']));
    expect(open.visibleNodeIds.size).toBe(8);
    expect(open.edges).toEqual(groupedSnapshot.edges);
    expect(open.positions.get('b')!.y).toBe(open.positions.get('c')!.y);
    expect(open.positions.get('d')!.y).toBeGreaterThan(open.positions.get('b')!.y + 104);
    expect(groupedSnapshot).toEqual(original);
  });
  it('makes room for multiple open groups without overlapping cards or neighboring groups', () => {
    const layout = computeLearningGroupLayout(groupedSnapshot,new Set(['g1','g2']));
    const boxes = [...layout.groups.map(group=>({ ...group.position,width:group.width,height:group.height })), ...['start','end'].map(id=>({...layout.positions.get(id)!,width:240,height:104}))];
    for (const [index,a] of boxes.entries()) for (const b of boxes.slice(index+1)) {
      expect(a.x+a.width<=b.x || b.x+b.width<=a.x || a.y+a.height<=b.y || b.y+b.height<=a.y).toBe(true);
    }
    for (const group of layout.groups) for (const id of group.group.node_ids) {
      const point=layout.positions.get(id)!;
      expect(point.x).toBeGreaterThan(group.position.x);
      expect(point.x+240).toBeLessThan(group.position.x+group.width);
      expect(point.y).toBeGreaterThan(group.position.y+60);
      expect(point.y+104).toBeLessThan(group.position.y+group.height);
    }
  });
  it('uses only the existing five depths for subtle staggering, with dependencies taking priority', () => {
    const nodes=[node('first','DeepMastery'),node('then','Recognize'),node('peer','Understand'),node('other','Use')];
    const positions=computeLearningNodeLayout(nodes,[edge('first','then')]);
    expect(positions.get('other')!.y-positions.get('peer')!.y).toBe(14);
    expect(positions.get('then')!.y).toBeGreaterThan(positions.get('first')!.y+104);
    expect(computeLearningNodeLayout([...nodes].reverse(),[edge('first','then')])).toEqual(positions);
  });
  it.each([
    [{group_id:'bad',title:'会形成假循环',node_ids:['a','d']}],
    [{group_id:'bad',title:'丢失节点',node_ids:['a','missing']}],
    [{group_id:'one',title:'重叠',node_ids:['a','b']},{group_id:'two',title:'重叠',node_ids:['b','c']}],
  ].map(learning_groups=>({learning_groups})))('shows the full original graph when folding metadata is invalid', ({learning_groups}) => {
    const layout=computeLearningGroupLayout({...groupedSnapshot,learning_groups},new Set());
    expect(layout.invalidGroups).toBe(true);
    expect(layout.groups).toHaveLength(0);
    expect(layout.visibleNodeIds.size).toBe(8);
    expect(layout.edges).toEqual(groupedSnapshot.edges);
  });
  it('does not turn related edges into learning dependencies or collide with real node IDs', () => {
    const collision=node('learning-group:g1');
    const graph={...groupedSnapshot,nodes:[...groupedSnapshot.nodes,collision],edges:[...groupedSnapshot.edges,edge('d','a','related')]};
    const layout=computeLearningGroupLayout(graph,new Set());
    expect(layout.invalidGroups).toBe(false);
    expect(layout.groups.some(group=>group.id===collision.id)).toBe(false);
    expect(layout.visibleNodeIds.has(collision.id)).toBe(true);
  });
});
