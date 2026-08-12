import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IdentityCapabilities } from '../identity/types';
import {
  adjustTreeGeneration,
  clarifyTreeGeneration,
  confirmTreeGeneration,
  createTreeGeneration,
  readGenerationRun,
  readTreeGeneration,
  replanTreeGeneration,
} from './treeGenerationClient';
import type {
  DeepSeekModel,
  GenerationInput,
  GenerationRun,
  GenerationSession,
  ModelAccess,
  ReasoningEffort,
  ThinkingMode,
} from './types';

interface TreeGenerationDialogProps {
  capabilities: IdentityCapabilities['generation'];
  csrfToken: string;
  sessionId: string | null;
  onSessionIdChange: (sessionId: string | null) => void;
  onComplete: (libraryEntryId: string) => void;
  onClose: () => void;
}

type RevisionKind = 'replan' | 'adjust';

const EMPTY_INPUT: GenerationInput = {
  topic: '',
  role: '',
  goalDescription: '',
  learnerContextSummary: '',
};

export default function TreeGenerationDialog({
  capabilities,
  csrfToken,
  sessionId,
  onSessionIdChange,
  onComplete,
  onClose,
}: TreeGenerationDialogProps) {
  const queryClient = useQueryClient();
  const [currentSessionId, setCurrentSessionId] = useState(sessionId);
  const [input, setInput] = useState<GenerationInput>(EMPTY_INPUT);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState<DeepSeekModel>(
    capabilities.models[0] ?? 'deepseek-v4-flash',
  );
  const [thinking, setThinking] = useState<ThinkingMode>(
    capabilities.thinkingModes.includes('disabled')
      ? 'disabled'
      : (capabilities.thinkingModes[0] ?? 'disabled'),
  );
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(
    capabilities.reasoningEfforts.includes('low')
      ? 'low'
      : (capabilities.reasoningEfforts[0] ?? 'high'),
  );
  const [clarification, setClarification] = useState('');
  const [revisionKind, setRevisionKind] = useState<RevisionKind | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [confirmedRunId, setConfirmedRunId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const completedEntryRef = useRef<string | null>(null);

  useEffect(() => {
    setCurrentSessionId(sessionId);
    setConfirmedRunId(null);
    completedEntryRef.current = null;
  }, [sessionId]);

  const sessionQuery = useQuery({
    queryKey: generationSessionQueryKey(currentSessionId),
    queryFn: () => readTreeGeneration(currentSessionId ?? ''),
    enabled: currentSessionId !== null,
    staleTime: 30_000,
    retry: false,
  });
  const session = sessionQuery.data ?? null;
  const runId = confirmedRunId ?? session?.latestRun?.runId ?? null;
  const runQuery = useQuery({
    queryKey: generationRunQueryKey(currentSessionId, runId),
    queryFn: () => readGenerationRun(currentSessionId ?? '', runId ?? ''),
    enabled: currentSessionId !== null && runId !== null,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'running' ? 2_000 : false;
    },
  });
  const activeRun = runQuery.data ?? session?.latestRun ?? null;

  const rememberSession = (nextSession: GenerationSession) => {
    const nextSessionId = nextSession.generationSessionId;
    queryClient.setQueryData(
      generationSessionQueryKey(nextSessionId),
      nextSession,
    );
    setCurrentSessionId(nextSessionId);
    if (nextSessionId !== currentSessionId) onSessionIdChange(nextSessionId);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createTreeGeneration(normalizeInput(input), modelAccess(), csrfToken),
    onSuccess: (created) => {
      setLocalError(null);
      rememberSession(created);
    },
  });
  const revisionMutation = useMutation({
    mutationFn: async ({
      kind,
      feedback,
    }: {
      kind: RevisionKind;
      feedback: string;
    }) => {
      if (!session?.latestPlan || !currentSessionId) {
        throw new Error('生成规划尚未加载。');
      }
      const access = modelAccess();
      return kind === 'replan'
        ? replanTreeGeneration(
            currentSessionId,
            session.latestPlan.version,
            feedback.trim(),
            access,
            csrfToken,
          )
        : adjustTreeGeneration(
            currentSessionId,
            session.latestPlan.version,
            feedback.trim(),
            access,
            csrfToken,
          );
    },
    onSuccess: (revised) => {
      setLocalError(null);
      setRevisionKind(null);
      setRevisionFeedback('');
      rememberSession(revised);
    },
  });
  const clarificationMutation = useMutation({
    mutationFn: () => {
      if (!session?.latestPlan || !currentSessionId) {
        throw new Error('生成规划尚未加载。');
      }
      return clarifyTreeGeneration(
        currentSessionId,
        session.latestPlan.version,
        clarification.trim(),
        modelAccess(),
        csrfToken,
      );
    },
    onSuccess: (clarified) => {
      setLocalError(null);
      setClarification('');
      rememberSession(clarified);
    },
  });
  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!session?.latestPlan || !currentSessionId) {
        throw new Error('生成规划尚未加载。');
      }
      return confirmTreeGeneration(
        currentSessionId,
        session.latestPlan.version,
        createIdempotencyKey(),
        modelAccess(),
        csrfToken,
      );
    },
    onSuccess: (createdRun) => {
      setLocalError(null);
      setConfirmedRunId(createdRun.runId);
      queryClient.setQueryData(
        generationRunQueryKey(currentSessionId, createdRun.runId),
        createdRun,
      );
      if (session) {
        queryClient.setQueryData(
          generationSessionQueryKey(currentSessionId),
          { ...session, state: 'queued', latestRun: createdRun },
        );
      }
    },
  });

  useEffect(() => {
    if (
      !activeRun ||
      (activeRun.status !== 'succeeded' && activeRun.status !== 'failed') ||
      !currentSessionId ||
      session?.state === 'succeeded' ||
      (activeRun.status === 'failed' && session?.state === 'plan_ready')
    ) {
      return;
    }
    void sessionQuery.refetch();
  }, [activeRun?.status, currentSessionId, session?.state, sessionQuery.refetch]);

  useEffect(() => {
    const entryId = session?.producedLibraryEntryId;
    if (session?.state !== 'succeeded' || !entryId) return;
    if (completedEntryRef.current === entryId) return;
    completedEntryRef.current = entryId;
    onComplete(entryId);
  }, [onComplete, session?.producedLibraryEntryId, session?.state]);

  const synchronousPending =
    createMutation.isPending ||
    revisionMutation.isPending ||
    clarificationMutation.isPending ||
    confirmMutation.isPending;
  const visibleError =
    localError ??
    readableError(createMutation.error) ??
    readableError(revisionMutation.error) ??
    readableError(clarificationMutation.error) ??
    readableError(confirmMutation.error) ??
    readableError(sessionQuery.error) ??
    readableError(runQuery.error);

  function modelAccess(): ModelAccess {
    if (!apiKey.trim()) throw new Error('请输入 DeepSeek API Key。');
    return { apiKey, model, thinking, reasoningEffort };
  }

  const submitInitial = (event: FormEvent) => {
    event.preventDefault();
    if (Object.values(input).some((value) => !value.trim())) {
      setLocalError('请完整填写四项学习需求。');
      return;
    }
    if (!apiKey.trim()) {
      setLocalError('请输入 DeepSeek API Key。');
      return;
    }
    setLocalError(null);
    createMutation.mutate();
  };

  const submitClarification = (event: FormEvent) => {
    event.preventDefault();
    if (!clarification.trim() || !apiKey.trim()) {
      setLocalError('请填写补充信息，并重新输入 DeepSeek API Key。');
      return;
    }
    setLocalError(null);
    clarificationMutation.mutate();
  };

  const submitRevision = (event: FormEvent) => {
    event.preventDefault();
    if (!revisionKind || !revisionFeedback.trim() || !apiKey.trim()) {
      setLocalError('请填写修改要求，并重新输入 DeepSeek API Key。');
      return;
    }
    setLocalError(null);
    revisionMutation.mutate({ kind: revisionKind, feedback: revisionFeedback });
  };

  const confirm = () => {
    if (!apiKey.trim()) {
      setLocalError('确认前请重新输入 DeepSeek API Key。');
      return;
    }
    setLocalError(null);
    confirmMutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !synchronousPending) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="tree-generation-dialog-title"
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-cyan-950/40"
      >
        <header className="flex shrink-0 items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
              MapFlow Generator
            </p>
            <h2
              id="tree-generation-dialog-title"
              className="mt-1 text-lg font-semibold text-white"
            >
              生成新技能树
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              先审阅路线，再由你明确确认正式生成。
            </p>
          </div>
          <button
            type="button"
            aria-label="最小化技能树生成器（后台任务继续）"
            title="最小化；已提交的后台任务会继续运行"
            disabled={synchronousPending}
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xl leading-none text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40"
          >
            −
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto p-5">
          <ModelConfiguration
            apiKey={apiKey}
            capabilities={capabilities}
            model={model}
            thinking={thinking}
            reasoningEffort={reasoningEffort}
            onApiKeyChange={setApiKey}
            onModelChange={setModel}
            onThinkingChange={setThinking}
            onReasoningEffortChange={setReasoningEffort}
          />

          <div className="mt-5">
            {!currentSessionId ? (
              <InitialGenerationForm
                input={input}
                pending={createMutation.isPending}
                onChange={setInput}
                onSubmit={submitInitial}
              />
            ) : sessionQuery.isPending && !session ? (
              <WorkflowStatus message="正在恢复生成会话…" />
            ) : session ? (
              <SessionWorkflow
                session={session}
                run={activeRun}
                clarification={clarification}
                revisionKind={revisionKind}
                revisionFeedback={revisionFeedback}
                pending={synchronousPending}
                onClarificationChange={setClarification}
                onSubmitClarification={submitClarification}
                onRevisionKindChange={(kind) => {
                  setRevisionKind(kind);
                  setRevisionFeedback('');
                  setLocalError(null);
                }}
                onRevisionFeedbackChange={setRevisionFeedback}
                onSubmitRevision={submitRevision}
                onConfirm={confirm}
              />
            ) : (
              <WorkflowStatus message="生成会话暂时无法读取。" />
            )}
          </div>

          <StatusMessage message={visibleError} />
        </div>
      </section>
    </div>
  );
}

function ModelConfiguration({
  capabilities,
  apiKey,
  model,
  thinking,
  reasoningEffort,
  onApiKeyChange,
  onModelChange,
  onThinkingChange,
  onReasoningEffortChange,
}: {
  capabilities: IdentityCapabilities['generation'];
  apiKey: string;
  model: DeepSeekModel;
  thinking: ThinkingMode;
  reasoningEffort: ReasoningEffort;
  onApiKeyChange: (value: string) => void;
  onModelChange: (value: DeepSeekModel) => void;
  onThinkingChange: (value: ThinkingMode) => void;
  onReasoningEffortChange: (value: ReasoningEffort) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/55 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">模型配置</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            仅连接服务器固定的 DeepSeek 官方地址；密钥不会写入浏览器存储。
          </p>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
          BYOK
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="DeepSeek API Key">
          <input
            type="password"
            name="mapflow-deepseek-api-key"
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            data-1p-ignore="true"
            data-lpignore="true"
            placeholder="未填写"
            maxLength={512}
            value={apiKey}
            onChange={(event) => onApiKeyChange(event.target.value)}
            className={inputClassName}
          />
        </Field>
        <Field label="模型">
          <select
            value={model}
            onChange={(event) => onModelChange(event.target.value as DeepSeekModel)}
            className={inputClassName}
          >
            {capabilities.models.map((allowedModel) => (
              <option key={allowedModel} value={allowedModel}>
                {allowedModel}
              </option>
            ))}
          </select>
        </Field>
        <Field label="思考模式">
          <select
            value={thinking}
            onChange={(event) => onThinkingChange(event.target.value as ThinkingMode)}
            className={inputClassName}
          >
            {capabilities.thinkingModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </Field>
        <Field label="思考强度">
          <select
            disabled={thinking === 'disabled'}
            value={reasoningEffort}
            onChange={(event) =>
              onReasoningEffortChange(event.target.value as ReasoningEffort)
            }
            className={inputClassName}
          >
            {capabilities.reasoningEfforts.map((effort) => (
              <option key={effort} value={effort}>
                {effort}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        默认关闭思考以缩短等待时间；开启后可选 Low、High、Max。High 和 Max
        通常更慢、消耗更多 Token。
      </p>
    </section>
  );
}

function InitialGenerationForm({
  input,
  pending,
  onChange,
  onSubmit,
}: {
  input: GenerationInput;
  pending: boolean;
  onChange: (input: GenerationInput) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-100">学习需求</h3>
        <p className="mt-1 text-xs text-slate-500">四项资料会一次性提交给规划模型。</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="想学习什么知识？"
          description="用于确定技能树的主题边界，避免范围过宽或过窄。"
        >
          <textarea
            aria-label="想学习什么知识？"
            required
            maxLength={2000}
            rows={3}
            value={input.topic}
            onChange={(event) => onChange({ ...input, topic: event.target.value })}
            className={inputClassName}
          />
        </Field>
        <Field
          label="希望走什么职业或应用方向？"
          description="职业或应用方向会调整节点重点、先后顺序和建议学习深度。"
        >
          <textarea
            aria-label="希望走什么职业或应用方向？"
            required
            maxLength={2000}
            rows={3}
            value={input.role}
            onChange={(event) => onChange({ ...input, role: event.target.value })}
            className={inputClassName}
          />
        </Field>
        <Field
          label="希望最终达到什么目标？"
          description="用于设定路线终点、可交付成果和完成标准。"
        >
          <textarea
            aria-label="希望最终达到什么目标？"
            required
            maxLength={2000}
            rows={4}
            value={input.goalDescription}
            onChange={(event) =>
              onChange({ ...input, goalDescription: event.target.value })
            }
            className={inputClassName}
          />
        </Field>
        <Field
          label="当前基础、限制和学习偏好是什么？"
          description="用于跳过已掌握内容，并适配你的时间、前置知识和练习方式。"
        >
          <textarea
            aria-label="当前基础、限制和学习偏好是什么？"
            required
            maxLength={2000}
            rows={4}
            value={input.learnerContextSummary}
            onChange={(event) =>
              onChange({ ...input, learnerContextSummary: event.target.value })
            }
            className={inputClassName}
          />
        </Field>
      </div>
      <button type="submit" disabled={pending} className={primaryButtonClassName}>
        {pending ? '正在生成规划…' : '生成规划'}
      </button>
    </form>
  );
}

function SessionWorkflow({
  session,
  run,
  clarification,
  revisionKind,
  revisionFeedback,
  pending,
  onClarificationChange,
  onSubmitClarification,
  onRevisionKindChange,
  onRevisionFeedbackChange,
  onSubmitRevision,
  onConfirm,
}: {
  session: GenerationSession;
  run: GenerationRun | null;
  clarification: string;
  revisionKind: RevisionKind | null;
  revisionFeedback: string;
  pending: boolean;
  onClarificationChange: (value: string) => void;
  onSubmitClarification: (event: FormEvent) => void;
  onRevisionKindChange: (kind: RevisionKind | null) => void;
  onRevisionFeedbackChange: (value: string) => void;
  onSubmitRevision: (event: FormEvent) => void;
  onConfirm: () => void;
}) {
  if (session.state === 'succeeded') {
    return (
      <WorkflowStatus
        title="生成完成"
        message="技能树已经原子写入你的个人树库，公共树池不会自动出现它。"
      />
    );
  }
  if (session.state === 'queued' || session.state === 'running') {
    return <RunProgress run={run} />;
  }

  if (!session.latestPlan) {
    return (
      <WorkflowStatus
        title={session.state === 'planning' ? '正在准备规划' : '规划不可用'}
        message={
          session.state === 'planning'
            ? '服务器正在后台准备技能树规划，请稍候。'
            : '当前生成会话没有可用的规划。'
        }
      />
    );
  }

  const outcome = session.latestPlan.outcome;
  if (outcome.outcome === 'needs_input') {
    return (
      <section className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
          规划模型需要一项补充
        </p>
        <h3 className="mt-2 text-base font-semibold text-slate-100">
          {outcome.question}
        </h3>
        <form className="mt-4" onSubmit={onSubmitClarification}>
          <Field label="补充信息">
            <textarea
              required
              maxLength={2000}
              rows={3}
              value={clarification}
              onChange={(event) => onClarificationChange(event.target.value)}
              className={inputClassName}
            />
          </Field>
          <button type="submit" disabled={pending} className={primaryButtonClassName}>
            {pending ? '正在更新规划…' : '提交补充信息'}
          </button>
        </form>
      </section>
    );
  }

  return (
    <div>
      {run?.status === 'failed' && (
        <p role="alert" className="mb-4 rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-xs text-rose-300">
          {generationRunErrorMessage(run.errorCode)}
        </p>
      )}
      <PlanCard session={session} />
      {revisionKind ? (
        <form
          className="mt-4 rounded-xl border border-slate-700 bg-slate-950/45 p-4"
          onSubmit={onSubmitRevision}
        >
          <Field
            label={revisionKind === 'replan' ? '重新规划要求' : '细节调整要求'}
          >
            <textarea
              autoFocus
              required
              maxLength={2000}
              rows={4}
              value={revisionFeedback}
              onChange={(event) => onRevisionFeedbackChange(event.target.value)}
              className={inputClassName}
            />
          </Field>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => onRevisionKindChange(null)}
              className={secondaryButtonClassName}
            >
              返回规划
            </button>
            <button type="submit" disabled={pending} className={primaryInlineButtonClassName}>
              {pending
                ? '正在更新…'
                : revisionKind === 'replan'
                  ? '提交重新规划'
                  : '提交细节调整'}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => onRevisionKindChange('replan')}
            className={secondaryButtonClassName}
          >
            重新规划
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onRevisionKindChange('adjust')}
            className={secondaryButtonClassName}
          >
            调整细节
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={primaryInlineButtonClassName}
          >
            {pending ? '正在提交…' : '确认生成'}
          </button>
        </div>
      )}
    </div>
  );
}

function PlanCard({ session }: { session: GenerationSession }) {
  const plan = session.latestPlan;
  if (!plan) return null;
  const outcome = plan.outcome;
  if (outcome.outcome !== 'plan_ready') return null;
  return (
    <section className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            第 {plan.version} 版规划
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-100">
            {outcome.normalizedSpec.topic} 学习路线
          </h3>
        </div>
        <span className="rounded-full border border-cyan-400/30 px-3 py-1 text-xs text-cyan-200">
          预计 {outcome.estimatedNodes} 个节点
        </span>
      </div>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2">
        {outcome.stages.map((stage, index) => (
          <li key={`${index}-${stage.title}`} className="rounded-lg border border-slate-800 bg-slate-950/55 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              阶段 {index + 1}
            </p>
            <h4 className="mt-1 text-sm font-semibold text-slate-100">{stage.title}</h4>
            <p className="mt-1 text-xs leading-5 text-slate-400">{stage.goal}</p>
            <p className="mt-2 text-[11px] text-slate-500">{stage.topics.join(' · ')}</p>
          </li>
        ))}
      </ol>
      <div className="mt-4 border-t border-slate-800 pt-3">
        <h4 className="text-xs font-semibold text-slate-300">范围假设</h4>
        <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-500">
          {outcome.assumptions.map((assumption) => (
            <li key={assumption}>• {assumption}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function RunProgress({ run }: { run: GenerationRun | null }) {
  const progress = Math.round((run?.progress ?? 0) * 100);
  return (
    <section
      role="status"
      aria-label="技能树生成处理中"
      className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-label="生成进度动画"
          className="mt-0.5 inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-cyan-300/25 border-t-cyan-300"
        />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            {run?.status === 'running' ? '正在生成' : '已进入队列'}
          </p>
          <h3 className="mt-2 text-base font-semibold text-slate-100">
            {run?.message ?? '服务器正在后台处理，最小化或关闭页面不会中断任务。'}
          </h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            预计需要 3–5 分钟；复杂主题、High 或 Max 思考强度可能需要更久。
          </p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full animate-pulse rounded-full bg-gradient-to-r from-cyan-500 via-cyan-200 to-cyan-400 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>{run?.stage ?? 'queued'}</span>
        <span>{progress}%</span>
      </div>
    </section>
  );
}

function WorkflowStatus({
  title,
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/45 p-6 text-center">
      {title && <h3 className="text-base font-semibold text-slate-100">{title}</h3>}
      <p className={`${title ? 'mt-2' : ''} text-sm leading-6 text-slate-500`}>
        {message}
      </p>
    </section>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-slate-300">
      <span className="block">{label}</span>
      {description && (
        <span className="mt-1 block text-[11px] font-normal leading-5 text-slate-500">
          （{description}）
        </span>
      )}
      {children}
    </label>
  );
}

function StatusMessage({ message }: { message: string | null }) {
  return (
    <div
      role={message ? 'alert' : undefined}
      className="mt-3 min-h-5 text-xs leading-5 text-rose-300"
    >
      {message}
    </div>
  );
}

function normalizeInput(input: GenerationInput): GenerationInput {
  return {
    topic: input.topic.trim(),
    role: input.role.trim(),
    goalDescription: input.goalDescription.trim(),
    learnerContextSummary: input.learnerContextSummary.trim(),
  };
}

function generationRunErrorMessage(errorCode: string | null): string {
  switch (errorCode) {
    case 'generation.api_key_invalid':
      return 'DeepSeek API Key 无效或已失效，请检查后重新确认生成。';
    case 'generation.insufficient_balance':
      return 'DeepSeek 账户余额不足，请充值或更换 API Key 后重新确认生成。';
    case 'generation.rate_limited':
      return 'DeepSeek 请求过于频繁，请稍后重新确认生成。';
    case 'generation.invalid_model_output':
      return 'DeepSeek 返回的内容格式异常，请重新确认生成。';
    default:
      return '上一次正式生成失败，请检查模型配置后重新确认生成。';
  }
}

function generationSessionQueryKey(sessionId: string | null) {
  return ['me', 'tree-generation', 'session', sessionId] as const;
}

function generationRunQueryKey(sessionId: string | null, runId: string | null) {
  return ['me', 'tree-generation', 'session', sessionId, 'run', runId] as const;
}

function createIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `mapflow-${token}`;
}

function readableError(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

const inputClassName =
  'mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10';
const primaryButtonClassName =
  'mt-4 w-full rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60';
const primaryInlineButtonClassName =
  'rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60';
const secondaryButtonClassName =
  'rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-50';
