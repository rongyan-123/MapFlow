import ModelAccessPanel from './ModelAccessPanel';
import { useEffect, useRef, useState } from 'react';
import TreeToolsPanel from './TreeToolsPanel';
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
import EditCharacterDialog from './EditCharacterDialog';
import CharacterLibraryItem from './CharacterLibraryItem';
import ConversationPane from './ConversationPane';
import ConversationProfilePanel from './ConversationProfilePanel';
import GenerationSettingsPanel from './GenerationSettingsPanel';
import { createConversation, deleteCharacter, fetchCharacters, fetchConversation, fetchConversations, openTreeConversation, switchConversationCharacter, updateTreeConnection } from './tavernClient';
import type { Character, CompletedTurn, Conversation, ConversationDetail, ConversationGraph, GenerationSettingsState, TavernModelSelection } from './types';
import { CharacterAvatar, CompatibilityReport, ErrorNotice, TavernDialog, buttonClass, inputClass, primaryClass } from './TavernUi';

interface TavernPageProps {
  onNavigateConsole: () => void; onNavigateWallet?: () => void; onNavigateModels?: () => void;
  treeContext?: { libraryEntryId: string; title: string; nodeTitle?: string }; onClose?: () => void; onTreeChanged?: () => void; onShowMap?: () => void;
}
export default function TavernPage(props: TavernPageProps) {
  const { session } = useIdentity();
  if (!session) return null;
  return <AuthenticatedTavernPage key={`${session.account.playerId}.${props.treeContext?.libraryEntryId ?? 'independent'}`} session={session} {...props} />;
}

function AuthenticatedTavernPage({ session, onNavigateConsole, onNavigateWallet, onNavigateModels, treeContext, onClose, onTreeChanged, onShowMap }: TavernPageProps & { session: IdentitySession }) {
  const queryClient = useQueryClient();
  const { logout, logoutPending, logoutError } = useIdentity();
  const accountId = session.account.playerId;
  const selectionKey = `mapflow.tavern.selection.v1.${accountId}`;
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (treeContext) return null;
    try { return window.localStorage.getItem(selectionKey); } catch { return null; }
  });
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<{ character: Character; renameOnly: boolean; conversation?: ConversationDetail } | null>(null);
  const [configurationOpen, setConfigurationOpen] = useState(false);
  const [configurationSection, setConfigurationSection] = useState('overview');
  const [openingCharacter, setOpeningCharacter] = useState<string | null>(null);
  const [openError, setOpenError] = useState<unknown>(null);
  const openingLock = useRef(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [drawer, setDrawer] = useState<'library' | 'details' | null>(null);
  const [deleting, setDeleting] = useState<Character | null>(null);
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
  const treeStory = useQuery({ queryKey: ['me', accountId, 'tavern', 'tree-conversation', treeContext?.libraryEntryId],
    queryFn: ({ signal }) => openTreeConversation(treeContext!.libraryEntryId, session.csrfToken, signal), enabled: !!treeContext, retry: false });
  useEffect(() => {
    if (!treeStory.data || !treeContext) return;
    queryClient.setQueryData<ConversationDetail>(['me', accountId, 'tavern', 'conversation', treeStory.data.conversation.conversationId], previous =>
      previous && previous.graph.revision >= treeStory.data.graph.revision ? previous : treeStory.data);
    onCreated(treeStory.data.conversation);
    void characters.refetch();
  }, [treeStory.data]);
  const selectedCharacter = conversationId ? conversationQuery.data?.character : characters.data?.find(item => item.characterId === characterId) ?? characters.data?.[0];
  const canCreate = selectedCharacter && characters.data?.some(item => item.characterId === selectedCharacter.characterId);
  const removing = useMutation({ mutationFn: (id: string) => deleteCharacter(id, session.csrfToken), onSuccess: (_, id) => {
    void queryClient.cancelQueries({ queryKey: charactersKey, exact: true });
    queryClient.setQueryData<Character[]>(charactersKey, previous => previous?.filter(item => item.characterId !== id));
    setDeleting(null); if (!conversationId && characterId === id) setCharacterId(null);
  } });

  function selectConversation(id: string | null) {
    setConversationId(id); setDeleting(null); setDrawer(null);
    try { if (id) window.localStorage.setItem(selectionKey, id); else window.localStorage.removeItem(selectionKey); } catch { /* Server history remains available without local storage. */ }
  }
  async function openCharacter(character: Character) {
    if (openingLock.current || !conversations.isSuccess) return;
    setCharacterId(character.characterId);
    setOpenError(null);
    if ((treeContext || conversationQuery.data?.conversation.libraryEntryId) && conversationId) {
      if (!conversationQuery.data) return;
      openingLock.current=true; setOpeningCharacter(character.characterId);
      try {
        const updated=await switchConversationCharacter(conversationId,conversationQuery.data.graph.revision,character.characterId,session.csrfToken);
        onProfileUpdated(updated); setDrawer(null);
      } catch(failure) { setOpenError(failure); await conversationQuery.refetch(); }
      finally { openingLock.current=false; setOpeningCharacter(null); }
      return;
    }
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
    onTreeChanged?.();
    // Discard reads started before this commit so they cannot replace saved history.
    void queryClient.cancelQueries({ queryKey: detailKey, exact: true });
    queryClient.setQueryData<ConversationDetail>(detailKey, previous => previous ? { ...previous,
      turns: [...previous.turns.filter(turn => turn.clientTurnId !== completed.turn.clientTurnId), completed.turn],
      ...(completed.canvas ? { canvas: completed.canvas } : {}),
      ...(completed.generation ? { generations: [...previous.generations.filter(generation => generation.clientActionId !== completed.generation?.clientActionId), completed.generation] } : {}),
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
    setImportOpen(false); setCreateOpen(false); setCharacterId(imported.characterId);
    if (treeContext || conversationQuery.data?.conversation.libraryEntryId) void openCharacter(imported);
    else selectConversation(null);
  }
  function onCreated(created: Conversation) {
    if (treeContext && created.libraryEntryId !== treeContext.libraryEntryId) {
      void updateTreeConnection(created.conversationId,0,treeContext.libraryEntryId,true,session.csrfToken)
        .then(updated => { queryClient.setQueryData(['me',accountId,'tavern','conversation',created.conversationId],updated); onCreated(updated.conversation); })
        .catch(setOpenError);
      return;
    }
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
  function onRecovered(saved: ConversationDetail) {
    onProfileUpdated(saved); onTreeChanged?.();
    void queryClient.invalidateQueries({ queryKey: ['me', accountId, 'wallet'] });
    void credit.refetch();
  }
  function onCharacterSaved(result: { character: Character; conversation: ConversationDetail | null }) {
    void queryClient.cancelQueries({ queryKey: charactersKey, exact: true });
    queryClient.setQueryData<Character[]>(charactersKey, previous => previous?.map(item => item.characterId === result.character.characterId ? result.character : item));
    if (result.conversation) onProfileUpdated(result.conversation);
    setEditing(null);
  }
  function editCharacter(character: Character, renameOnly: boolean) {
    setDrawer(null);
    setEditing({ character, renameOnly, ...(conversationQuery.data?.conversation.characterId === character.characterId
      ? { conversation: conversationQuery.data } : {}) });
  }

  const library = <div className="space-y-4">
    <div className="flex items-center justify-between"><h2 className="text-base font-semibold">角色库</h2><span className="text-xs text-slate-500">{characters.data?.length ?? 0} 个角色</span></div>
    <button type="button" className={`${primaryClass} w-full`} onClick={() => { setDrawer(null); setImportOpen(true); }}>导入角色卡</button>
    <button type="button" className={`${buttonClass} w-full`} onClick={() => { setDrawer(null); setCreateOpen(true); }}>创建角色卡</button>
    <ErrorNotice error={characters.error} onRetry={() => void characters.refetch()} />
    {characters.isPending && <p role="status" className="text-sm text-slate-400">正在读取角色库…</p>}
    {characters.data?.length === 0 && <p className="text-sm leading-6 text-slate-400">导入一张 PNG 或 JSON 角色卡，开始你的第一个故事。</p>}
    <div className="space-y-2">{characters.data?.map(item => <CharacterLibraryItem key={item.characterId} character={item}
      selected={selectedCharacter?.characterId === item.characterId} opening={openingCharacter === item.characterId}
      disabled={openingCharacter !== null || !conversations.isSuccess} onSelect={() => void openCharacter(item)}
      actionsDisabled={openingCharacter !== null || (!!conversationId && !conversationQuery.isSuccess)}
      onRename={() => editCharacter(item, true)} onEdit={() => editCharacter(item, false)}
      onDelete={() => { setDrawer(null); removing.reset(); setDeleting(item); }} />)}</div>
  </div>;
  const historyCharacterId = selectedCharacter?.characterId
    ?? conversations.data?.find(item => item.conversationId === conversationId)?.characterId;
  // Without an active character, retain access to archived cards' saved history.
  // While an active conversation loads, never briefly expose other characters.
  const characterConversations = (conversations.data ?? []).filter(item =>
    (!treeContext || item.libraryEntryId === treeContext.libraryEntryId) &&
    (historyCharacterId ? item.characterId === historyCharacterId : !conversationId));
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
      { id: 'tools', label: '技能树与工具', content: <TreeToolsPanel key={`${conversationId}.${conversationQuery.data.graph.revision}`} detail={conversationQuery.data} csrfToken={session.csrfToken}
        accountId={accountId} onUpdated={onProfileUpdated} onConflict={async () => { await conversationQuery.refetch(); }} /> },
      { id: 'profile', label: '会话设定', content: <ConversationProfilePanel detail={conversationQuery.data} csrfToken={session.csrfToken}
        onUpdated={onProfileUpdated} onConflict={async () => { await conversationQuery.refetch(); }} /> },
      { id: 'generation', label: '生成参数', content: <GenerationSettingsPanel conversationId={conversationId}
        settings={conversationQuery.data.conversation.generationSettings} version={conversationQuery.data.conversation.generationSettingsVersion}
        csrfToken={session.csrfToken}
        onUpdated={onGenerationSettingsUpdated} onConflict={async () => { await conversationQuery.refetch(); }} /> },
    ] : []),
  ];

  return <div className={`flex ${treeContext ? 'h-full flex-1' : 'h-dvh'} min-h-0 flex-col overflow-hidden bg-slate-950 text-slate-100`}>
    {!treeContext && <header className="relative z-30 flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-950 px-3 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3"><button type="button" className={buttonClass} aria-label="返回学习控制台" onClick={onNavigateConsole}>← <span className="hidden sm:inline">学习控制台</span></button>
        <div><h1 className="text-lg font-bold">独立酒馆</h1><p className="hidden text-xs text-slate-500 sm:block">一个角色，一段属于你的故事</p></div></div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {onNavigateWallet && <WalletBalance accountId={accountId} onClick={onNavigateWallet} />}
        <HeaderMoreMenu>
          {onNavigateModels && <button type="button" className={headerMenuItem} onClick={onNavigateModels}>模型价格</button>}
          <button type="button" className={headerMenuItem} onClick={onNavigateConsole}>学习控制台</button>
          <div data-keep-menu-open className="space-y-3 border-t border-slate-800 px-2 py-3"><ThemeSwitcher /><div><p className="mb-2 text-xs text-slate-500">学习积分</p><CreditPill credit={credit.data ?? null} onSignedIn={() => void credit.refetch()} /></div></div>
          <IdentityAccess onRequestLogout={() => setLogoutOpen(true)} />
        </HeaderMoreMenu>
      </div>
    </header>}
    <main className="flex min-h-0 flex-1">
      {!treeContext && <aside aria-label="角色库" className="hidden w-60 shrink-0 overflow-y-auto border-r border-slate-800 p-4 lg:block">{library}</aside>}
      <section aria-label="角色对话" className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 px-3 py-2 sm:px-5">
          {treeContext && onClose && <button type="button" className={buttonClass} aria-label="返回节点详情" onClick={onClose}>←</button>}
          <button type="button" className={`${buttonClass} ${treeContext ? '' : 'lg:hidden'}`} aria-label="打开角色列表" onClick={() => setDrawer('library')}>☰</button>
          <div className="flex min-w-0 flex-1 items-center gap-2"><CharacterAvatar character={selectedCharacter} /><div className="min-w-0"><h2 className="truncate text-sm font-semibold">{selectedCharacter?.card.name ?? '欢迎来到酒馆'}</h2><p className="mt-0.5 truncate text-xs text-slate-500">{treeContext ? treeContext.nodeTitle ?? treeContext.title : conversationId ? '故事正在继续' : '选择角色，开启故事'}</p></div></div>
          {onShowMap && <button type="button" className={`${buttonClass} shrink-0`} onClick={onShowMap}>查看地图</button>}
          <button type="button" className={`${buttonClass} shrink-0`} onClick={() => { setConfigurationSection('overview'); setConfigurationOpen(true); }}>配置</button>
        </div>
        {treeContext && conversationQuery.data?.conversation.libraryEntryId === treeContext.libraryEntryId && <span className="sr-only">已关联：{treeContext.title}</span>}
        {treeStory.error && <ErrorNotice error={treeStory.error} onRetry={() => void treeStory.refetch()} />}
        {openError != null && <div className="p-4"><ErrorNotice error={openError} /></div>}
        {conversations.error && <div className="p-4"><ErrorNotice error={conversations.error} onRetry={() => void conversations.refetch()} /></div>}
        {conversationId ? conversationQuery.data ? <ConversationPane key={`${accountId}.${conversationId}`} detail={conversationQuery.data} accountId={accountId} csrfToken={session.csrfToken} onCompleted={onCompleted} onRecovered={onRecovered} onGraphChanged={onGraphChanged}
          modelSelection={modelSelection}
          configurationOpen={configurationOpen} configurationSection={configurationSection}
          onOpenModelConfiguration={() => { setConfigurationSection('model'); setConfigurationOpen(true); }}
          onOpenParameters={() => { setConfigurationSection('generation'); setConfigurationOpen(true); }}
          onNavigateWallet={onNavigateWallet} onCloseConfiguration={() => setConfigurationOpen(false)} configuration={configurationSections} />
          : <div className="p-6">{conversationQuery.isPending ? <p role="status" className="text-sm text-slate-400">正在恢复会话与历史…</p> : <ErrorNotice error={conversationQuery.error} onRetry={() => void conversationQuery.refetch()} />}</div>
          : <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-8 text-center">
            <CharacterAvatar character={selectedCharacter} large /><h2 className="text-xl font-bold">{selectedCharacter ? `与${selectedCharacter.card.name}相遇` : '你的故事，从这里开始'}</h2>
            <p className="max-w-sm text-sm leading-7 text-slate-400">{selectedCharacter ? '点击左侧角色，即可开始或继续故事。你的聊天记录会自动保存。' : '打开角色库，导入你喜欢的角色卡。会话和聊天历史保存在当前账号。'}</p>
          </div>}
      </section>
    </main>
    <MobileDrawer open={drawer !== null} desktopVisible={!!treeContext} onClose={() => setDrawer(null)}>
      <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">{drawer === 'library' ? '角色与账号' : '会话详情'}</h2><button type="button" className={buttonClass} onClick={() => setDrawer(null)}>关闭</button></div>
      {drawer === 'library' ? <><IdentityAccess onRequestLogout={() => { setDrawer(null); setLogoutOpen(true); }} /><div className="mt-5">{library}</div></> : summary}
    </MobileDrawer>
    {configurationOpen && !conversationQuery.data && <TavernDialog title="配置" initialSection={configurationSection} onClose={() => setConfigurationOpen(false)} sections={configurationSections} />}
    {importOpen && <CardImportDialog csrfToken={session.csrfToken} onImported={onImported} onClose={() => setImportOpen(false)} />}
    {createOpen && <CreateCharacterDialog csrfToken={session.csrfToken} onCreated={onImported} onClose={() => setCreateOpen(false)} />}
    {editing && <EditCharacterDialog character={editing.character} renameOnly={editing.renameOnly} csrfToken={session.csrfToken}
      conversation={editing.conversation} onSaved={onCharacterSaved} onClose={() => setEditing(null)}
      onConflict={async () => { await Promise.all([characters.refetch(), conversationId ? conversationQuery.refetch() : Promise.resolve()]); }} />}
    {deleting && <TavernDialog title="删除角色卡" onClose={() => setDeleting(null)} busy={removing.isPending}>
      <p className="text-sm leading-6 text-slate-300">从角色库删除「{deleting.card.name}」？已有会话和聊天记录会保留。</p>
      <ErrorNotice error={removing.error} />
      <div className="mt-4 flex gap-3"><button type="button" className={buttonClass} disabled={removing.isPending} onClick={() => removing.mutate(deleting.characterId)}>{removing.isPending ? '删除中…' : '确认删除'}</button>
        <button type="button" className={buttonClass} disabled={removing.isPending} onClick={() => setDeleting(null)}>取消</button></div>
    </TavernDialog>}
    <LogoutConfirmDialog open={logoutOpen} pending={logoutPending} error={logoutError?.message ?? null} onCancel={() => setLogoutOpen(false)} onConfirm={() => void logout().catch(() => undefined)} />
  </div>;
}
