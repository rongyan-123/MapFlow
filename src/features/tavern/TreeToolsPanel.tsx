import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchPersonalLibrary } from '../tree-library/treeLibraryClient';
import { updateTreeConnection } from './tavernClient';
import type { ConversationDetail } from './types';
import { ErrorNotice, inputClass, primaryClass } from './TavernUi';

export default function TreeToolsPanel({ detail, accountId, csrfToken, onUpdated, onConflict }: {
  detail: ConversationDetail; accountId: string; csrfToken: string;
  onUpdated: (detail: ConversationDetail) => void; onConflict: () => void | Promise<void>;
}) {
  const [entry, setEntry] = useState(detail.conversation.libraryEntryId ?? '');
  const [enabled, setEnabled] = useState(detail.conversation.treeToolsEnabled ?? false);
  const library = useQuery({ queryKey: ['me', accountId, 'tree-library'], queryFn: fetchPersonalLibrary, retry: false });
  const save = useMutation({ mutationFn: () => updateTreeConnection(detail.conversation.conversationId,
    detail.graph.revision, entry || null, enabled, csrfToken), onSuccess: onUpdated,
    onError: async error => { if ('status' in error && error.status === 409) await onConflict(); } });
  return <div className="space-y-4">
    <p className="text-sm leading-6 text-slate-400">关联技能树后，角色可以结合学习内容回答。开启工具后，可以搜索资料并提出修改；每次修改仍需你确认。</p>
    <label className="block text-sm">关联技能树
      <select aria-label="关联技能树" className={`${inputClass} mt-2`} value={entry} disabled={save.isPending || library.isPending}
        onChange={event => { setEntry(event.target.value); if (!event.target.value) setEnabled(false); }}>
        <option value="">不关联技能树</option>
        {library.data?.entries.map(item => <option key={item.library_entry_id} value={item.library_entry_id}>{item.tree.title}</option>)}
      </select>
    </label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} disabled={!entry || save.isPending}
      onChange={event => setEnabled(event.target.checked)} />允许使用技能树工具</label>
    <ErrorNotice error={library.error ?? save.error} />
    <button type="button" className={primaryClass} disabled={save.isPending || library.isPending || !!library.error}
      onClick={() => save.mutate()}>{save.isPending ? '保存中…' : '保存工具设置'}</button>
  </div>;
}
