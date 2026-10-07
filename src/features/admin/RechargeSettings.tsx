import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { readCommunitySettings, saveCommunitySettings } from '../wallet/walletClient';
import { walletButton } from './WalletActionDialog';

export default function RechargeSettings({ accountId, csrfToken }: { accountId?: string; csrfToken: string }) {
  const client = useQueryClient();
  const queryKey = ['admin', accountId, 'wallet', 'settings'];
  const settings = useQuery({ queryKey, queryFn: readCommunitySettings, retry: false });
  const [group, setGroup] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (settings.data) setGroup(settings.data.qqGroup); }, [settings.data]);
  async function save() {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const saved = await saveCommunitySettings(group, csrfToken);
      client.setQueryData(queryKey, saved);
      await client.invalidateQueries({ predicate: query => query.queryKey[0] === 'me' && query.queryKey[2] === 'wallet' });
      setMessage('充值设置已保存');
    } catch (failure) { setError(failure instanceof Error ? failure.message : '保存失败，请重试。'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
    <h3 className="font-semibold">充值成功引导</h3>
    <label className="block text-sm">充值成功后的 Q 群号<input value={group} onChange={event => setGroup(event.target.value)} disabled={settings.isPending || busy} inputMode="numeric" maxLength={12} className="mt-2 block w-full max-w-sm rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
    <p className="text-xs text-slate-400">充值到账后显示入群提示；留空可关闭提示。</p>
    <button className={walletButton} disabled={settings.isPending || !!settings.error || busy} onClick={() => void save()}>保存充值设置</button>
    {message && <p role="status" className="text-emerald-300">{message}</p>}
    {(error || settings.error) && <p role="alert" className="text-rose-300">{error || settings.error?.message}</p>}
  </section>;
}
