import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LandingPage from './LandingPage';

describe('LandingPage', () => {
  it('用直接的学习痛点说明 MapFlow，并提供可操作的 3D 技能树入口', async () => {
    render(
      <LandingPage
        session={null}
        onEnterConsole={vi.fn()}
        onLogin={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', {
        name: /不想再看无聊的网课.*从你真正想学的地方开始/s,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/把一门复杂技术拆成一棵可以探索、可以执行的技能树/),
    ).toBeInTheDocument();
    expect(screen.getByTestId('product-landing')).toHaveClass('h-full');
    expect(screen.getByTestId('landing-hero-grid')).toHaveClass('grid-cols-1', 'min-w-0');
    expect(screen.getByTestId('landing-hero-copy')).toHaveClass('w-full', 'min-w-0');
    expect(await screen.findByTestId('skill-tree-3d')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: '重置技能树视角' }),
    ).toBeInTheDocument();
    expect(screen.getByText('旋转、拖动，找到你真正想学的那个节点。')).toBeInTheDocument();
  });
});
