import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import CreditPill from '../credit/CreditPill';
import { readCreditSummary, type CreditSummary } from '../credit/creditClient';
import IdentityAccess from '../identity/IdentityAccess';
import { useIdentity } from '../identity/IdentityContext';
import LogoutConfirmDialog from '../identity/LogoutConfirmDialog';
import type { IdentitySession } from '../identity/types';
import MobileDrawer from '../navigation/MobileDrawer';
import ThemeSwitcher from '../theme/ThemeSwitcher';
import CardImportDialog from './CardImportDialog';
import ConversationPane from './ConversationPane';
import GenerationSettingsPanel from './GenerationSettingsPanel';
import NewConversationForm from './NewConversationForm';
import { deleteCharacter, fetchCharacters, fetchConversation, fetchConversations } from './tavernClient';
import type { Character, CompletedTurn, Conversation, ConversationDetail, ConversationGraph, GenerationSettingsState } from './types';
import { CharacterAvatar, CompatibilityReport, ErrorNotice, buttonClass, inputClass, primaryClass } from './TavernUi';

export default function TavernPage({ onNavigateConsole }: { onNavigateConsole: () => void }) {
  const { session } = useIdentity();
  if (!session) return null;
  return <AuthenticatedTavernPage key={session.account.playerId} session={session} onNavigateConsole={onNavigateConsole} />;
}

function AuthenticatedTavernPage({ session, onNavigateConsole }: { session: IdentitySession; onNavigateConsole: () => void }) {
  const queryClient = useQueryClient();
  const { logout, logoutPending, logoutError } = useIdentity();
  const accountId = session.account.playerId;
  const selectionKey = `mapflow.tavern.selection.v1.${accountId}`;
  const [conversationId, setConversationId] = useState<string | null>(() => {
    try { return window.localStorage.getItem(selectionKey); } catch { return null; }
  });
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [drawer, setDrawer] = useState<'library' | 'details' | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const charactersKey = ['me', accountId, 'tavern', 'characters'] as const;
  const conversationsKey = ['me', accountId, 'tavern', 'conversations'] as const;
  const detailKey = ['me', accountId, 'tavern', 'conversation', conversationId] as const;
  const creditKey = ['me', accountId, 'credit'] as const;
  const characters = useQuery({ queryKey: charactersKey, queryFn: ({ signal }) => fetchCharacters(signal), retry: false });
  const conversations = useQuery({ queryKey: conversationsKey, queryFn: ({ signal }) => fetchConversations(signal), retry: false });
  const conversationQuery = useQuery({ queryKey: detailKey, queryFn: ({ signal }) => fetchConversation(conversationId!, signal), enabled: !!conversationId, retry: false });
  const credit = useQuery({ queryKey: creditKey, queryFn: readCreditSummary, staleTime: 30_000, retry: false });
  const selectedCharacter = conversationId ? conversationQuery.data?.character : characters.data?.find(item => item.characterId === characterId) ?? characters.data?.[0];
  const canCreate = selectedCharacter && characters.data?.some(item => item.characterId === selectedCharacter.characterId);
  const removing = useMutation({ mutationFn: (id: string) => deleteCharacter(id, session.csrfToken), onSuccess: (_, id) => {
    void queryClient.cancelQueries({ queryKey: charactersKey, exact: true });
    queryClient.setQueryData<Character[]>(charactersKey, previous => previous?.filter(item => item.characterId !== id));
    setDeleteConfirm(false); if (!conversationId) setCharacterId(null);
  } });

  function selectConversation(id: string | null) {
    setConversationId(id); setCreateOpen(false); setDeleteConfirm(false); setDrawer(null);
    try { if (id) window.localStorage.setItem(selectionKey, id); else window.localStorage.removeItem(selectionKey); } catch { /* Server history remains available without local storage. */ }
  }
  function onCompleted(completed: CompletedTurn) {
    // Discard reads started before this commit so they cannot replace saved history.
    void queryClient.cancelQueries({ queryKey: detailKey, exact: true });
    queryClient.setQueryData<ConversationDetail>(detailKey, previous => previous ? { ...previous,
      turns: [...previous.turns.filter(turn => turn.clientTurnId !== completed.turn.clientTurnId), completed.turn],
      graph: completed.graph } : previous);
    void queryClient.cancelQueries({ queryKey: creditKey, exact: true });
    queryClient.setQueryData<CreditSummary>(creditKey, previous => previous ? { ...previous, balance: completed.creditBalance } : previous);
    if (!credit.data) void credit.refetch();
  }
  function onImported(imported: Character) {
    void queryClient.cancelQueries({ queryKey: charactersKey, exact: true });
    queryClient.setQueryData<Character[]>(charactersKey, previous => [...(previous ?? []), imported]);
    setImportOpen(false); setCharacterId(imported.characterId); selectConversation(null);
  }
  function onCreated(created: Conversation) {
    void queryClient.cancelQueries({ queryKey: conversationsKey, exact: true });
    queryClient.setQueryData<Conversation[]>(conversationsKey, previous => [created, ...(previous ?? []).filter(item => item.conversationId !== created.conversationId)]);
    selectConversation(created.conversationId);
  }
  function onGenerationSettingsUpdated(state: GenerationSettingsState) {
    void queryClient.cancelQueries({ queryKey: detailKey, exact: true });
    queryClient.setQueryData<ConversationDetail>(detailKey, previous => previous ? {
      ...previous, conversation: { ...previous.conversation, ...state },
    } : previous);
    queryClient.setQueryData<Conversation[]>(conversationsKey, previous => previous?.map(item =>
      item.conversationId === conversationId ? { ...item, ...state } : item));
  }
  function onGraphChanged(graph: ConversationGraph) {
    void queryClient.cancelQueries({ queryKey: detailKey, exact: true });
    queryClient.setQueryData<ConversationDetail>(detailKey, previous => previous ? { ...previous, graph } : previous);
  }

  const library = <div className="space-y-4">
    <div className="flex items-center justify-between"><h2 className="text-base font-semibold">角色库</h2><span className="text-xs text-slate-500">{characters.data?.length ?? 0} 个角色</span></div>
    <button type="button" className={`${primaryClass} w-full`} onClick={() => { setDrawer(null); setImportOpen(true); }}>导入角色卡</button>
    <ErrorNotice error={characters.error} onRetry={() => void characters.refetch()} />
    {characters.isPending && <p role="status" className="text-sm text-slate-400">正在读取角色库…</p>}
    {characters.data?.length === 0 && <p className="text-sm leading-6 text-slate-400">导入一张 PNG 或 JSON 角色卡，开始你的第一个故事。</p>}
    <div className="space-y-2">{characters.data?.map(item => <button type="button" key={item.characterId} aria-label={`选择角色 ${item.card.name}`} aria-pressed={selectedCharacter?.characterId === item.characterId}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-cyan-500 ${selectedCharacter?.characterId === item.characterId ? 'border-cyan-600 bg-slate-800' : 'border-slate-800 bg-slate-900'}`}
      onClick={() => { setCharacterId(item.characterId); selectConversation(null); }}>
      <CharacterAvatar character={item} /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.card.name}</span><span className="text-xs text-slate-400">{item.card.warnings.length ? `${item.card.warnings.length} 项兼容提示` : '基础文字兼容'}</span></span>
    </button>)}</div>
    {selectedCharacter && canCreate && <div className="border-t border-slate-800 pt-3">
      {deleteConfirm ? <div className="space-y-2"><p className="text-xs leading-6 text-slate-400">从角色库移除「{selectedCharacter.card.name}」？已有会话和历史将保留。</p>
        <button type="button" className={buttonClass} disabled={removing.isPending} onClick={() => removing.mutate(selectedCharacter.characterId)}>确认移除</button>{' '}
        <button type="button" className={buttonClass} disabled={removing.isPending} onClick={() => setDeleteConfirm(false)}>取消</button></div>
        : <button type="button" className="text-xs text-slate-500 hover:text-rose-300" onClick={() => setDeleteConfirm(true)}>移出角色库</button>}
      <ErrorNotice error={removing.error} />
    </div>}
  </div>;
  const summary = selectedCharacter ? <div className="space-y-4">
    <CharacterAvatar character={selectedCharacter} large />
    <h2 className="break-words text-lg font-bold">{selectedCharacter.card.name}</h2>
    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{selectedCharacter.card.description || '没有角色描述。'}</p>
    {selectedCharacter.card.scenario && <details><summary className="cursor-pointer text-sm">场景</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-400">{selectedCharacter.card.scenario}</p></details>}
    <p className="text-xs text-slate-400">世界书：{selectedCharacter.card.lorebook.filter(entry => entry.enabled).length} / {selectedCharacter.card.lorebook.length} 条启用</p>
    {conversationQuery.data && conversationId && <section className="space-y-3 border-t border-slate-800 pt-4">
      <h3 className="font-semibold">会话设定 · 已固定</h3>
      <dl className="space-y-3 text-sm"><div><dt className="text-slate-500">用户称呼</dt><dd className="break-words">{conversationQuery.data.conversation.userName}</dd></div>
        <div><dt className="text-slate-500">Persona</dt><dd className="whitespace-pre-wrap break-words">{conversationQuery.data.conversation.persona || '未设置'}</dd></div>
        <div><dt className="text-slate-500">学习词表</dt><dd>{conversationQuery.data.conversation.vocabulary?.length ? <ul className="mt-1 space-y-1">{conversationQuery.data.conversation.vocabulary.map((entry, index) => <li key={index} className="break-words">{entry.term}{entry.meaning ? ` — ${entry.meaning}` : ''}</li>)}</ul> : '未绑定 · 普通角色聊天'}</dd></div>
      </dl><p className="text-xs leading-6 text-slate-500">角色、称呼、Persona、词表和开场白已保存为会话快照。如需改变这些设定，请创建新会话。</p>
      <GenerationSettingsPanel conversationId={conversationId} settings={conversationQuery.data.conversation.generationSettings}
        version={conversationQuery.data.conversation.generationSettingsVersion} csrfToken={session.csrfToken}
        onUpdated={onGenerationSettingsUpdated} onConflict={async () => { await conversationQuery.refetch(); }} />
    </section>}
    {canCreate && selectedCharacter.sourceHash && <a className={`${buttonClass} inline-block`} href={`/api/me/tavern/characters/${encodeURIComponent(selectedCharacter.characterId)}/source`} download>
      下载原始角色卡
    </a>}
    <CompatibilityReport warnings={selectedCharacter.card.warnings} />
  </div> : <p className="text-sm text-slate-500">选择一个角色后查看详情。</p>;

  return <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-slate-950 text-slate-100">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950 px-3 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3"><button type="button" className={buttonClass} aria-label="返回学习控制台" onClick={onNavigateConsole}>← <span className="hidden sm:inline">学习控制台</span></button>
        <div><h1 className="text-lg font-bold">酒馆</h1><p className="hidden text-xs text-slate-500 sm:block">一个角色，一段属于你的故事</p></div></div>
      <div className="flex items-center gap-2"><ThemeSwitcher /><CreditPill credit={credit.data ?? null} onSignedIn={() => void credit.refetch()} /><div className="hidden lg:block"><IdentityAccess onRequestLogout={() => setLogoutOpen(true)} /></div></div>
    </header>
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 p-2 lg:hidden">
      <button type="button" className={buttonClass} aria-label="打开角色列表" onClick={() => setDrawer('library')}>☰ 角色</button>
      <span className="min-w-0 truncate text-sm text-slate-400">{selectedCharacter?.card.name ?? '欢迎来到酒馆'}</span>
      <button type="button" className={buttonClass} aria-label="打开会话详情" onClick={() => setDrawer('details')}>会话详情</button>
    </div>
    <main className="flex min-h-0 flex-1">
      <aside aria-label="角色库" className="hidden w-60 shrink-0 overflow-y-auto border-r border-slate-800 p-4 lg:block">{library}</aside>
      <section aria-label="角色对话" className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-800 p-4">
          <div className="min-w-0 flex-1"><label htmlFor="tavern-conversations" className="sr-only">选择会话</label>
            <select id="tavern-conversations" className={inputClass} value={conversationId ?? ''} onChange={event => selectConversation(event.target.value || null)}>
              <option value="">{selectedCharacter ? `${selectedCharacter.card.name} · 开始新的故事` : '选择历史会话'}</option>
              {conversationId && !conversations.data?.some(item => item.conversationId === conversationId) && <option value={conversationId}>正在恢复会话…</option>}
              {conversations.data?.map(item => <option key={item.conversationId} value={item.conversationId}>{item.title} · {item.userName}</option>)}
            </select></div>
          <button type="button" className={primaryClass} disabled={!canCreate} onClick={() => setCreateOpen(true)}>新建会话</button>
        </div>
        {conversations.error && <div className="p-4"><ErrorNotice error={conversations.error} onRetry={() => void conversations.refetch()} /></div>}
        {conversationId ? conversationQuery.data ? <ConversationPane key={`${accountId}.${conversationId}`} detail={conversationQuery.data} accountId={accountId} csrfToken={session.csrfToken} onCompleted={onCompleted} onGraphChanged={onGraphChanged} />
          : <div className="p-6">{conversationQuery.isPending ? <p role="status" className="text-sm text-slate-400">正在恢复会话与历史…</p> : <ErrorNotice error={conversationQuery.error} onRetry={() => void conversationQuery.refetch()} />}</div>
          : <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-8 text-center">
            <CharacterAvatar character={selectedCharacter} large /><h2 className="text-xl font-bold">{selectedCharacter ? `与${selectedCharacter.card.name}相遇` : '你的故事，从这里开始'}</h2>
            <p className="max-w-sm text-sm leading-7 text-slate-400">{selectedCharacter ? '创建会话，选择你的称呼和开场白。想在故事中接触新单词，也可以带上一份词表。' : '打开角色库，导入你喜欢的角色卡。会话和聊天历史保存在当前账号。'}</p>
          </div>}
      </section>
      <aside aria-label="会话详情" className="hidden w-72 shrink-0 overflow-y-auto border-l border-slate-800 p-5 lg:block xl:w-80">{summary}</aside>
    </main>
    <MobileDrawer open={drawer !== null} onClose={() => setDrawer(null)}>
      <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">{drawer === 'library' ? '角色与账号' : '会话详情'}</h2><button type="button" className={buttonClass} onClick={() => setDrawer(null)}>关闭</button></div>
      {drawer === 'library' ? <><IdentityAccess onRequestLogout={() => { setDrawer(null); setLogoutOpen(true); }} /><div className="mt-5">{library}</div></> : summary}
    </MobileDrawer>
    {importOpen && <CardImportDialog csrfToken={session.csrfToken} onImported={onImported} onClose={() => setImportOpen(false)} />}
    {createOpen && selectedCharacter && <NewConversationForm key={selectedCharacter.characterId} character={selectedCharacter} defaultName={session.account.username} csrfToken={session.csrfToken} onCreated={onCreated} onClose={() => setCreateOpen(false)} />}
    <LogoutConfirmDialog open={logoutOpen} pending={logoutPending} error={logoutError?.message ?? null} onCancel={() => setLogoutOpen(false)} onConfirm={() => void logout().catch(() => undefined)} />
  </div>;
}
