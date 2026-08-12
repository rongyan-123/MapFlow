export const PLATFORM_GENERATION_WARNING =
  '确认后将消耗 1 次生成次数；中途主动放弃将不返还。请务必确认所有信息填写完整后，再点击生成。';

interface PlatformGenerationConfirmationProps {
  kind: 'start' | 'abandon';
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function PlatformGenerationConfirmation({
  kind,
  pending,
  onCancel,
  onConfirm,
}: PlatformGenerationConfirmationProps) {
  const starting = kind === 'start';
  const title = starting ? '确认消耗 1 次生成次数？' : '确认放弃平台生成';
  const message = starting
    ? '请再次确认学习主题、职业方向、学习目标和当前基础均已填写完整。继续后将消耗 1 次平台生成次数；若中途主动放弃，次数不返还。若因 DeepSeek 或服务器故障最终未生成成功，次数会自动返还。'
    : '中途主动放弃将不返还本次已预占的生成次数。确认后将结束当前会话，且无法继续恢复。';

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-generation-confirmation-title"
        className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-slate-900 p-5 shadow-2xl"
      >
        <h2
          id="platform-generation-confirmation-title"
          className="text-base font-semibold text-slate-100"
        >
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-amber-100/85">{message}</p>
        {starting && (
          <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-100/75">
            {PLATFORM_GENERATION_WARNING}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 disabled:opacity-50"
          >
            返回检查
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60"
          >
            {starting ? '确认并开始' : '确认放弃且不返还'}
          </button>
        </div>
      </section>
    </div>
  );
}
