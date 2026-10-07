import ModelAccessPanel from './ModelAccessPanel';
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import CreditPill from '../credit/CreditPill';
import WalletBalance from '../wallet/WalletBalance';
import type {Wallet} from '../wallet/walletClient';
import HeaderMoreMenu, { headerMenuItem } from '../navigation/HeaderMoreMenu';
import { readCreditSummary, type CreditSummary } from '../credit/creditClient';
import IdentityAccess from '../identity/IdentityAccess';
import { useIdentity } from '../identity/IdentityContext';
import LogoutConfirmDialog from '../identity/LogoutConfirmDialog';
import type { IdentitySession } from '../identity/types';
import MobileDrawer from '../navigation/MobileDrawer';
import ThemeSwitcher from '../theme/ThemeSwitcher';
import CardImportDialog from './CardImportDialog';
import CreateCharacterDialog from './CreateCharacterDialog';
import ConversationPane from './ConversationPane';
import ConversationProfilePanel from './ConversationProfilePanel';
import GenerationSettingsPanel from './GenerationSettingsPanel';
import { createConversation, deleteCharacter, fetchCharacters, fetchConversation, fetchConversations } from './tavernClient';
import type { Character, CompletedTurn, Conversation, ConversationDetail, ConversationGraph, GenerationSettingsState, TavernModelSelection } from './types';
import { CharacterAvatar, CompatibilityReport, ErrorNotice, TavernDialog, buttonClass, inputClass, primaryClass } from './TavernUi';

export default function TavernPage({ onNavigateConsole, onNavigateWallet, onNavigateModels }: { onNavigateConsole: () => void; onNavigateWallet?: () => void; onNavigateModels?: () => void }) {
  const { session } = useIdentity();
  if (!session) return null;
  return <AuthenticatedTavernPage key={session.account.playerId} session={session} onNavigateConsole={onNavigateConsole} onNavigateWallet={onNavigateWallet} onNavigateModels={onNavigateModels} />;
}

function AuthenticatedTavernPage({ session, onNavigateConsole, onNavigateWallet, onNavigateModels }: { session: IdentitySession; onNavigateConsole: () => void; onNavigateWallet?: () => void; onNavigateModels?: () => void }) {
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
  const [configurationOpen, setConfigurationOpen] = useState(false);
  const [configurationSection, setConfigurationSection] = useState('overview');
  const [openingCharacter, setOpeningCharacter] = useState<string | null>(null);
  const [openError, setOpenError] = useState<unknown>(null);
  const openingLock = useRef(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [drawer, setDrawer] = useState<'library' | 'details' | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [modelSelection, setModelSelection] = useState<TavernModelSelection>({
    provider: 'custom', apiKey: '', model: '', baseUrl: '', settings: {}, historyBytes: 32768,
  });
  const savedCustomSelection = useRef(modelSelection);
  function changeModelSelection(selection: TavernModelSelection) {
    if (selection.provider === 'custom') {
      if (selection.apiKey) savedCustomSelection.current = selection;
      else if (modelSelection.provider === 'platform') selection = { ...savedCustomSelection.current, historyBytes: selection.historyBytes };
    }
    setModelSelection(selection);
  }
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
    setConversationId(id); setDeleteConfirm(false); setDrawer(null);
    try { if (id) window.localStorage.setItem(selectionKey, id); else window.localStorage.removeItem(selectionKey); } catch { /* Server history remains available without local storage. */ }
  }
  async function openCharacter(character: Character) {
    if (openingLock.current || !conversations.isSuccess) return;
    setCharacterId(character.characterId);
    setOpenError(null);
    const available = queryClient.getQueryData<Conversation[]>(conversationsKey) ?? [];
    let remembered: string | null = null;
    try { remembered = window.localStorage.getItem(`${selectionKey}.${character.characterId}`); } catch { /* Optional preference. */ }
    const existing = available.find(item => item.characterId === character.characterId && item.conversationId === (remembered ?? conversationId))
      ?? available.filter(item => item.characterId === character.characterId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.conversationId.localeCompare(a.conversationId))[0];
    if (existing) { selectConversation(existing.conversationId); return; }
    openingLock.current = true;
    setOpeningCharacter(character.characterId);
    try {
      onCreated(await createConversation({ characterId: character.characterId, userName: session.account.username, greetingIndex: 0 }, session.csrfToken));
    } catch (failure) { setOpenError(failure); }
    finally { openingLock.current = false; setOpeningCharacter(null); }
  }
  function onCompleted(completed: CompletedTurn) {
    // Discard reads started before this commit so they cannot replace saved history.
    void queryClient.cancelQueries({ queryKey: detailKey, exact: true });
    queryClient.setQueryData<ConversationDetail>(detailKey, previous => previous ? { ...previous,
      turns: [...previous.turns.filter(turn => turn.clientTurnId !== completed.turn.clientTurnId), completed.turn],
      ...(completed.cashCharge?{cashCharges:[...(previous.cashCharges??[]).filter(charge=>charge.generationId!==completed.cashCharge?.generationId),completed.cashCharge]}:{}),
      graph: completed.graph } : previous);
    if (completed.walletBalanceMicros!==undefined) {
      const walletKey=['me',accountId,'wallet'];
      void queryClient.cancelQueries({queryKey:walletKey,exact:true});
      queryClient.setQueryData<Wallet>(walletKey,previous=>previous?{...previous,balanceMicros:completed.walletBalanceMicros!}:previous);
      void queryClient.invalidateQueries({queryKey:walletKey,refetchType:'none'});
    }
    void queryClient.cancelQueries({ queryKey: creditKey, exact: true });
    queryClient.setQueryData<CreditSummary>(creditKey, previous => previous ? { ...previous, balance: completed.creditBalance } : previous);
    if (!credit.data) void credit.refetch();
  }
  function onImported(imported: Character) {
    void queryClient.cancelQueries({ queryKey: charactersKey, exact: true });
    queryClient.setQueryData<Character[]>(charactersKey, previous => [...(previous ?? []), imported]);
    setImportOpen(false); setCreateOpen(false); setCharacterId(imported.characterId); selectConversation(null);
  }
  function onCreated(created: Conversation) {
    void queryClient.cancelQueries({ queryKey: conversationsKey, exact: true });
    queryClient.setQueryData<Conversation[]>(conversationsKey, previous => [created, ...(previous ?? []).filter(item => item.conversationId !== created.conversationId)]);
    selectConversation(created.conversationId);
    try { window.localStorage.setItem(`${selectionKey}.${created.characterId}`, created.conversationId); } catch { /* Optional preference. */ }
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
  function onProfileUpdated(updated: ConversationDetail) {
    void queryClient.cancelQueries({ queryKey: detailKey, exact: true });
    void queryClient.cancelQueries({ queryKey: conversationsKey, exact: true });
    queryClient.setQueryData(detailKey, updated);
    queryClient.setQueryData<Conversation[]>(conversationsKey, previous => previous?.map(item => item.conversationId === updated.conversation.conversationId ? updated.conversation : item));
  }

  const library = <div className="space-y-4">
    <div className="flex items-center justify-between"><h2 className="text-base font-semibold">角色库</h2><span className="text-xs text-slate-500">{characters.data?.length ?? 0} 个角色</span></div>
    <button type="button" className={`${primaryClass} w-full`} onClick={() => { setDrawer(null); setImportOpen(true); }}>导入角色卡</button>
    <button type="button" className={`${buttonClass} w-full`} onClick={() => { setDrawer(null); setCreateOpen(true); }}>创建角色卡</button>
    <ErrorNotice error={characters.error} onRetry={() => void characters.refetch()} />
    {characters.isPending && <p role="status" className="text-sm text-slate-400">正在读取角色库…</p>}
    {characters.data?.length === 0 && <p className="text-sm leading-6 text-slate-400">导入一张 PNG 或 JSON 角色卡，开始你的第一个故事。</p>}
    <div className="space-y-2">{characters.data?.map(item => <button type="button" key={item.characterId} aria-label={`选择角色 ${item.card.name}`} aria-pressed={selectedCharacter?.characterId === item.characterId}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-cyan-500 ${selectedCharacter?.characterId === item.characterId ? 'border-cyan-600 bg-slate-800' : 'border-slate-800 bg-slate-900'}`}
      disabled={openingCharacter !== null || !conversations.isSuccess} onClick={() => void openCharacter(item)}>
      <CharacterAvatar character={item} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.card.name}</span><span className="text-xs text-slate-400">{openingCharacter === item.characterId ? '正在开启…' : '点击继续故事'}</span></span><span aria-hidden="true" className="text-slate-500">›</span>
    </button>)}</div>
    {selectedCharacter && canCreate && <div className="border-t border-slate-800 pt-3">
      {deleteConfirm ? <div className="space-y-2"><p className="text-xs leading-6 text-slate-400">从角色库移除「{selectedCharacter.card.name}」？已有会话和历史将保留。</p>
        <button type="button" className={buttonClass} disabled={removing.isPending} onClick={() => removing.mutate(selectedCharacter.characterId)}>确认移除</button>{' '}
        <button type="button" className={buttonClass} disabled={removing.isPending} onClick={() => setDeleteConfirm(false)}>取消</button></div>
        : <button type="button" className="text-xs text-slate-500 hover:text-rose-300" onClick={() => setDeleteConfirm(true)}>移出角色库</button>}
      <ErrorNotice error={removing.error} />
    </div>}
  </div>;
  const historyCharacterId = selectedCharacter?.characterId
    ?? conversations.data?.find(item => item.conversationId === conversationId)?.characterId;
  // Without an active character, retain access to archived cards' saved history.
  // While an active conversation loads, never briefly expose other characters.
  const characterConversations = (conversations.data ?? []).filter(item => historyCharacterId
    ? item.characterId === historyCharacterId : !conversationId);
  const summary = <div className="space-y-4">
    <label className="block text-xs text-slate-400">历史会话
      <select aria-label="选择会话" className={`${inputClass} mt-2`} value={conversationId ?? ''} onChange={event => {
        const selected = characterConversations.find(item => item.conversationId === event.target.value);
        if (selected) {
          try { window.localStorage.setItem(`${selectionKey}.${selected.characterId}`, selected.conversationId); } catch { /* Optional preference. */ }
          selectConversation(selected.conversationId);
        }
      }}><option value="" disabled>选择历史会话</option>{characterConversations.map(item => <option key={item.conversationId} value={item.conversationId}>{item.title} · {item.userName}</option>)}</select>
    </label>
    {selectedCharacter ? <>
    <CharacterAvatar character={selectedCharacter} large />
    <h2 className="break-words text-lg font-bold">{selectedCharacter.card.name}</h2>
    <details><summary className="cursor-pointer text-sm text-slate-400">角色设定</summary><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{selectedCharacter.card.description || '没有角色描述。'}</p></details>
    {selectedCharacter.card.scenario && <details><summary className="cursor-pointer text-sm">场景</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-400">{selectedCharacter.card.scenario}</p></details>}
    <p className="text-xs text-slate-400">世界书：{selectedCharacter.card.lorebook.filter(entry => entry.enabled).length} / {selectedCharacter.card.lorebook.length} 条启用</p>
    {canCreate && selectedCharacter.sourceHash && <a className={`${buttonClass} inline-block`} href={`/api/me/tavern/characters/${encodeURIComponent(selectedCharacter.characterId)}/source`} download>
      下载原始角色卡
    </a>}
    <CompatibilityReport warnings={selectedCharacter.card.warnings} initiallyOpen={false} />
    </> : <p className="text-sm text-slate-500">可选择历史会话，或导入角色开始新的故事。</p>}
  </div>;
  const configurationSections = [
    { id: 'overview', label: '角色与会话', content: summary },
    { id: 'model', label: '模型接入', content: <ModelAccessPanel modelSelection={modelSelection} onModelSelectionChange={changeModelSelection} csrfToken={session.csrfToken} accountId={accountId} onNavigateWallet={onNavigateWallet} /> },
    ...(conversationQuery.data && conversationId ? [
      { id: 'profile', label: '会话设定', content: <ConversationProfilePanel detail={conversationQuery.data} csrfToken={session.csrfToken}
        onUpdated={onProfileUpdated} onConflict={async () => { await conversationQuery.refetch(); }} /> },
      { id: 'generation', label: '生成参数', content: <GenerationSettingsPanel conversationId={conversationId}
        settings={conversationQuery.data.conversation.generationSettings} version={conversationQuery.data.conversation.generationSettingsVersion}
        csrfToken={session.csrfToken}
        onUpdated={onGenerationSettingsUpdated} onConflict={async () => { await conversationQuery.refetch(); }} /> },
    ] : []),
  ];

  return <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-slate-950 text-slate-100">
    <header className="relative z-30 flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-950 px-3 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3"><button type="button" className={buttonClass} aria-label="返回学习控制台" onClick={onNavigateConsole}>← <span className="hidden sm:inline">学习控制台</span></button>
        <div><h1 className="text-lg font-bold">酒馆</h1><p className="hidden text-xs text-slate-500 sm:block">一个角色，一段属于你的故事</p></div></div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {onNavigateWallet && <WalletBalance accountId={accountId} onClick={onNavigateWallet} />}
        <HeaderMoreMenu>
          {onNavigateModels && <button type="button" className={headerMenuItem} onClick={onNavigateModels}>模型价格</button>}
          <button type="button" className={headerMenuItem} onClick={onNavigateConsole}>学习控制台</button>
          <div data-keep-menu-open className="space-y-3 border-t border-slate-800 px-2 py-3"><ThemeSwitcher /><div><p className="mb-2 text-xs text-slate-500">学习积分</p><CreditPill credit={credit.data ?? null} onSignedIn={() => void credit.refetch()} /></div></div>
          <IdentityAccess onRequestLogout={() => setLogoutOpen(true)} />
        </HeaderMoreMenu>
      </div>
    </header>
    <main className="flex min-h-0 flex-1">
      <aside aria-label="角色库" className="hidden w-60 shrink-0 overflow-y-auto border-r border-slate-800 p-4 lg:block">{library}</aside>
      <section aria-label="角色对话" className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-5 py-3">
          <button type="button" className={`${buttonClass} lg:hidden`} aria-label="打开角色列表" onClick={() => setDrawer('library')}>☰</button>
          <div className="flex min-w-0 items-center gap-3"><CharacterAvatar character={selectedCharacter} /><div className="min-w-0"><h2 className="truncate text-sm font-semibold">{selectedCharacter?.card.name ?? '欢迎来到酒馆'}</h2><p className="mt-0.5 text-xs text-slate-500">{conversationId ? '故事正在继续' : '选择角色，开启故事'}</p></div></div>
          <button type="button" className={buttonClass} onClick={() => { setConfigurationSection('overview'); setConfigurationOpen(true); }}>配置</button>
        </div>
        {openError != null && <div className="p-4"><ErrorNotice error={openError} /></div>}
        {conversations.error && <div className="p-4"><ErrorNotice error={conversations.error} onRetry={() => void conversations.refetch()} /></div>}
        {conversationId ? conversationQuery.data ? <ConversationPane key={`${accountId}.${conversationId}`} detail={conversationQuery.data} accountId={accountId} csrfToken={session.csrfToken} onCompleted={onCompleted} onGraphChanged={onGraphChanged}
          modelSelection={modelSelection}
          configurationOpen={configurationOpen} configurationSection={configurationSection}
          onOpenModelConfiguration={() => { setConfigurationSection('model'); setConfigurationOpen(true); }}
          onNavigateWallet={onNavigateWallet} onCloseConfiguration={() => setConfigurationOpen(false)} configuration={configurationSections} />
          : <div className="p-6">{conversationQuery.isPending ? <p role="status" className="text-sm text-slate-400">正在恢复会话与历史…</p> : <ErrorNotice error={conversationQuery.error} onRetry={() => void conversationQuery.refetch()} />}</div>
          : <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-8 text-center">
            <CharacterAvatar character={selectedCharacter} large /><h2 className="text-xl font-bold">{selectedCharacter ? `与${selectedCharacter.card.name}相遇` : '你的故事，从这里开始'}</h2>
            <p className="max-w-sm text-sm leading-7 text-slate-400">{selectedCharacter ? '点击左侧角色，即可开始或继续故事。你的聊天记录会自动保存。' : '打开角色库，导入你喜欢的角色卡。会话和聊天历史保存在当前账号。'}</p>
          </div>}
      </section>
    </main>
    <MobileDrawer open={drawer !== null} onClose={() => setDrawer(null)}>
      <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">{drawer === 'library' ? '角色与账号' : '会话详情'}</h2><button type="button" className={buttonClass} onClick={() => setDrawer(null)}>关闭</button></div>
      {drawer === 'library' ? <><IdentityAccess onRequestLogout={() => { setDrawer(null); setLogoutOpen(true); }} /><div className="mt-5">{library}</div></> : summary}
    </MobileDrawer>
    {configurationOpen && !conversationQuery.data && <TavernDialog title="配置" initialSection={configurationSection} onClose={() => setConfigurationOpen(false)} sections={configurationSections} />}
    {importOpen && <CardImportDialog csrfToken={session.csrfToken} onImported={onImported} onClose={() => setImportOpen(false)} />}
    {createOpen && <CreateCharacterDialog csrfToken={session.csrfToken} onCreated={onImported} onClose={() => setCreateOpen(false)} />}
    <LogoutConfirmDialog open={logoutOpen} pending={logoutPending} error={logoutError?.message ?? null} onCancel={() => setLogoutOpen(false)} onConfirm={() => void logout().catch(() => undefined)} />
  </div>;
}
