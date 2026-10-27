import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SkillNodeComponent, { type SkillFlowNode } from './MapNode';

vi.mock('@xyflow/react', async () => {
  const React = await import('react');
  return {
    Handle: () => React.createElement('div', { 'data-testid': 'handle' }),
    Position: { Top: 'top', Bottom: 'bottom' },
  };
});

function makeFlowNode(
  displayMode: 'showcase' | 'personal',
  title = '测试节点',
): SkillFlowNode {
  return {
    id: 'node-1',
    type: 'skill',
    position: { x: 0, y: 0 },
    data: {
      node: {
        id: 'node-1',
        tree_id: 'tree-1',
        title,
        description: null,
        icon: '🐍',
        category: '测试',
        difficulty: 1,
        estimated_minutes: 10,
        depth_level: 1,
        position_x: 0,
        position_y: 0,
        order_in_level: 1,
        learning_objectives: null,
        key_concepts: null,
        recommended_depth: 'Understand',
        depth_rationale: 'test',
        observable_evidence: 'test',
      },
      progress: null,
      isCurrent: false,
      displayMode,
    },
  };
}

function renderNode(displayMode: 'showcase' | 'personal', title?: string) {
  const node = makeFlowNode(displayMode, title);
  const props = {
    data: node.data,
    selected: false,
  } as React.ComponentProps<typeof SkillNodeComponent>;
  const { container } = render(<SkillNodeComponent {...props} />);
  return container.firstElementChild as HTMLElement;
}

describe('SkillNode 渲染', () => {
  it.each([
    ['not_started',0,'false'],
    ['in_progress',35,'false'],
    ['completed',100,'true'],
    ['mastered',100,'true'],
  ] as const)('only lights a personal %s node according to its saved completion', (status,percent,lit)=>{
    const node=makeFlowNode('personal');
    node.data.branchTone='rose';node.data.ready=false;
    node.data.progress={node_id:node.id,status,progress_percent:percent,evidence:''};
    const props={data:node.data,selected:true} as React.ComponentProps<typeof SkillNodeComponent>;
    const view=render(<SkillNodeComponent {...props} />);
    expect(view.container.firstElementChild).toHaveAttribute('data-mapflow-lit',lit);
    expect(view.container.firstElementChild).toHaveAttribute('data-branch-tone','rose');
    expect(screen.getByText(`${percent}%`)).toBeVisible();
  });
  it('preserves its branch identity while waiting and while changing learning status',()=>{
    const node=makeFlowNode('personal');node.data.branchTone='teal';node.data.ready=false;
    const props={data:node.data,selected:false} as React.ComponentProps<typeof SkillNodeComponent>;
    const view=render(<SkillNodeComponent {...props} />);
    expect(view.container.firstElementChild).toHaveAttribute('data-branch-tone','teal');
    view.rerender(<SkillNodeComponent {...props} selected data={{...node.data,progress:{node_id:node.id,status:'completed',progress_percent:100,evidence:''}}} />);
    expect(view.container.firstElementChild).toHaveAttribute('data-branch-tone','teal');
    expect(screen.getByText('100%')).toBeVisible();
  });
  it.each([[35, 'in_progress', '进行中'], [100, 'completed', '已完成']] as const)('前置未完成时保留%s%%进度和点击，点亮后更新展示', (percent, status, label) => {
    const node = makeFlowNode('personal');
    node.data.ready = false;
    node.data.progress = { node_id: node.id, progress_percent: percent, status, evidence: '' };
    const select = vi.fn();
    const props = { data: node.data, selected: false } as React.ComponentProps<typeof SkillNodeComponent>;
    const view = render(<div onClick={select}><SkillNodeComponent {...props} /></div>);
    expect(screen.getByText('前置未完成')).toBeVisible();
    expect(screen.getByText(`${percent}%`)).toBeVisible();
    expect(screen.getByText(label)).toBeVisible();
    fireEvent.click(screen.getByRole('heading', { name: '测试节点' }));
    expect(select).toHaveBeenCalledOnce();
    view.rerender(<div onClick={select}><SkillNodeComponent {...props} data={{ ...node.data, ready: true }} /></div>);
    expect(screen.queryByText('前置未完成')).not.toBeInTheDocument();
    expect(screen.getByText(`${percent}%`)).toBeVisible();
    expect(screen.getByText(label)).toBeVisible();
  });
  it('public preview shows the depth and does not claim personal progress', () => {
    renderNode('showcase');
    expect(screen.getByText(/Understand/)).toBeVisible();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('为主题对比度样式暴露节点状态标记', () => {
    const node = renderNode('personal');

    expect(node).toHaveAttribute('data-mapflow-skill-node', 'true');
    expect(node).toHaveAttribute('data-mapflow-node-status', 'not_started');
  });

  it('长标题在节点内换行并保留完整标题提示', () => {
    const title = '生产级 Agent AI 应用后端完整体系（NestJS）';
    renderNode('showcase', title);

    const heading = screen.getByRole('heading', { name: title });
    expect(heading).toHaveAttribute('title', title);
    expect(heading).not.toHaveClass('truncate');
  });
});
