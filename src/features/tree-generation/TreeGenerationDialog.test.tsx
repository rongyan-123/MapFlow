import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  abandonPlatformTreeGeneration: vi.fn(),
  adjustPlatformTreeGeneration: vi.fn(),
  clarifyTreeGeneration: vi.fn(),
  clarifyPlatformTreeGeneration: vi.fn(),
  confirmTreeGeneration: vi.fn(),
  confirmPlatformTreeGeneration: vi.fn(),
  createPlatformTreeGeneration: vi.fn(),
  createTreeGeneration: vi.fn(),
  readGenerationRun: vi.fn(),
  readTreeGeneration: vi.fn(),
  releaseFailedPlatformTreeGeneration: vi.fn(),
  replanTreeGeneration: vi.fn(),
  replanPlatformTreeGeneration: vi.fn(),
}));

vi.mock('./treeGenerationClient', () => generationApi);

const capabilities: IdentityCapabilities['generation'] = {
  enabled: true,
  platformFundedEnabled: true,
  models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
  thinkingModes: ['disabled', 'enabled'],
  reasoningEfforts: ['low', 'high', 'max'],
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
    const apiKeyInput = screen.getByLabelText('DeepSeek API Key');
    expect(apiKeyInput).toHaveValue('');
    expect(apiKeyInput).toHaveAttribute('autocomplete', 'new-password');
    expect(apiKeyInput).toHaveAttribute('name', 'mapflow-deepseek-api-key');
    expect(screen.getByLabelText('思考模式')).toHaveValue('disabled');
    expect(screen.getByLabelText('思考强度')).toHaveValue('low');
    expect(screen.getByLabelText('思考强度')).toBeDisabled();
    expect(
      screen.getByText(/职业或应用方向会调整节点重点、先后顺序和建议学习深度/),
    ).toBeInTheDocument();
    expect(screen.getByText(/High 和 Max 通常更慢、消耗更多 Token/)).toBeInTheDocument();

    await fillGenerationForm(user);
    await user.type(screen.getByLabelText('DeepSeek API Key'), 'sk-memory-only');
    await user.click(screen.getByRole('button', { name: '生成规划' }));

    await waitFor(() =>
      expect(generationApi.createTreeGeneration).toHaveBeenCalledWith(
        generationInput,
        {
          apiKey: 'sk-memory-only',
          model: 'deepseek-v4-flash',
          thinking: 'disabled',
          reasoningEffort: 'low',
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

  it('rejects an empty API key locally with a specific explanation', async () => {
    const user = userEvent.setup();
    renderDialog();

    await fillGenerationForm(user);
    await user.click(screen.getByRole('button', { name: '生成规划' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '请输入 DeepSeek API Key。',
    );
    expect(generationApi.createTreeGeneration).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '查看诊断信息' })).not.toBeInTheDocument();
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

  it('shows the single platform clarification allowance and permits abandoning needs-input', async () => {
    const user = userEvent.setup();
    generationApi.readTreeGeneration.mockResolvedValue(platformNeedsInputSession());
    generationApi.clarifyPlatformTreeGeneration.mockResolvedValue(
      platformPlanReadySession(),
    );
    renderDialog({ sessionId: 'platform-session-1' });

    expect(await screen.findByText('每周可以投入多少时间？')).toBeInTheDocument();
    expect(screen.getByText('AI 追问剩余 1 次')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '放弃本次生成' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('补充信息'), {
      target: { value: '每周八小时' },
    });
    await user.click(screen.getByRole('button', { name: '提交补充信息' }));

    await waitFor(() =>
      expect(generationApi.clarifyPlatformTreeGeneration).toHaveBeenCalledWith(
        'platform-session-1',
        1,
        '每周八小时',
        'csrf-secret',
      ),
    );
  });

  it('does not apply platform revision ceilings to a sixth BYOK adjustment', async () => {
    const user = userEvent.setup();
    let version = 1;
    generationApi.readTreeGeneration.mockResolvedValue(planReadySession(version));
    generationApi.adjustTreeGeneration.mockImplementation(() =>
      Promise.resolve(planReadySession(++version)),
    );
    renderDialog({ sessionId: 'session-1' });

    await screen.findByText('基础阶段');
    fireEvent.change(screen.getByLabelText('DeepSeek API Key'), {
      target: { value: 'sk-user-funded' },
    });
    for (let adjustment = 1; adjustment <= 6; adjustment += 1) {
      await user.click(screen.getByRole('button', { name: '调整细节' }));
      fireEvent.change(screen.getByLabelText('细节调整要求'), {
        target: { value: `调整第 ${adjustment} 个细节` },
      });
      await user.click(screen.getByRole('button', { name: '提交细节调整' }));
      await waitFor(() =>
        expect(generationApi.adjustTreeGeneration).toHaveBeenCalledTimes(adjustment),
      );
    }

    expect(generationApi.adjustTreeGeneration).toHaveBeenLastCalledWith(
      'session-1',
      6,
      '调整第 6 个细节',
      expect.objectContaining({ apiKey: 'sk-user-funded' }),
      'csrf-secret',
    );
    expect(generationApi.adjustPlatformTreeGeneration).not.toHaveBeenCalled();
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

  it('shows animated background progress and minimizes without implying cancellation', async () => {
    const user = userEvent.setup();
    generationApi.readTreeGeneration.mockResolvedValue(runningSession());
    generationApi.readGenerationRun.mockResolvedValue(run('running'));
    const { props } = renderDialog({ sessionId: 'session-1' });

    expect(await screen.findByRole('status', { name: '技能树生成处理中' })).toBeInTheDocument();
    expect(screen.getByText(/预计需要 3–5 分钟/)).toBeInTheDocument();
    expect(screen.getByLabelText('生成进度动画')).toHaveClass('animate-spin');
    expect(screen.queryByLabelText(/关闭技能树生成器/)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '最小化技能树生成器（后台任务继续）',
      }),
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('translates a failed background run into an actionable API-key message', async () => {
    const failedRun = { ...run('failed'), errorCode: 'generation.api_key_invalid' };
    generationApi.readTreeGeneration.mockResolvedValue(
      failedSession('generation.api_key_invalid'),
    );
    generationApi.readGenerationRun.mockResolvedValue(failedRun);
    renderDialog({ sessionId: 'session-1' });

    expect(
      await screen.findByText('DeepSeek API Key 无效或已失效，请检查后重新确认生成。'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/generation\.api_key_invalid/)).not.toBeInTheDocument();
  });

  it('uses platform mode without rendering model controls and requires exact second confirmation', async () => {
    const user = userEvent.setup();
    generationApi.createPlatformTreeGeneration.mockResolvedValue(
      platformPlanningSession(),
    );
    renderDialog();

    expect(await screen.findByText('平台免费体验 · 剩余 3 次')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '选择平台免费体验' }));
    expect(screen.queryByLabelText('DeepSeek API Key')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('模型')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('思考模式')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('思考强度')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        '确认后将消耗 1 次生成次数；中途主动放弃将不返还。请务必确认所有信息填写完整后，再点击生成。',
      ),
    ).toBeInTheDocument();

    await fillGenerationForm(user);
    await user.click(screen.getByRole('button', { name: '生成规划' }));
    expect(generationApi.createPlatformTreeGeneration).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: '确认消耗 1 次生成次数？' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '返回检查' }));
    expect(generationApi.createPlatformTreeGeneration).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '生成规划' }));
    await user.click(screen.getByRole('button', { name: '确认并开始' }));

    await waitFor(() =>
      expect(generationApi.createPlatformTreeGeneration).toHaveBeenCalledWith(
        generationInput,
        'csrf-secret',
      ),
    );
    expect(generationApi.createTreeGeneration).not.toHaveBeenCalled();
  });

  it('shows platform planning progress, operation counters and free formal retry', async () => {
    const user = userEvent.setup();
    generationApi.readTreeGeneration
      .mockResolvedValueOnce(platformPlanningSession())
      .mockResolvedValueOnce(platformRetrySession());
    generationApi.confirmPlatformTreeGeneration.mockResolvedValue(run('queued'));
    generationApi.readGenerationRun.mockResolvedValue(run('running'));
    renderDialog({ sessionId: 'platform-session-1' });

    expect(
      await screen.findByRole('status', { name: '技能树规划处理中' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/预计需要 3–5 分钟/)).toBeInTheDocument();

    generationApi.readTreeGeneration.mockResolvedValue(platformRetrySession());
    await waitFor(
      () =>
        expect(screen.getByRole('button', { name: '免费重试生成' })).toBeInTheDocument(),
      { timeout: 3_500 },
    );
    expect(screen.getByText('重新规划（剩余 3 次）')).toBeInTheDocument();
    expect(screen.getByText('细节调整（剩余 5 次）')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '免费重试生成' }));
    await waitFor(() =>
      expect(generationApi.confirmPlatformTreeGeneration).toHaveBeenCalledWith(
        'platform-session-1',
        1,
        expect.any(String),
        'csrf-secret',
      ),
    );
  });

  it('labels platform revision buttons with parenthesized server-owned remaining counts', async () => {
    generationApi.readTreeGeneration.mockResolvedValue(platformPlanReadySession());
    renderDialog({ sessionId: 'platform-session-1' });

    expect(
      await screen.findByRole('button', { name: '重新规划（剩余 3 次）' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '细节调整（剩余 5 次）' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重新规划 3 次' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '细节调整 5 次' })).not.toBeInTheDocument();
  });

  it('shows and copies a closed diagnostic for a failed platform adjustment', async () => {
    const user = userEvent.setup();
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    generationApi.readTreeGeneration.mockResolvedValue(platformPlanReadySession());
    generationApi.adjustPlatformTreeGeneration.mockRejectedValue(
      Object.assign(new Error('MODEL-FREEDOM-SENTINEL'), {
        name: 'TreeGenerationApiError',
        status: 502,
        code: 'generation.planning_follow_up_not_allowed',
        traceId: '81000000-0000-4000-8000-000000000001',
      }),
    );
    renderDialog({ sessionId: '71000000-0000-4000-8000-000000000001' });

    await user.click(
      await screen.findByRole('button', { name: '细节调整（剩余 5 次）' }),
    );
    await user.type(screen.getByLabelText('细节调整要求'), 'USER-FEEDBACK-SENTINEL');
    await user.click(screen.getByRole('button', { name: '提交细节调整' }));
    expect(
      await screen.findByText(
        'DeepSeek 未按当前规划阶段返回结果，本次修改未保存，请重试。',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('MODEL-FREEDOM-SENTINEL')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '查看诊断信息' }));
    await user.click(screen.getByRole('button', { name: '复制诊断信息' }));

    expect(clipboardWrite).toHaveBeenCalledTimes(1);
    const copied = String(clipboardWrite.mock.calls[0][0]);
    expect(JSON.parse(copied)).toMatchObject({
      operation: 'adjust',
      httpStatus: 502,
      errorCode: 'generation.planning_follow_up_not_allowed',
      traceId: '81000000-0000-4000-8000-000000000001',
      sessionId: '71000000-0000-4000-8000-000000000001',
      planVersion: 1,
    });
    expect(copied).not.toContain('MODEL-FREEDOM-SENTINEL');
    expect(copied).not.toContain('USER-FEEDBACK-SENTINEL');
    expect(copied).not.toContain('csrf-secret');
    expect(screen.getByText('诊断信息已复制。')).toBeInTheDocument();
  });

  it('keeps the safe diagnostic selectable when clipboard access fails', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('clipboard denied')) },
    });
    generationApi.readTreeGeneration.mockRejectedValue(
      Object.assign(new Error('private server detail'), {
        name: 'TreeGenerationApiError',
        status: 503,
        code: 'generation.temporarily_unavailable',
        traceId: '83000000-0000-4000-8000-000000000001',
      }),
    );
    renderDialog({ sessionId: '73000000-0000-4000-8000-000000000001' });

    await user.click(await screen.findByRole('button', { name: '查看诊断信息' }));
    await user.click(screen.getByRole('button', { name: '复制诊断信息' }));

    expect(await screen.findByText('复制失败，请手动选择诊断信息。')).toBeInTheDocument();
    expect(screen.getByText(/generation\.temporarily_unavailable/)).toBeInTheDocument();
  });

  it('clears a previous diagnostic after the same adjustment succeeds on retry', async () => {
    const user = userEvent.setup();
    const revised = platformPlanReadySession();
    revised.latestPlan = { ...revised.latestPlan!, version: 2 };
    generationApi.readTreeGeneration.mockResolvedValue(platformPlanReadySession());
    generationApi.adjustPlatformTreeGeneration
      .mockRejectedValueOnce(
        Object.assign(new Error('provider details must stay private'), {
          name: 'TreeGenerationApiError',
          status: 502,
          code: 'generation.invalid_model_output',
          traceId: '82000000-0000-4000-8000-000000000001',
        }),
      )
      .mockResolvedValueOnce(revised);
    renderDialog({ sessionId: '72000000-0000-4000-8000-000000000001' });

    await user.click(
      await screen.findByRole('button', { name: '细节调整（剩余 5 次）' }),
    );
    await user.type(screen.getByLabelText('细节调整要求'), '第一次尝试');
    await user.click(screen.getByRole('button', { name: '提交细节调整' }));
    expect(await screen.findByRole('button', { name: '查看诊断信息' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '提交细节调整' }));

    await waitFor(() =>
      expect(generationApi.adjustPlatformTreeGeneration).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '查看诊断信息' })).not.toBeInTheDocument(),
    );
  });

  it('offers release after the first system failure and refreshes account entitlements', async () => {
    const user = userEvent.setup();
    generationApi.readTreeGeneration.mockResolvedValue(platformRetrySession());
    generationApi.releaseFailedPlatformTreeGeneration.mockResolvedValue(
      platformTerminalFailureSession(),
    );
    const { props } = renderDialog({ sessionId: 'platform-session-1' });

    expect(
      await screen.findByText('本次由系统原因失败，尚未扣除次数，可免费重试 1 次。'),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: '结束失败会话并返还次数' }),
    );

    await waitFor(() =>
      expect(generationApi.releaseFailedPlatformTreeGeneration).toHaveBeenCalledWith(
        'platform-session-1',
        'csrf-secret',
      ),
    );
    expect(props.onPlatformEntitlementsChanged).toHaveBeenCalledTimes(1);
    expect(props.onSessionIdChange).toHaveBeenCalledWith(null);
  });

  it('shows an automatically refunded terminal failure without retry or abandon actions', async () => {
    const user = userEvent.setup();
    generationApi.readTreeGeneration.mockResolvedValue(platformTerminalFailureSession());
    const { props } = renderDialog({ sessionId: 'platform-session-1' });

    expect(
      await screen.findByText('最终生成失败，本次次数已自动返还。'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '免费重试生成' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '放弃本次生成' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '结束失败会话并返还次数' }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(props.onPlatformEntitlementsChanged).toHaveBeenCalledTimes(1),
    );
    await user.click(screen.getByRole('button', { name: '关闭并重新开始' }));
    expect(props.onSessionIdChange).toHaveBeenCalledWith(null);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps BYOK available when platform funding is disabled', () => {
    renderDialog({
      generationCapabilities: { ...capabilities, platformFundedEnabled: false },
      entitlements: null,
    });

    expect(screen.getByLabelText('DeepSeek API Key')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '选择平台免费体验' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '选择使用自己的 API Key' })).toBeEnabled();
  });

  it('abandons only after a separate warning and invalidates entitlement state', async () => {
    const user = userEvent.setup();
    generationApi.readTreeGeneration.mockResolvedValue(platformPlanReadySession());
    generationApi.abandonPlatformTreeGeneration.mockResolvedValue(
      platformAbandonedSession(),
    );
    renderDialog({ sessionId: 'platform-session-1' });

    await screen.findByText('基础阶段');
    await user.click(screen.getByRole('button', { name: '放弃本次生成' }));
    expect(
      screen.getByRole('dialog', { name: '确认放弃平台生成' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/中途主动放弃将不返还/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认放弃且不返还' }));

    await waitFor(() =>
      expect(generationApi.abandonPlatformTreeGeneration).toHaveBeenCalledWith(
        'platform-session-1',
        'csrf-secret',
      ),
    );
  });
});

function renderDialog({
  sessionId = null,
  generationCapabilities = capabilities,
  entitlements = entitlementSummary(),
}: {
  sessionId?: string | null;
  generationCapabilities?: IdentityCapabilities['generation'];
  entitlements?: ReturnType<typeof entitlementSummary> | null;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const props = {
    capabilities: generationCapabilities,
    csrfToken: 'csrf-secret',
    sessionId,
    platformEntitlements: entitlements,
    onSessionIdChange: vi.fn(),
    onPlatformEntitlementsChanged: vi.fn(),
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
    fundingMode: 'byok',
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
    platformLimits: null,
  };
}

function needsInputSession(): GenerationSession {
  const session = planReadySession();
  const latestPlan = session.latestPlan;
  if (!latestPlan) throw new Error('test fixture requires a plan');
  return {
    ...session,
    state: 'needs_input',
    latestPlan: {
      ...latestPlan,
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

function runningSession(): GenerationSession {
  return {
    ...planReadySession(),
    state: 'running',
    latestRun: run('running'),
  };
}

function failedSession(errorCode: string): GenerationSession {
  return {
    ...planReadySession(),
    latestRun: { ...run('failed'), errorCode },
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

function entitlementSummary() {
  return {
    totalGranted: 3,
    available: 3,
    reserved: 0,
    consumed: 0,
    activePlatformSessionId: null,
    platformModeAvailable: true,
  };
}

function platformLimits(formalRunAttemptsRemaining = 2) {
  return {
    replansRemaining: 3,
    adjustmentsRemaining: 5,
    clarificationQuestionsRemaining: 1,
    formalRunAttemptsRemaining,
  };
}

function platformPlanReadySession(): GenerationSession {
  return {
    ...planReadySession(),
    generationSessionId: 'platform-session-1',
    fundingMode: 'platform',
    platformLimits: platformLimits(),
  };
}

function platformPlanningSession(): GenerationSession {
  return {
    ...platformPlanReadySession(),
    state: 'planning',
    latestPlan: null,
  };
}

function platformNeedsInputSession(): GenerationSession {
  const session = needsInputSession();
  return {
    ...session,
    generationSessionId: 'platform-session-1',
    fundingMode: 'platform',
    platformLimits: platformLimits(),
  };
}

function platformRetrySession(): GenerationSession {
  return {
    ...platformPlanReadySession(),
    latestRun: { ...run('failed'), errorCode: 'generation.provider_unavailable' },
    platformLimits: platformLimits(1),
  };
}

function platformAbandonedSession(): GenerationSession {
  return { ...platformPlanReadySession(), state: 'abandoned' };
}

function platformTerminalFailureSession(): GenerationSession {
  return {
    ...platformRetrySession(),
    state: 'failed',
    platformLimits: platformLimits(0),
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
