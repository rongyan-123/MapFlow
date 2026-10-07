import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { modelPresets } from './modelPresets';
import { formatAmountMicros, readWallet, readModelPricing } from '../wallet/walletClient';
import ModelReferencePrices, { ReferencePriceNote } from '../wallet/ModelReferencePrices';
import type { TavernModelSelection } from './types';
import { fetchPlatformModels, testModelConnection } from './tavernClient';
import { inputClass } from './TavernUi';

export default function ModelAccessPanel({ modelSelection, onModelSelectionChange, accountId, onNavigateWallet, csrfToken }: {
  modelSelection: TavernModelSelection;
  onModelSelectionChange: (selection: TavernModelSelection) => void;
  accountId: string;
  csrfToken: string;
  onNavigateWallet?: () => void;
}) {
  const [draft, setDraft] = useState(modelSelection);
  const [saved, setSaved] = useState(false);
  const [presetId, setPresetId] = useState(() => modelPresets.find(preset => preset.baseUrl === modelSelection.baseUrl)?.id ?? 'custom');
  const [validationError, setValidationError] = useState('');
  const [connection, setConnection] = useState<{ ok: boolean; models: string[]; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const probe = useRef<AbortController | null>(null);
  useEffect(() => () => { probe.current?.abort(); }, []);
  useEffect(() => { setDraft(modelSelection); setPresetId(modelPresets.find(preset => preset.baseUrl === modelSelection.baseUrl)?.id ?? 'custom'); }, [modelSelection]);
  function updateDraft(updated: TavernModelSelection, invalidateConnection = true) {
    setDraft(updated); setSaved(false); setValidationError('');
    if (invalidateConnection) { probe.current?.abort(); probe.current = null; setTesting(false); setConnection(null); }
  }
  async function testConnection() {
    if (testing) return;
    if (!draft.apiKey.trim() || !/^https:\/\/[^\s]+\/v1\/?$/u.test(draft.baseUrl.trim())) {
      setValidationError('请填写 API Key 和有效的 HTTPS API URL 后测试。'); return;
    }
    const controller = new AbortController(); probe.current = controller;
    setTesting(true); setConnection(null); setValidationError('');
    try {
      const result = await testModelConnection(draft.apiKey.trim(), draft.baseUrl.trim(), csrfToken, controller.signal);
      if (!controller.signal.aborted) setConnection(result);
    } catch (failure) {
      if (!controller.signal.aborted) setConnection({ ok: false, models: [], message: failure instanceof Error ? failure.message : '连接测试失败，请重试。' });
    } finally { if (!controller.signal.aborted) { setTesting(false); probe.current = null; } }
  }
  function saveDraft() {
    const cleaned = { ...draft, apiKey: draft.apiKey.trim(), baseUrl: draft.baseUrl.trim(), model: draft.model.trim() };
    const message = !cleaned.apiKey ? '尚未填写 API Key。' : !cleaned.baseUrl ? '尚未填写 API URL。'
      : !/^https:\/\/[^\s]+\/v1\/?$/u.test(cleaned.baseUrl) ? 'API URL 必须是公开 HTTPS 地址，并以 /v1 结尾。'
      : !cleaned.model ? '尚未填写上游模型。' : '';
    if (message) { setValidationError(message); return; }
    onModelSelectionChange(cleaned); setSaved(true); setValidationError('');
  }
  const wallet = useQuery({ queryKey: ['me', accountId, 'wallet'], queryFn: readWallet,
    enabled: modelSelection.provider === 'platform', retry: false, staleTime: 15_000 });
  const platformCatalog = useQuery({ queryKey: ['me', accountId, 'tavern', 'platform-models'],
    queryFn: ({ signal }) => fetchPlatformModels(signal), enabled: modelSelection.provider === 'platform', retry: false });
  const prices = useQuery({ queryKey: ['model-catalog', 'pricing'], queryFn: readModelPricing,
    enabled: modelSelection.provider === 'platform', retry: false, staleTime: 60_000 });
  return (
    <>
      <ModelChoices label="模型线路" value={modelSelection.provider} options={[
        { value: 'custom', label: '自填 API Key' },
        { value: 'platform', label: '使用平台模型（需要充值）' },
      ]} onChange={provider => { probe.current?.abort(); probe.current = null; setTesting(false); setConnection(null); setValidationError(''); setSaved(false); onModelSelectionChange({
        provider: provider as TavernModelSelection['provider'], apiKey: '', model: '', baseUrl: '',
        settings: {}, historyBytes: modelSelection.historyBytes,
      }); }} />
      {modelSelection.provider === 'platform' ? <section aria-label="平台模型与额度" className="mt-4 space-y-4 rounded-xl border border-cyan-900 bg-slate-950/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-sm font-semibold text-slate-100">我的额度</h3>
            <p className="mt-1 text-lg font-semibold text-cyan-200">{wallet.data ? `${formatAmountMicros(wallet.data.balanceMicros)} 额度` : wallet.error ? '暂时无法读取' : '读取中…'}</p></div>
          {onNavigateWallet && <button type="button" className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" onClick={onNavigateWallet}>查看额度</button>}
        </div>
        {platformCatalog.isPending ? <p role="status">正在读取平台模型…</p>
          : platformCatalog.error ? <p role="alert">平台模型列表读取失败，请关闭配置后重试。</p>
          : !platformCatalog.data?.enabled || !platformCatalog.data.models.length
            ? <p role="status">平台模型暂不可用：服务器尚未配置爱你 AI API Key，或尚未开启平台试用，请联系管理员。</p>
            : <ModelChoices label="平台模型" value={modelSelection.model} searchable
              options={platformCatalog.data.models.map(model => ({ value: model.id,
                label: <><span className="block font-medium">{prices.data?.models.find(item => item.id === model.id)?.displayName ?? model.id} · {model.provider}</span>
                  <span className="mt-1 block text-xs text-slate-400">上下文 {model.contextWindow.toLocaleString()} Token</span>
                  <span className="mt-3 block">{prices.isPending ? '价格读取中…' : <ModelReferencePrices compact channels={prices.data?.models.find(item => item.id === model.id)?.pricing?.channels.filter(channel => channel.enabled) ?? []} />}</span></> }))}
              onChange={model => onModelSelectionChange({ ...modelSelection, model, apiKey: '', baseUrl: '', settings: {},billingPolicy:platformCatalog.data?.policyVersion })} />}
        {platformCatalog.data?.billingMode !== 'wallet' && <p className="text-xs leading-5 text-amber-200">当前为平台模型试用，测试期间暂不扣费，不扣额度或积分。</p>}
        {platformCatalog.data?.billingMode === 'wallet' && <>
          <ReferencePriceNote />
          <p className="text-xs leading-5 text-slate-500">缓存命中参考价按输入参考价的 10% 换算；若有单独报价，优先显示单独报价。输入包括角色设定和历史消息，输出包括回复和模型返回的思考用量。</p>
        </>}
      </section> : <div className="mt-4 space-y-3 rounded-xl border border-cyan-900 p-3">
        <p className="text-xs leading-5 text-slate-400">使用自己的上游额度；MapFlow 不扣现金额度或积分。Key 只保存在当前页面内存中，刷新后需重新填写；发送时经本站服务器转发给你填写的上游，请只使用可信服务。</p>
        <ModelChoices label="服务预设" value={presetId} options={modelPresets.map(preset => ({ value: preset.id, label: preset.label }))}
          onChange={id => { const preset = modelPresets.find(item => item.id === id)!; setPresetId(id);
            updateDraft({ ...draft, apiKey: '', baseUrl: preset.baseUrl, model: preset.models[0] ?? '' }); }} />
        {presetId === 'qwen' && <p className="text-xs text-slate-400">默认北京地域；API Key 与接口地址需属于同一地域，也可填写控制台提供的业务空间地址。</p>}
        <label className="block text-xs text-slate-400">API Key
          <input type="password" className={`${inputClass} mt-1`} value={draft.apiKey}
            autoComplete="new-password" data-1p-ignore="true" maxLength={512}
            onChange={event => updateDraft({ ...draft, apiKey: event.target.value })} />
        </label>
        <label className="block text-xs text-slate-400">API URL
          <input type="url" className={`${inputClass} mt-1`} value={draft.baseUrl}
            placeholder="https://gateway.example.com/v1"
            onChange={event => updateDraft({ ...draft, baseUrl: event.target.value })} />
        </label>
        <label className="block text-xs text-slate-400">上游模型
          <input className={`${inputClass} mt-1`} value={draft.model}
            maxLength={256} placeholder="模型 ID"
            onChange={event => updateDraft({ ...draft, model: event.target.value }, false)} />
        </label>
        {connection?.ok && <label className="block text-xs text-slate-400">已获取模型
          <select className={`${inputClass} mt-1`} value={connection.models.includes(draft.model) ? draft.model : ''}
            onChange={event => updateDraft({ ...draft, model: event.target.value }, false)}>
            <option value="">选择模型，也可在上方手动填写</option>
            {connection.models.map(model => <option key={model} value={model}>{model}</option>)}
          </select>
        </label>}
        {!connection && modelPresets.find(preset => preset.id === presetId)!.models.length > 0
          && <ModelChoices label="常用模型" value={draft.model}
            options={modelPresets.find(preset => preset.id === presetId)!.models.map(model => ({ value: model, label: model }))}
            onChange={model => updateDraft({ ...draft, model }, false)} />}
        <button type="button" className="mr-2 rounded-xl border border-slate-700 px-3 py-2 text-sm disabled:opacity-50" disabled={testing} onClick={() => void testConnection()}>{testing ? '测试中…' : '测试连接 / 获取模型'}</button>
        <button type="button" className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950" onClick={saveDraft}>保存并使用</button>
        <p className="text-xs text-slate-400">测试仅验证连接、Key 与模型列表，不发送聊天；模型支持情况以实际调用为准。</p>
        {connection && <p role={connection.ok ? 'status' : 'alert'} className={`text-xs ${connection.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{connection.message}</p>}
        <p role="status" className="text-xs text-slate-400">{saved ? '已保存，当前页面内有效。' : '修改后请保存并使用；未保存的修改不会影响发送。'}</p>
        {validationError && <p role="alert" className="text-sm text-rose-300">{validationError}</p>}
      </div>}
        <ModelChoices label="发送的历史上下文" value={String(modelSelection.provider === 'custom' ? draft.historyBytes : modelSelection.historyBytes)} options={[
          { value: '8192', label: '最近 8 KiB' }, { value: '16384', label: '最近 16 KiB' },
          { value: '32768', label: '最近 32 KiB' },
        ]} onChange={value => {
          const historyBytes = Number(value) as TavernModelSelection['historyBytes'];
          if (modelSelection.provider === 'custom') updateDraft({ ...draft, historyBytes }, false);
          else onModelSelectionChange({ ...modelSelection, historyBytes });
        }} />
    </>
  );
}

function ModelChoices({ label, value, options, onChange, searchable = false }: {
  label: string;
  value: string;
  options: { value: string; label: ReactNode }[];
  onChange: (value: string) => void;
  searchable?: boolean;
}) {
  const [search, setSearch] = useState('');
  const visible = searchable ? options.filter(option => option.value.toLowerCase().includes(search.trim().toLowerCase())) : options;
  return <fieldset className="min-w-0 space-y-2">
    <legend className="mb-1 text-xs text-slate-400">{label}</legend>
    {searchable && <input aria-label={`搜索${label}`} className={inputClass} placeholder="搜索模型名称…" value={search} onChange={event => setSearch(event.target.value)} />}
    <div className={`${searchable ? 'grid max-h-[28rem] sm:grid-cols-2' : 'flex max-h-60 flex-wrap'} gap-2 overflow-y-auto overscroll-contain p-1`}>
      {visible.map(option => <button key={option.value} type="button"
        aria-pressed={value === option.value}
        onClick={() => { if (value !== option.value) onChange(option.value); }}
        className={`min-h-10 rounded-xl border px-3 py-2 text-left text-sm break-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${value === option.value
          ? 'border-cyan-300 bg-cyan-300/15 text-cyan-200'
          : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-400'}`}>
        {option.label}
      </button>)}
    </div>
    {searchable && <p className="text-xs text-slate-500">{visible.length ? `${visible.length} / ${options.length} 个模型` : '没有找到匹配的模型'}</p>}
  </fieldset>;
}
