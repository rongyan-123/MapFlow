import { expect, it } from 'vitest';
import { getNodeReadiness } from './nodeReadiness';
import type { NodeLearningProgress, SkillEdge } from '../../types/learning';

const prerequisites: SkillEdge[] = [
  { id: 'first', source_node_id: 'first', target_node_id: 'next', edge_type: 'prerequisite', label: null },
  { id: 'second', source_node_id: 'second', target_node_id: 'next', edge_type: 'prerequisite', label: null },
];
const completed: NodeLearningProgress = { node_id: 'first', progress_percent: 100, status: 'completed', evidence: '' };

it('没有前置知识的起点直接点亮', () => {
  expect(getNodeReadiness(['start'], [], []).get('start')).toBe(true);
});

it('只在全部直接前置进度100后点亮，保留节点自己已有的进度', () => {
  const progress: NodeLearningProgress[] = [completed, { ...completed, node_id: 'second', progress_percent: 35, status: 'in_progress' }, { ...completed, node_id: 'next' }];
  const original = structuredClone(progress);
  expect(getNodeReadiness(['first', 'second', 'next'], prerequisites, progress).get('next')).toBe(false);
  expect(progress).toEqual(original);
  const updated = progress.map(item => item.node_id === 'second' ? { ...item, progress_percent: 100 as const, status: 'completed' as const } : item);
  expect(getNodeReadiness(['first', 'second', 'next'], prerequisites, updated).get('next')).toBe(true);
});

it('缺少前置节点或前置进度时不能误判为已完成', () => {
  expect(getNodeReadiness(['first', 'next'], prerequisites, [completed, { ...completed, node_id: 'second' }]).get('next')).toBe(false);
  expect(getNodeReadiness(['first', 'second', 'next'], prerequisites, [completed]).get('next')).toBe(false);
});

it('related和未知关系不会锁定节点', () => {
  const edges = prerequisites.map((edge, index) => ({ ...edge, edge_type: index ? 'future_relation' : 'related' }));
  expect(getNodeReadiness(['next'], edges, []).get('next')).toBe(true);
});

it('显式百分比优先，旧completed/mastered状态缺百分比时仍兼容完成记录', () => {
  expect(getNodeReadiness(['first', 'next'], [prerequisites[0]], [{ ...completed, progress_percent: 0 }]).get('next')).toBe(false);
  expect(getNodeReadiness(['first', 'next'], [prerequisites[0]], [{ node_id: 'first', status: 'mastered', evidence: '' }]).get('next')).toBe(true);
});
