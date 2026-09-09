import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ConsoleOnboarding from './ConsoleOnboarding';
import { createDefaultOnboardingState } from './onboardingState';

function renderOnboarding(
  overrides: Partial<React.ComponentProps<typeof ConsoleOnboarding>> = {},
) {
  const props: React.ComponentProps<typeof ConsoleOnboarding> = {
    state: createDefaultOnboardingState(),
    onChange: vi.fn(),
    onSkip: vi.fn(),
    onReopen: vi.fn(),
    onOpenAgentGuide: vi.fn(),
    ...overrides,
  };
  return { ...render(<ConsoleOnboarding {...props} />), props };
}

describe('ConsoleOnboarding', () => {
  it('offers the two approved paths with audience guidance', () => {
    renderOnboarding();

    expect(screen.getByRole('button', { name: '直接在网站开始' })).toHaveTextContent(
      '适用于没接触过 Agent 的用户',
    );
    expect(screen.getByRole('button', { name: '连接自己的 Agent' })).toHaveTextContent(
      '适用于接触过 Agent 或正在使用 Agent 的用户',
    );
    expect(screen.getByRole('dialog', { name: '选择一种开始方式' })).toBeInTheDocument();
  });

  it('starts the website tour at map generation and keeps Next side-effect free', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderOnboarding({
      state: {
        ...createDefaultOnboardingState(),
        path: 'website',
        websiteStep: 'generate-map',
      },
      onChange,
    });

    expect(screen.getByRole('dialog', { name: '先生成一张属于你的学习地图' })).toBeInTheDocument();
    expect(screen.getByText('生成学习地图')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上一步' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一步' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '跳过引导' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '下一步' }));
    expect(onChange).toHaveBeenCalledWith({ websiteStep: 'public-library' });
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ dismissed: true }));
  });

  it('does not resurrect after skip and Escape uses the same skip boundary', () => {
    const onSkip = vi.fn();
    const onReopen = vi.fn();
    const { rerender } = renderOnboarding({ onSkip });

    fireEvent.keyDown(screen.getByRole('dialog', { name: '选择一种开始方式' }), {
      key: 'Escape',
    });
    expect(onSkip).toHaveBeenCalledOnce();

    rerender(
      <ConsoleOnboarding
        state={{ ...createDefaultOnboardingState(), dismissed: true }}
        onChange={vi.fn()}
        onSkip={onSkip}
        onReopen={onReopen}
        onOpenAgentGuide={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog', { name: '选择一种开始方式' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新打开新手引导' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新打开新手引导' }));
    expect(onReopen).toHaveBeenCalledOnce();
  });

  it('switches to the Agent path without forcing a website tour', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onOpenAgentGuide = vi.fn();

    renderOnboarding({ onChange, onOpenAgentGuide });
    await user.click(screen.getByRole('button', { name: '连接自己的 Agent' }));

    expect(onChange).toHaveBeenCalledWith({ path: 'agent' });
    expect(onOpenAgentGuide).toHaveBeenCalledOnce();
  });

  it('describes one map interaction per step without targeting an empty node', () => {
    renderOnboarding({
      state: {
        ...createDefaultOnboardingState(),
        path: 'website',
        websiteStep: 'map-canvas',
      },
    });

    expect(screen.getByText(/拖动地图、缩放视图/)).toBeInTheDocument();
    expect(screen.queryByTestId('mapflow-onboarding-node-spotlight')).not.toBeInTheDocument();
  });

  it('leaves the page usable while waiting for a node target', () => {
    renderOnboarding({
      state: {
        ...createDefaultOnboardingState(),
        path: 'website',
        websiteStep: 'map-node',
      },
    });

    expect(document.querySelector('.mapflow-onboarding__full-mask')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '收起提示' })).toBeInTheDocument();
  });

  it('keeps chat and progress as explicit, separate tour steps', () => {
    const { rerender } = renderOnboarding({
      state: {
        ...createDefaultOnboardingState(),
        path: 'website',
        websiteStep: 'chat',
      },
    });

    expect(screen.getByRole('dialog', { name: '在聊天里提问' })).toBeInTheDocument();
    expect(screen.getByText(/输入问题后再点击发送/)).toBeInTheDocument();

    rerender(
      <ConsoleOnboarding
        state={{
          ...createDefaultOnboardingState(),
          path: 'website',
          websiteStep: 'progress',
        }}
        onChange={vi.fn()}
        onSkip={vi.fn()}
        onReopen={vi.fn()}
        onOpenAgentGuide={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog', { name: '记录你的学习进度' })).toBeInTheDocument();
    expect(screen.getByText(/按你的理解标记完成/)).toBeInTheDocument();
  });

  it('guides anonymous public-map users through joining before chat', () => {
    const joinButton = document.createElement('button');
    joinButton.dataset.mapflowOnboardingTarget = 'join-personal';
    document.body.appendChild(joinButton);

    renderOnboarding({
      state: {
        ...createDefaultOnboardingState(),
        path: 'website',
        websiteStep: 'chat',
      },
    });

    expect(screen.getByRole('dialog', { name: '先把地图加入我的学习' })).toBeInTheDocument();
    expect(screen.getByText(/公共地图先点击“加入我的学习”/)).toBeInTheDocument();
    expect(screen.getByText(/回到我的地图，再从节点详情打开聊天/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled();

    joinButton.remove();
  });

  it('does not spotlight a target that is fully outside the viewport', () => {
    const target = document.createElement('button');
    target.dataset.mapflowOnboardingTarget = 'node';
    const rect = {
      top: 900,
      right: 1040,
      bottom: 940,
      left: 1000,
      width: 40,
      height: 40,
      x: 1000,
      y: 900,
      toJSON: () => ({}),
    } as DOMRect;
    target.getClientRects = (() => [rect]) as unknown as () => DOMRectList;
    target.getBoundingClientRect = () => rect;
    document.body.appendChild(target);

    renderOnboarding({
      state: {
        ...createDefaultOnboardingState(),
        path: 'website',
        websiteStep: 'map-node',
      },
    });

    expect(screen.queryByTestId('mapflow-onboarding-spotlight')).not.toBeInTheDocument();
    target.remove();
  });

  it('re-measures when a route target appears after the tour mounted', async () => {
    renderOnboarding({
      state: {
        ...createDefaultOnboardingState(),
        path: 'website',
        websiteStep: 'map-node',
      },
    });

    expect(screen.queryByTestId('mapflow-onboarding-spotlight')).not.toBeInTheDocument();
    const target = document.createElement('button');
    target.dataset.mapflowOnboardingTarget = 'node';
    const rect = {
      top: 120,
      right: 220,
      bottom: 180,
      left: 120,
      width: 100,
      height: 60,
      x: 120,
      y: 120,
      toJSON: () => ({}),
    } as DOMRect;
    target.getClientRects = (() => [rect]) as unknown as () => DOMRectList;
    target.getBoundingClientRect = () => rect;
    document.body.appendChild(target);

    await waitFor(() => {
      expect(screen.getByTestId('mapflow-onboarding-spotlight')).toBeInTheDocument();
    });
    target.remove();
  });

  it('keeps a large canvas spotlight tooltip in its corner', async () => {
    const target = document.createElement('div');
    target.dataset.mapflowOnboardingTarget = 'map-surface';
    const rect = {
      top: 100,
      right: 1000,
      bottom: 620,
      left: 100,
      width: 900,
      height: 520,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect;
    target.getClientRects = (() => [rect]) as unknown as () => DOMRectList;
    target.getBoundingClientRect = () => rect;
    document.body.appendChild(target);

    renderOnboarding({
      state: {
        ...createDefaultOnboardingState(),
        path: 'website',
        websiteStep: 'map-canvas',
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '拖动地图、缩放视图' })).toHaveStyle({
        left: '116px',
        top: '116px',
      });
    });
    target.remove();
  });

  it('pauses the portal while another modal is open', () => {
    renderOnboarding({
      paused: true,
      state: { ...createDefaultOnboardingState(), path: 'website' },
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
