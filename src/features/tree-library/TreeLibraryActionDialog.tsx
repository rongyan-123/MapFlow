import { useEffect, useState } from 'react';

export type TreeLibraryAction = 'rename' | 'delete';

interface TreeLibraryActionDialogProps {
  action: TreeLibraryAction | null;
  title: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (nextTitle?: string) => void;
}

export default function TreeLibraryActionDialog({
  action,
  title,
  pending,
  error,
  onCancel,
  onConfirm,
}: TreeLibraryActionDialogProps) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!action) return;
    setDraftTitle(title);
    setValidationError(null);
  }, [action, title]);

  useEffect(() => {
    if (!action) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [action, onCancel, pending]);

  if (!action) return null;

  const isRename = action === 'rename';
  const trimmedTitle = draftTitle.trim();
  const confirm = () => {
    if (!isRename) {
      onConfirm();
      return;
    }
    if (!trimmedTitle) {
      setValidationError('名称不能为空。');
      return;
    }
    if (trimmedTitle.length > 240) {
      setValidationError('名称不能超过 240 个字符。');
      return;
    }
    onConfirm(trimmedTitle);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="关闭技能树操作窗口"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={() => {
          if (!pending) onCancel();
        }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={isRename ? '重命名技能树' : '删除技能树'}
        className="relative w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
      >
        <h2 className="text-base font-semibold text-slate-100">
          {isRename ? '重命名技能树' : '删除技能树'}
        </h2>
        {isRename ? (
          <>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              只会修改你的个人副本名称，不影响公共技能树。
            </p>
            <label className="mt-4 block text-xs font-semibold text-slate-300">
              新的技能树名称
              <input
                type="text"
                aria-label="新的技能树名称"
                value={draftTitle}
                maxLength={240}
                autoFocus
                onChange={(event) => {
                  setDraftTitle(event.target.value);
                  setValidationError(null);
                }}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-normal text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
              />
            </label>
          </>
        ) : (
          <p className="mt-2 text-sm leading-6 text-slate-400">
            删除后，这棵树的学习进度、聊天历史和个人修改都会被移除，公共树不受影响。
          </p>
        )}
        {(validationError || error) && (
          <p role="alert" className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
            {validationError ?? error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            aria-label="取消技能树操作"
            disabled={pending}
            onClick={onCancel}
            className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            aria-label={isRename ? '保存名称' : '确认删除技能树'}
            disabled={pending}
            onClick={confirm}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
              isRename
                ? 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
                : 'bg-rose-400 text-rose-950 hover:bg-rose-300'
            }`}
          >
            {pending ? (isRename ? '保存中…' : '删除中…') : isRename ? '保存名称' : '确认删除技能树'}
          </button>
        </div>
      </section>
    </div>
  );
}
