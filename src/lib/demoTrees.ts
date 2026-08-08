import type { LearningTreeSnapshot } from '../types/learning';
import { NEST_TREE } from './nestTreeData';
import { AGENT_TREE } from './agentTreeData';

/**
 * 内置演示技能树：直接来自真实学习项目的 SKILL_TREE.json 与进度文件，
 * 没有配套后端时也能看到完整的节点图交互效果。
 * 启动配套后端后，前端会自动切换到真实学习进度数据。
 */
export const DEMO_TREES: Record<string, LearningTreeSnapshot> = {
  nestjs: { ...NEST_TREE, demo_source: 'nestjs' },
  agent: { ...AGENT_TREE, demo_source: 'agent' },
};
