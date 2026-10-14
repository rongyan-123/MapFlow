import {useRef,useState,useEffect} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {adjustWallet,formatAmountMicros,parseAmountFen,readAdminWalletAccounts} from '../../api/walletClient';
export function useWalletAdjustment({ accountId, csrfToken, onChanged }: { accountId?: string; csrfToken: string; onChanged: (notice: string) => Promise<void> }) {
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [direction, setDirection] = useState<'add' | 'subtract'>('add');
  const [amount, setAmount] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingAdjustment = useRef<{ requestId: string; accountId: string; amountFen: number; note: string } | null>(null);
  const accounts = useQuery({ queryKey: ['admin', accountId, 'wallet', 'accounts', search], queryFn: () => readAdminWalletAccounts(search), enabled: search.length > 0, retry: false });
  const selected = accounts.data?.accounts.find(account => account.accountId === selectedId);
  const amountFen = parseAmountFen(amount);
  const signedFen = amountFen === null ? 0 : amountFen * (direction === 'add' ? 1 : -1);
  const amountLabel = formatAmountMicros(Math.abs(signedFen) * 10_000);
  const directionLabel = direction === 'add' ? '增加' : '扣减';

  async function confirm({ password, note }: { password: string; note: string }) {
    if (!selected || amountFen === null) return;
    const previous = pendingAdjustment.current;
    const request = previous?.accountId === selected.accountId && previous.amountFen === signedFen && previous.note === note
      ? previous : { requestId: crypto.randomUUID(), accountId: selected.accountId, amountFen: signedFen, note };
    pendingAdjustment.current = request;
    await adjustWallet(selected.accountId, { requestId: request.requestId, amountFen: request.amountFen, note, password }, csrfToken);
    pendingAdjustment.current = null;
    setConfirmOpen(false);
    setAmount('');
    await onChanged(`已为 ${selected.username} ${directionLabel} ${amountLabel} 额度`);
  }

  return {searchText,setSearchText,search,setSearch,selectedId,setSelectedId,direction,setDirection,amount,setAmount,confirmOpen,setConfirmOpen,error,setError,pendingAdjustment,accounts,selected,amountFen,signedFen,amountLabel,directionLabel,confirm};
}
