import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TavernApiError, type Character, type CompatibilityWarning } from './types';

export const buttonClass = 'rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50';
export const primaryClass = 'rounded-xl border border-cyan-200 bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50';
export const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 disabled:opacity-50';

export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  return <div role="alert" className="rounded-xl border border-rose-400/30 bg-slate-900 p-3 text-sm text-rose-300">
    <p>{error instanceof Error ? error.message : '请求失败，请重试。'}</p>
    {error instanceof TavernApiError && error.traceId && <p className="mt-1 break-all text-xs">请求编号：{error.traceId}</p>}
    {onRetry && <button type="button" className={`${buttonClass} mt-2`} onClick={onRetry}>重新加载</button>}
  </div>;
}

export function CompatibilityReport({ warnings }: { warnings: CompatibilityWarning[] }) {
  return <details className="rounded-xl border border-slate-700 p-3" open={warnings.length > 0}>
    <summary className="cursor-pointer text-sm font-semibold">兼容性报告 · {warnings.length ? `${warnings.length} 项已忽略` : '基础文字字段兼容'}</summary>
    <p className="mt-2 text-xs leading-6 text-slate-400">支持角色设定、开场白、名称占位符和基础世界书。脚本、正则、HTML 面板等扩展不会执行。</p>
    {warnings.length > 0 && <ul className="mt-2 space-y-2 text-xs text-amber-300">
      {warnings.map((warning, index) => <li key={`${warning.field}-${index}`} className="break-words">
        <span className="font-mono">{warning.field}</span>：{warning.message} <span className="text-slate-500">({warning.code})</span>
      </li>)}
    </ul>}
  </details>;
}

export function CharacterAvatar({ character, previewUrl, name, large = false }: { character?: Character; previewUrl?: string; name?: string; large?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const label = name ?? character?.card.name ?? '角色';
  // Imported URLs are never loaded. Only our own PNG avatar endpoint is used.
  const url = previewUrl ?? (character?.card.sourceFormat === 'png' && character.avatarUrl
    ? `/api/me/tavern/characters/${encodeURIComponent(character.characterId)}/avatar` : undefined);
  const size = large ? 'h-24 w-24 text-3xl' : 'h-10 w-10 text-lg';
  return url && failedUrl !== url
    ? <img src={url} alt={`${label}头像`} onError={() => setFailedUrl(url)} className={`${size} shrink-0 rounded-2xl border border-slate-700 object-cover`} />
    : <span role="img" aria-label={`${label}默认头像`} className={`${size} flex shrink-0 items-center justify-center rounded-2xl border border-cyan-800 bg-slate-900 font-bold text-cyan-300`}>{Array.from(label)[0] ?? '✦'}</span>;
}

export function TavernDialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const panel = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const busyRef = useRef(busy); busyRef.current = busy;
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) closeRef.current();
      if (event.key !== 'Tab') return;
      const focusable = panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], summary');
      if (!focusable?.length) { event.preventDefault(); return; }
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => { window.removeEventListener('keydown', keydown); previousFocus?.focus(); };
  }, []);
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm">
    <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl outline-none">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">{title}</h2>
        <button type="button" className={buttonClass} onClick={onClose} disabled={busy} aria-label={`关闭${title}`}>关闭</button></div>
      {children}
    </section>
  </div>;
}
