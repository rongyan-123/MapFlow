import { useEffect, useState } from 'react';
import { updateGenerationSettings } from './tavernClient';
import { TavernApiError, type GenerationSettings, type GenerationSettingsState } from './types';
import { ErrorNotice, inputClass, primaryClass } from './TavernUi';

export default function GenerationSettingsPanel({ conversationId, settings, version, csrfToken, onUpdated, onConflict, onBusyChange }: {
  conversationId: string; settings: GenerationSettings; version: number; csrfToken: string;
  onUpdated: (state: GenerationSettingsState) => void;
  onConflict: () => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [temperature, setTemperature] = useState(settings.temperature?.toString() ?? '');
  const [maxOutputTokens, setMaxOutputTokens] = useState(settings.maxOutputTokens.toString());
  const [stopSequences, setStopSequences] = useState(settings.stopSequences.join('\n'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => { onBusyChange?.(false); }, [onBusyChange]);
  useEffect(() => {
    setTemperature(settings.temperature?.toString() ?? '');
    setMaxOutputTokens(settings.maxOutputTokens.toString());
    setStopSequences(settings.stopSequences.join('\n'));
  }, [settings, version]);

  async function save() {
    if (busy) return;
    setBusy(true); setError(null); setSavedVersion(null);
    const parsedTemperature = temperature.trim() === '' ? undefined : Number(temperature);
    const next: GenerationSettings = {
      ...(parsedTemperature === undefined ? {} : { temperature: parsedTemperature }),
      maxOutputTokens: Number(maxOutputTokens),
      stopSequences: stopSequences.split(/\r?\n/u).map(value => value.trim()).filter(Boolean),
    };
    try {
      const state = await updateGenerationSettings(conversationId, version, next, csrfToken);
      onUpdated(state); setSavedVersion(state.generationSettingsVersion);
    } catch (failure) {
      setError(failure);
      if (failure instanceof TavernApiError && failure.status === 409) await onConflict().catch(() => undefined);
    }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
      <p className="border-b border-slate-800 pb-5 text-sm leading-6 text-slate-400">这些参数会用于当前会话的每次发送。</p>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3"><label htmlFor="tavern-temperature" className="text-sm font-medium">温度</label>
          <output htmlFor="tavern-temperature" className="text-sm tabular-nums text-cyan-200">{temperature === '' ? '模型默认' : Number(temperature).toFixed(2)}</output></div>
        <input id="tavern-temperature" className="w-full cursor-pointer accent-cyan-300 disabled:opacity-50" type="range" min="0" max="2" step="0.05"
          value={temperature === '' ? '1' : temperature} aria-valuetext={temperature === '' ? '模型默认' : temperature}
          disabled={busy} onChange={event => { setTemperature(event.target.value); setSavedVersion(null); }} />
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500"><span>0 更确定 · 2 更有创造性</span>
          <button type="button" className="rounded-lg px-2 py-1 text-cyan-200 hover:bg-slate-800 disabled:opacity-50" disabled={busy}
            aria-pressed={temperature === ''} onClick={() => { setTemperature(''); setSavedVersion(null); }}>使用模型默认</button></div>
      </div>
      <div><label htmlFor="tavern-maximum-output" className="block text-sm font-medium">最大输出 Token</label>
        <input id="tavern-maximum-output" aria-describedby="tavern-maximum-output-help" className={`${inputClass} mt-2`} type="number" min="1" max="8192" step="1" inputMode="numeric" value={maxOutputTokens}
          disabled={busy} onChange={event => setMaxOutputTokens(event.target.value)} />
        <p id="tavern-maximum-output-help" className="mt-2 text-xs leading-5 text-slate-500">限制本次回复长度，支持 1–8,192 Token。模型上下文窗口包含输入与输出，以实际模型限制为准。</p>
      </div>
      <details open={settings.stopSequences.length > 0 || undefined} className="rounded-xl border border-slate-800 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-300">高级参数</summary>
        <label className="mt-4 block text-xs text-slate-400">停止词（每行一个）
        <textarea className={`${inputClass} mt-2 resize-y`} rows={3} value={stopSequences} disabled={busy}
          placeholder="最多 4 条" onChange={event => setStopSequences(event.target.value)} />
      </label>
      </details>
      <ErrorNotice error={error} />
      {savedVersion !== null && <p role="status" className="text-xs text-emerald-300">参数已保存 · 版本 {savedVersion}</p>}
      <button type="button" className={`${primaryClass} w-full`} disabled={busy} onClick={() => void save()}>{busy ? '保存中…' : '保存生成参数'}</button>
  </div>;
}
