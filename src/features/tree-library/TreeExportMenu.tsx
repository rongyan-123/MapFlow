import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PersonalTreeDetail } from './types';
import { downloadTreeExport } from './treeExport';

interface TreeExportMenuProps {
  detail: PersonalTreeDetail | null;
  loadDetail?: () => Promise<PersonalTreeDetail>;
  triggerAriaLabel?: string;
  compact?: boolean;
  variant?: 'default' | 'drawer';
}

export default function TreeExportMenu({
  detail,
  loadDetail,
  triggerAriaLabel = '导出技能树',
  compact = false,
  variant = 'default',
}: TreeExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadedDetail, setLoadedDetail] = useState<PersonalTreeDetail | null>(detail);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadedDetail(detail);
  }, [detail]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const toggleOpen = async () => {
    if (open) {
      setOpen(false);
      return;
    }

    setLoadError(null);
    const existingDetail = detail ?? loadedDetail;
    if (existingDetail) {
      setOpen(true);
      return;
    }
    if (!loadDetail) {
      setLoadError('当前技能树详情暂不可用。');
      return;
    }

    setLoading(true);
    try {
      const nextDetail = await loadDetail();
      setLoadedDetail(nextDetail);
      setOpen(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '读取技能树详情失败。');
    } finally {
      setLoading(false);
    }
  };

  const startDownload = (format: 'json' | 'markdown') => {
    const exportDetail = detail ?? loadedDetail;
    if (!exportDetail) return;
    setOpen(false);
    downloadTreeExport(exportDetail, format);
  };

  return (
    <>
      <button
        type="button"
        aria-label={triggerAriaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={loading || undefined}
        disabled={loading}
        onClick={() => void toggleOpen()}
        className={
          variant === 'drawer'
            ? 'mapflow-tree-action mapflow-tree-action--uniform mapflow-tree-action--export flex w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-semibold leading-tight transition duration-200 disabled:cursor-wait'
            : compact
            ? 'flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-[11px] font-semibold text-slate-400 transition hover:border-cyan-400/60 hover:text-cyan-200 disabled:cursor-wait disabled:opacity-70'
            : 'flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-2.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/60 hover:text-cyan-200 disabled:cursor-wait disabled:opacity-70'
        }
      >
        <span aria-hidden="true" className={variant === 'drawer' ? 'text-base leading-none' : undefined}>
          ⇩
        </span>
        <span>{loading ? '读取中…' : '导出'}</span>
      </button>
      {loadError && (
        <span role="alert" className="mt-1 max-w-40 text-right text-[10px] leading-4 text-rose-300">
          {loadError}
        </span>
      )}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-testid="tree-export-overlay"
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="tree-export-dialog-title"
              className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            >
              <header className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
                    MapFlow
                  </p>
                  <h2 id="tree-export-dialog-title" className="mt-1 text-base font-semibold text-slate-100">
                    导出技能树
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="关闭导出窗口"
                  autoFocus
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2 py-1 text-xl leading-none text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
                >
                  ×
                </button>
              </header>
              <p className="mt-3 text-xs leading-5 text-slate-400">
                选择一种格式下载当前技能树、节点关系和你的学习进度，不包含账号或平台私密信息。
              </p>
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => startDownload('json')}
                  className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-2.5 text-left text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/15"
                >
                  下载 JSON（完整结构）
                </button>
                <button
                  type="button"
                  onClick={() => startDownload('markdown')}
                  className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-left text-sm font-semibold text-slate-300 transition hover:border-cyan-400/60 hover:text-white"
                >
                  下载 Markdown（便于阅读）
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
