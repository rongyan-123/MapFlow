import {useRef,useState,useEffect} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {readAdminWalletLedger,reverseWalletEntry,type LedgerEntry} from '../../api/walletClient';
export function useAdminLedger({ accountId, csrfToken, onChanged }: { accountId?: string; csrfToken: string; onChanged: (notice: string) => Promise<void> }) {
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [reversing, setReversing] = useState<LedgerEntry | null>(null);
  const ledger = useQuery({ queryKey: ['admin', accountId, 'wallet', 'ledger', search, offset], queryFn: () => readAdminWalletLedger(search, offset), retry: false });

  async function confirm({ password, note }: { password: string; note: string }) {
    if (!reversing) return;
    await reverseWalletEntry(reversing.entryId, { password, note }, csrfToken);
    setReversing(null);
    await onChanged('已撤销该笔变动');
  }

  return {searchText,setSearchText,search,setSearch,offset,setOffset,reversing,setReversing,ledger,confirm};
}
