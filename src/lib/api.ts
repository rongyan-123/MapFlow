import type { LearningTreeSnapshot } from '../types/learning';
import { DEMO_TREE } from './demoTree';

export async function fetchLearningTree(): Promise<LearningTreeSnapshot> {
  try {
    const response = await fetch('/api/learning/tree');
    if (!response.ok) {
      throw new Error(`学习树读取失败：HTTP ${response.status}`);
    }
    return (await response.json()) as LearningTreeSnapshot;
  } catch {
    console.warn('未检测到后端服务，切换到内置演示数据；启动配套后端后可显示真实学习进度。');
    return DEMO_TREE;
  }
}
