import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IdentityCapabilities } from '../identity/types';
import TreeGenerationDialog from './TreeGenerationDialog';
import type {
  GenerationInput,
  GenerationRun,
  GenerationSession,
} from './types';

const generationApi = vi.hoisted(() => ({
  adjustTreeGeneration: vi.fn(),
  clarifyTreeGeneration: vi.fn(),
  confirmTreeGeneration: vi.fn(),
  createTreeGeneration: vi.fn(),
  readGenerationRun: vi.fn(),
  readTreeGeneration: vi.fn(),
  replanTreeGeneration: vi.fn(),
}));

vi.mock('./treeGenerationClient', () => generationApi);

const capabilities: IdentityCapabilities['generation'] = {
  enabled: true,
  models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
  thinkingModes: ['enabled', 'disabled'],
  reasoningEfforts: ['high', 'max'],
};

const generationInput: GenerationInput = {
  topic: 'Rust',
  role: '后端开发者',
  goalDescription: '独立交付可靠的 Web 服务',
  learnerContextSummary: 'TypeScript 基础，每周八小时，偏好项目练习',
};

beforeEach(() => {
  for (const mock of Object.values(generationApi)) mock.mockReset();
});

afterEach(() => cleanup());

describe('TreeGenerationDialog', () => {
  it('collects only the four fixed learning fields and keeps the API key in component memory', async () => {
    const user = userEvent.setup();
    generationApi.createTreeGeneration.mockResolvedValue(planReadySession());
    const first = renderDialog();

    expect(screen.getByRole('dialog', { name: '生成新技能树' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /聊天/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /发送/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'deepseek-v4-flash' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'deepseek-v4-pro' }),
    ).toBeInTheDocument();

    await fillGenerationForm(user);
    await user.type(screen.getByLabelText('DeepSeek API Key'), 'sk-memory-only');
    await user.click(screen.getByRole('button', { name: '生成规划' }));

    await waitFor(() =>
      expect(generationApi.createTreeGeneration).toHaveBeenCalledWith(
        generationInput,
        {
          apiKey: 'sk-memory-only',
          model: 'deepseek-v4-flash',
          thinking: 'enabled',
          reasoningEffort: 'high',
        },
        'csrf-secret',
      ),
    );
    expect(first.props.onSessionIdChange).toHaveBeenCalledWith('session-1');
    expect(await screen.findByText('基础阶段')).toBeInTheDocument();
    expect(screen.getByText('预计 20 个节点')).toBeInTheDocument();
    expect(screen.getByText('范围假设')).toBeInTheDocument();

    first.unmount();
    generationApi.readTreeGeneration.mockResolvedValue(planReadySession());
    renderDialog({ sessionId: 'session-1' });
    expect(await screen.findByText('基础阶段')).toBeInTheDocument();
    expect(screen.getByLabelText('DeepSeek API Key')).toHaveValue('');
  });

  it('keeps replan and detail adjustment as distinct versioned actions', async () => {
    const user = userEvent.setup();
    generationApi.readTreeGeneration.mockResolvedValue(planReadySession());
    generationApi.replanTreeGeneration.mockResolvedValue(planReadySession(2));
    generationApi.adjustTreeGeneration.mockResolvedValue(planReadySession(3));
    renderDialog({ sessionId: 'session-1' });

    expect(await screen.findByText('基础阶段')).toBeInTheDocument();
    await user.type(screen.getByLabelText('DeepSeek API Key'), 'sk-revision');
    await user.click(screen.getByRole('button', { name: '重新规划' }));
    await user.type(
      screen.getByLabelText('重新规划要求'),
      '路线太偏底层，希望两周完成 Web 入门',
    );
    await user.click(screen.getByRole('button', { name: '提交重新规划' }));

    await waitFor(() =>
      expect(generationApi.replanTreeGeneration).toHaveBeenCalledWith(
        'session-1',
        1,
        '路线太偏底层，希望两周完成 Web 入门',
        expect.objectContaining({ apiKey: 'sk-revision' }),
        'csrf-secret',
      ),
    );

    await user.click(screen.getByRole('button', { name: '调整细节' }));
    await user.type(
      screen.getByLabelText('细节调整要求'),
      '保留路线，只把部署阶段提前',
    );
    await user.click(screen.getByRole('button', { name: '提交细节调整' }));

    await waitFor(() =>
      expect(generationApi.adjustTreeGeneration).toHaveBeenCalledWith(
        'session-1',
        2,
        '保留路线，只把部署阶段提前',
        expect.objectContaining({ apiKey: 'sk-revision' }),
        'csrf-secret',
      ),
    );
  });

  it('answers one structured planner question before exposing confirmation', async () => {
    const user = userEvent.setup();
    generationApi.readTreeGeneration.mockResolvedValue(needsInputSession());
    generationApi.clarifyTreeGeneration.mockResolvedValue(planReadySession(2));
    renderDialog({ sessionId: 'session-1' });

    expect(
      await screen.findByText('每周可以投入多少时间？'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '确认生成' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('DeepSeek API Key'), 'sk-clarify');
    await user.type(screen.getByLabelText('补充信息'), '每周八小时');
    await user.click(screen.getByRole('button', { name: '提交补充信息' }));

    await waitFor(() =>
      expect(generationApi.clarifyTreeGeneration).toHaveBeenCalledWith(
        'session-1',
        1,
        '每周八小时',
        expect.objectContaining({ apiKey: 'sk-clarify' }),
        'csrf-secret',
      ),
    );
    expect(await screen.findByRole('button', { name: '确认生成' })).toBeInTheDocument();
  });

  it('starts the expensive run only after confirmation, polls it, and reports the personal entry', async () => {
    const user = userEvent.setup();
    generationApi.readTreeGeneration
      .mockResolvedValueOnce(planReadySession())
      .mockResolvedValueOnce(succeededSession());
    generationApi.confirmTreeGeneration.mockResolvedValue(run('queued'));
    generationApi.readGenerationRun.mockResolvedValue(run('succeeded'));
    const { props } = renderDialog({ sessionId: 'session-1' });

    expect(await screen.findByText('基础阶段')).toBeInTheDocument();
    expect(generationApi.confirmTreeGeneration).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /取消生成/ })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('DeepSeek API Key'), 'sk-confirm');
    await user.click(screen.getByRole('button', { name: '确认生成' }));

    await waitFor(() =>
      expect(generationApi.confirmTreeGeneration).toHaveBeenCalledWith(
        'session-1',
        1,
        expect.any(String),
        expect.objectContaining({ apiKey: 'sk-confirm' }),
        'csrf-secret',
      ),
    );
    await waitFor(() =>
      expect(generationApi.readGenerationRun).toHaveBeenCalledWith(
        'session-1',
        'run-1',
      ),
    );
    await waitFor(() =>
      expect(props.onComplete).toHaveBeenCalledWith('library-entry-1'),
    );
  });
});

function renderDialog({ sessionId = null }: { sessionId?: string | null } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const props = {
    capabilities,
    csrfToken: 'csrf-secret',
    sessionId,
    onSessionIdChange: vi.fn(),
    onComplete: vi.fn(),
    onClose: vi.fn(),
  };
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <TreeGenerationDialog {...props} />
      </QueryClientProvider>,
    ),
    props,
  };
}

async function fillGenerationForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('想学习什么知识？'), generationInput.topic);
  await user.type(
    screen.getByLabelText('希望走什么职业或应用方向？'),
    generationInput.role,
  );
  await user.type(
    screen.getByLabelText('希望最终达到什么目标？'),
    generationInput.goalDescription,
  );
  await user.type(
    screen.getByLabelText('当前基础、限制和学习偏好是什么？'),
    generationInput.learnerContextSummary,
  );
}

function planReadySession(version = 1): GenerationSession {
  return {
    generationSessionId: 'session-1',
    input: generationInput,
    state: 'plan_ready',
    latestPlan: {
      version,
      changeKind: version === 1 ? 'initial' : 'replan',
      outcome: {
        outcome: 'plan_ready',
        normalizedSpec: generationInput,
        stages: [
          { title: '基础阶段', goal: '掌握核心语义', topics: ['所有权'] },
          { title: '交付阶段', goal: '部署可用服务', topics: ['Axum'] },
        ],
        assumptions: ['每周投入八小时'],
        estimatedNodes: 20,
      },
      usage: usage(),
    },
    latestRun: null,
    producedTreeId: null,
    producedLibraryEntryId: null,
  };
}

function needsInputSession(): GenerationSession {
  const session = planReadySession();
  return {
    ...session,
    state: 'needs_input',
    latestPlan: {
      ...session.latestPlan,
      outcome: { outcome: 'needs_input', question: '每周可以投入多少时间？' },
    },
  };
}

function succeededSession(): GenerationSession {
  return {
    ...planReadySession(),
    state: 'succeeded',
    latestRun: run('succeeded'),
    producedTreeId: 'tree-1',
    producedLibraryEntryId: 'library-entry-1',
  };
}

function run(status: GenerationRun['status']): GenerationRun {
  return {
    runId: 'run-1',
    status,
    stage: status === 'running' ? 'bridging' : null,
    message: status === 'running' ? '正在整合技能树' : null,
    progress: status === 'succeeded' ? 1 : 0,
    errorCode: null,
    usage: usage(),
  };
}

function usage() {
  return {
    inputTokens: 20,
    outputTokens: 10,
    cacheHitInputTokens: 8,
    cacheMissInputTokens: 12,
  };
}
