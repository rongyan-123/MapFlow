import { describe, expect, it } from 'vitest';
import { getTreeGuide } from './learningEntry';
import type { SkillTree } from '../../types/learning';

const pythonTree: SkillTree = {
  id: '9369e054-3c40-4a46-9952-3abbde4195a1',
  topic: 'Python Agent Development',
  title: '生产级 AI Agent 应用开发完整体系（Python）',
  description: null,
  difficulty_level: 'intermediate',
  total_nodes: 74,
};

describe('learningEntry', () => {
  it('只为稳定官方树 ID 提供对应的具体探索问题', () => {
    const guide = getTreeGuide(pythonTree);

    expect(guide.audience).toContain('已有编程经验');
    expect(guide.question).toContain('Python');
    expect(guide.recommendedNodeTitle).toContain('Python');
  });

  it('对未知树使用不误导的通用 fallback，不猜测主题细节', () => {
    const guide = getTreeGuide({
      ...pythonTree,
      id: 'custom-tree-id',
      topic: '自定义主题',
      title: '我的自定义树',
    });

    expect(guide.title).toBe('我的自定义树');
    expect(guide.question).toContain('自定义主题');
    expect(guide.question).not.toContain('Python');
    expect(guide.prerequisites).toEqual(['知道自己想解决的一个具体问题']);
  });
});
