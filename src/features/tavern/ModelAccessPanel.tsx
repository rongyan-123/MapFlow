import { useQuery } from '@tanstack/react-query';
import { formatAmountMicros, readWallet } from '../wallet/walletClient';
import type { TavernModelSelection } from './types';
import { fetchPlatformModels } from './tavernClient';
import { inputClass } from './TavernUi';

export default function ModelAccessPanel({ modelSelection, onModelSelectionChange, accountId, onNavigateWallet }: {
  modelSelection: TavernModelSelection;
  onModelSelectionChange: (selection: TavernModelSelection) => void;
  accountId: string;
  onNavigateWallet?: () => void;
}) {
  const wallet = useQuery({ queryKey: ['me', accountId, 'wallet'], queryFn: readWallet,
    enabled: modelSelection.provider === 'platform', retry: false, staleTime: 15_000 });
  const platformCatalog = useQuery({ queryKey: ['me', accountId, 'tavern', 'platform-models'],
    queryFn: ({ signal }) => fetchPlatformModels(signal), enabled: modelSelection.provider === 'platform', retry: false });
  return (
    <>
      <ModelChoices label="模型线路" value={modelSelection.provider} options={[
        { value: 'custom', label: '自填 API Key' },
        { value: 'platform', label: '使用平台模型（需要充值）' },
      ]} onChange={provider => onModelSelectionChange({
        provider: provider as TavernModelSelection['provider'], apiKey: '', model: '', baseUrl: '',
        settings: {}, historyBytes: modelSelection.historyBytes,
      })} />
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
            : <ModelChoices label="平台模型" value={modelSelection.model}
              options={platformCatalog.data.models.map(model => ({ value: model.id,
                label: `${model.id} · ${model.provider} · 上下文 ${model.contextWindow.toLocaleString()} Token` }))}
              onChange={model => onModelSelectionChange({ ...modelSelection, model, apiKey: '', baseUrl: '', settings: {},billingPolicy:platformCatalog.data?.policyVersion })} />}
        {platformCatalog.data?.billingMode !== 'wallet' && <p className="text-xs leading-5 text-amber-200">当前为平台模型试用，测试期间暂不扣费，不扣额度或积分。</p>}
      </section> : <div className="mt-4 space-y-3 rounded-xl border border-cyan-900 p-3">
        <p className="text-xs leading-5 text-slate-400">使用自己的上游额度；MapFlow 不扣现金额度或积分。Key 只保存在当前页面内存中，刷新后需重新填写；发送时经本站服务器转发给你填写的上游，请只使用可信服务。</p>
        <label className="block text-xs text-slate-400">API Key
          <input type="password" className={`${inputClass} mt-1`} value={modelSelection.apiKey}
            autoComplete="new-password" data-1p-ignore="true" maxLength={512}
            onChange={event => onModelSelectionChange({ ...modelSelection, apiKey: event.target.value })} />
        </label>
        <label className="block text-xs text-slate-400">API URL
          <input type="url" className={`${inputClass} mt-1`} value={modelSelection.baseUrl}
            placeholder="https://gateway.example.com/v1"
            onChange={event => onModelSelectionChange({ ...modelSelection, baseUrl: event.target.value })} />
        </label>
        <label className="block text-xs text-slate-400">上游模型
          <input className={`${inputClass} mt-1`} value={modelSelection.model}
            maxLength={256} placeholder="模型 ID"
            onChange={event => onModelSelectionChange({ ...modelSelection, model: event.target.value })} />
        </label>

      </div>}
        <ModelChoices label="发送的历史上下文" value={String(modelSelection.historyBytes)} options={[
          { value: '8192', label: '最近 8 KiB' }, { value: '16384', label: '最近 16 KiB' },
          { value: '32768', label: '最近 32 KiB' },
        ]} onChange={value => onModelSelectionChange({ ...modelSelection,
          historyBytes: Number(value) as TavernModelSelection['historyBytes'] })} />
    </>
  );
}

function ModelChoices({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return <fieldset className="min-w-0 space-y-2">
    <legend className="mb-1 text-xs text-slate-400">{label}</legend>
    <div className="flex max-h-60 flex-wrap gap-2 overflow-y-auto overscroll-contain p-1">
      {options.map(option => <button key={option.value} type="button"
        aria-pressed={value === option.value}
        onClick={() => { if (value !== option.value) onChange(option.value); }}
        className={`min-h-10 rounded-xl border px-3 py-2 text-left text-sm break-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${value === option.value
          ? 'border-cyan-300 bg-cyan-300/15 text-cyan-200'
          : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-400'}`}>
        {option.label}
      </button>)}
    </div>
  </fieldset>;
}
