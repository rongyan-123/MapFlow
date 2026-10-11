import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { updateTreeConnection } from './tavernClient';
import type { ConversationDetail } from './types';
import { ErrorNotice, primaryClass } from './TavernUi';

export default function TreeToolsPanel({ detail, csrfToken, onUpdated, onConflict }: {
  detail: ConversationDetail; accountId: string; csrfToken: string;
  onUpdated: (detail: ConversationDetail) => void; onConflict: () => void | Promise<void>;
}) {
  const entry = detail.conversation.scene === 'learning' && detail.conversation.libraryEntryId === detail.conversation.learningAreaId
    ? detail.conversation.libraryEntryId : null;
  const [enabled, setEnabled] = useState(detail.conversation.treeToolsEnabled ?? false);
  const save = useMutation({ mutationFn: () => updateTreeConnection(detail.conversation.conversationId,
    detail.graph.revision, entry || null, enabled, csrfToken), onSuccess: onUpdated,
    onError: async error => { if ('status' in error && error.status === 409) await onConflict(); } });
  if (!entry) return <p className="text-sm text-slate-400">请在对应学习区使用技能树工具。</p>;
  return <div className="space-y-4">
    <p className="text-sm leading-6 text-slate-400">工具只访问当前学习区的地图。可以搜索资料并提出修改；每次修改仍需你确认。</p>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} disabled={!entry || save.isPending}
      onChange={event => setEnabled(event.target.checked)} />允许使用技能树工具</label>
    <ErrorNotice error={save.error} />
    <button type="button" className={primaryClass} disabled={save.isPending}
      onClick={() => save.mutate()}>{save.isPending ? '保存中…' : '保存工具设置'}</button>
  </div>;
}
