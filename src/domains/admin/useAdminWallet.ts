import {useRef,useState,useEffect} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {approveTopup,formatAmountMicros,readAdminChannels,readAdminTopups,rejectTopup,uploadChannel,type PaymentChannel,type Topup} from '../../api/walletClient';
type WalletTab='pending'|'ledger'|'adjust'|'channels'|'settings';
type Review={action:'approve'|'reject';order:Topup};
export function useAdminWallet({ csrfToken, accountId }: { csrfToken: string; accountId?: string }) {
  const queryClient = useQueryClient();
  const adminKey = ['admin', accountId, 'wallet'] as const;
  const [tab, setTab] = useState<WalletTab>('pending');
  const orders = useQuery({ queryKey: [...adminKey, 'topups', 'awaiting_review'], queryFn: () => readAdminTopups('awaiting_review'), refetchInterval: 30_000, retry: false });
  const channels = useQuery({ queryKey: [...adminKey, 'channels'], queryFn: readAdminChannels, enabled: tab === 'channels', retry: false });
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const uploadLock = useRef(false);

  async function refreshWallets() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKey }),
      queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === 'me' && query.queryKey[2] === 'wallet' }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
    ]);
  }
  async function changed(message: string) { setNotice(message); await refreshWallets(); }
  async function confirmReview({ password, note }: { password: string; note: string }) {
    if (!review) return;
    const { action, order } = review;
    await (action === 'approve' ? approveTopup(order.topupId, { password, ...(note ? { note } : {}) }, csrfToken) : rejectTopup(order.topupId, note, csrfToken));
    setReview(null);
    setNotice(action === 'approve' ? `已为 ${order.username ?? order.playerId} 入账 ${formatAmountMicros((order.paymentAmountFen ?? order.amountFen) * 10_000)} 额度` : `已拒绝 ${order.username ?? order.playerId} 的充值申请`);
    await refreshWallets();
  }
  async function upload(channel: PaymentChannel, file: File | undefined) {
    if (!file || uploadLock.current) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('请选择不超过 2 MiB 的 PNG 或 JPEG 图片。'); return; }
    uploadLock.current = true; setBusy(true); setError(null); setNotice(null);
    try { await uploadChannel(channel, file, csrfToken); await refreshWallets(); setNotice('收款码已更新'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '上传失败，请重试。'); }
    finally { uploadLock.current = false; setBusy(false); }
  }

  return {tab,setTab,orders,channels,review,setReview,busy,error,setError,notice,setNotice,changed,confirmReview,upload};
}
