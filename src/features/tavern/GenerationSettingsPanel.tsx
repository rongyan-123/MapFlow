import { useEffect, useState } from 'react';
import { updateGenerationSettings } from './tavernClient';
import { TavernApiError, type GenerationSettings, type GenerationSettingsState } from './types';
import { ErrorNotice, inputClass, primaryClass } from './TavernUi';

export default function GenerationSettingsPanel({ conversationId, settings, version, csrfToken, onUpdated, onConflict }: {
  conversationId: string; settings: GenerationSettings; version: number; csrfToken: string;
  onUpdated: (state: GenerationSettingsState) => void;
  onConflict: () => Promise<void>;
}) {
  const [temperature, setTemperature] = useState(settings.temperature?.toString() ?? '');
  const [maxOutputTokens, setMaxOutputTokens] = useState(settings.maxOutputTokens.toString());
  const [stopSequences, setStopSequences] = useState(settings.stopSequences.join('\n'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
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

  return <details className="rounded-xl border border-slate-800 p-3">
    <summary className="cursor-pointer text-sm font-semibold">生成参数</summary>
    <div className="mt-3 space-y-3">
      <p className="text-xs leading-5 text-slate-500">这些参数会真实传入 DSH。当前适配器只开放温度、最大输出和停止词；不会展示无效旋钮。</p>
      <label className="block text-xs text-slate-400">温度
        <input className={`${inputClass} mt-1`} type="number" min="0" max="2" step="0.05" inputMode="decimal" value={temperature}
          placeholder="模型默认" disabled={busy} onChange={event => setTemperature(event.target.value)} />
      </label>
      <label className="block text-xs text-slate-400">最大输出 Token
        <input className={`${inputClass} mt-1`} type="number" min="1" max="8192" step="1" inputMode="numeric" value={maxOutputTokens}
          disabled={busy} onChange={event => setMaxOutputTokens(event.target.value)} />
      </label>
      <label className="block text-xs text-slate-400">停止词（每行一个）
        <textarea className={`${inputClass} mt-1 resize-y`} rows={3} value={stopSequences} disabled={busy}
          placeholder="最多 4 条" onChange={event => setStopSequences(event.target.value)} />
      </label>
      <ErrorNotice error={error} />
      {savedVersion !== null && <p role="status" className="text-xs text-emerald-300">参数已保存 · 版本 {savedVersion}</p>}
      <button type="button" className={`${primaryClass} w-full`} disabled={busy} onClick={() => void save()}>{busy ? '保存中…' : '保存生成参数'}</button>
    </div>
  </details>;
}
