import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { readUserModelCatalog } from '../tree-generation/treeGenerationClient';
import { updateGenerationSettings } from './tavernClient';
import { TavernApiError, type GenerationSettings, type GenerationSettingsState, type TavernModelSelection } from './types';
import { ErrorNotice, inputClass, primaryClass } from './TavernUi';

export default function GenerationSettingsPanel({ conversationId, settings, version, csrfToken, modelSelection, onModelSelectionChange, onUpdated, onConflict }: {
  conversationId: string; settings: GenerationSettings; version: number; csrfToken: string;
  modelSelection: TavernModelSelection;
  onModelSelectionChange: (selection: TavernModelSelection) => void;
  onUpdated: (state: GenerationSettingsState) => void;
  onConflict: () => Promise<void>;
}) {
  const [temperature, setTemperature] = useState(settings.temperature?.toString() ?? '');
  const [maxOutputTokens, setMaxOutputTokens] = useState(settings.maxOutputTokens.toString());
  const [stopSequences, setStopSequences] = useState(settings.stopSequences.join('\n'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const catalog = useQuery({ queryKey: ['byok-model-catalog'], queryFn: readUserModelCatalog,
    enabled: modelSelection.provider === 'anyai', staleTime: 10 * 60_000, retry: false });
  const models = catalog.data ?? [];
  const selectedModel = models.find(model => model.id === modelSelection.model) ?? models[0];
  useEffect(() => {
    if (modelSelection.provider === 'anyai' && selectedModel && modelSelection.model !== selectedModel.id) {
      onModelSelectionChange({ ...modelSelection, model: selectedModel.id,
        baseUrl: selectedModel.baseUrl, settings: {} });
    }
  }, [modelSelection, onModelSelectionChange, selectedModel]);
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
      <label className="block text-xs text-slate-400">模型线路
        <select className={`${inputClass} mt-1`} value={modelSelection.provider}
          onChange={event => onModelSelectionChange({ provider: event.target.value as TavernModelSelection['provider'],
            apiKey: '', model: '', baseUrl: '', settings: {}, historyBytes: modelSelection.historyBytes })}>
          <option value="platform">平台默认模型 · 使用旧积分</option>
          <option value="anyai">爱你 AI · 自填 Key</option>
          <option value="custom">自定义 OpenAI 兼容 · 自填 Key</option>
        </select>
      </label>
      {modelSelection.provider !== 'platform' && <div className="space-y-3 rounded-xl border border-cyan-900 p-3">
        <p className="text-xs leading-5 text-slate-400">使用自己的上游额度；MapFlow 不扣积分。Key 只保存在当前页面内存中。</p>
        <label className="block text-xs text-slate-400">API Key
          <input type="password" className={`${inputClass} mt-1`} value={modelSelection.apiKey}
            autoComplete="new-password" data-1p-ignore="true" maxLength={512}
            onChange={event => onModelSelectionChange({ ...modelSelection, apiKey: event.target.value })} />
        </label>
        <label className="block text-xs text-slate-400">API URL
          <input type="url" className={`${inputClass} mt-1`} value={modelSelection.provider === 'anyai'
            ? selectedModel?.baseUrl ?? 'https://anyai.token6688.com/v1' : modelSelection.baseUrl}
            readOnly={modelSelection.provider === 'anyai'} placeholder="https://gateway.example.com/v1"
            onChange={event => onModelSelectionChange({ ...modelSelection, baseUrl: event.target.value })} />
        </label>
        <label className="block text-xs text-slate-400">上游模型
          {modelSelection.provider === 'anyai' ? <select className={`${inputClass} mt-1`}
            value={selectedModel?.id ?? ''} disabled={catalog.isLoading || models.length === 0}
            onChange={event => { const model = models.find(item => item.id === event.target.value);
              if (model) onModelSelectionChange({ ...modelSelection, model: model.id, baseUrl: model.baseUrl, settings: {} }); }}>
            {models.map(model => <option key={model.id} value={model.id}>{model.id}</option>)}
          </select> : <input className={`${inputClass} mt-1`} value={modelSelection.model}
            maxLength={256} placeholder="模型 ID"
            onChange={event => onModelSelectionChange({ ...modelSelection, model: event.target.value })} />}
        </label>
        {modelSelection.provider === 'anyai' && selectedModel && <>
          <p className="text-xs text-slate-500">模型上下文上限：{selectedModel.contextWindow.toLocaleString()} Token</p>
          {selectedModel.settings.map(option => <label key={option.name} className="block text-xs text-slate-400">
            {settingLabel(option.name)}
            {option.kind === 'switch' ? <input type="checkbox" className="ml-2"
              checked={modelSelection.settings[option.name] === true}
              onChange={event => onModelSelectionChange({ ...modelSelection, settings: {
                ...modelSelection.settings, [option.name]: event.target.checked } })} />
              : <select className={`${inputClass} mt-1`} value={String(modelSelection.settings[option.name] ?? '')}
                onChange={event => { const next = { ...modelSelection.settings };
                  if (event.target.value) next[option.name] = event.target.value; else delete next[option.name];
                  onModelSelectionChange({ ...modelSelection, settings: next }); }}>
                <option value="">模型默认</option>
                {option.options.map(value => <option key={value} value={value}>{value}</option>)}
              </select>}
          </label>)}
        </>}
        <label className="block text-xs text-slate-400">发送的历史上下文
          <select className={`${inputClass} mt-1`} value={modelSelection.historyBytes}
            onChange={event => onModelSelectionChange({ ...modelSelection,
              historyBytes: Number(event.target.value) as TavernModelSelection['historyBytes'] })}>
            <option value={8192}>最近 8 KiB</option><option value={16384}>最近 16 KiB</option>
            <option value={32768}>最近 32 KiB</option>
          </select>
        </label>
        {catalog.error && <ErrorNotice error={catalog.error} />}
      </div>}
      <p className="text-xs leading-5 text-slate-500">温度、最大输出和停止词会传入当前模型。</p>
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

function settingLabel(name: string): string {
  return ({ thinking: '思考模式', reasoning_effort: '思考强度', enable_thinking: '深度思考',
    thinking_budget: '思考预算', web_search: '联网搜索' } as Record<string, string>)[name] ?? name;
}
