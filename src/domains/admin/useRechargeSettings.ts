import {useRef,useState,useEffect} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {readCommunitySettings,saveCommunitySettings} from '../../api/walletClient';
export function useRechargeSettings({ accountId, csrfToken }: { accountId?: string; csrfToken: string }) {
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
  return {settings,group,setGroup,busy,message,error,save};
}
