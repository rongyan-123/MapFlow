import ModelAccessPanel from './ModelAccessPanel';
import { readModelSelection, saveModelSelection } from './modelPreferences';
import useRoleNotices from './useRoleNotices';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import useIsMobile from '../../lib/useIsMobile';
import CreateCharacterDialog from './CreateCharacterDialog';
import EditCharacterDialog from './EditCharacterDialog';
import CharacterLibraryItem from './CharacterLibraryItem';
import ConversationPane from './ConversationPane';
import PanelResizeHandle from './PanelResizeHandle';
import ConversationProfilePanel from './ConversationProfilePanel';
import GenerationSettingsPanel from './GenerationSettingsPanel';
import { createConversation, createLearningConversation, deleteCharacter, fetchCharacters, fetchConversation, fetchConversations, fetchLearningAreaConversations, fetchPlatformModels, openManagementConversation, openTreeConversation, switchConversationCharacter } from './tavernClient';
import type { Character, CompletedTurn, Conversation, ConversationDetail, ConversationGraph, CreateLearningConversationInput, GenerationSettingsState, TavernModelSelection } from './types';
import { CharacterAvatar, CompatibilityReport, ErrorNotice, TavernDialog, buttonClass, inputClass, primaryClass } from './TavernUi';

interface TavernPageProps {
  management?: boolean;
  mapVisible?: boolean; onOpenCanvas?: () => void;
  onNavigateConsole: () => void; onNavigateWallet?: () => void; onNavigateModels?: () => void;
  treeContext?: { libraryEntryId: string; title: string; nodeId?: string; nodeTitle?: string; available?: boolean }; onClose?: () => void; onTreeChanged?: () => void; onShowMap?: () => void;
  // 手机端聊天会隐藏控制台顶栏，原本挂在顶栏上的额度与账号入口改由这里落到对话工具栏的“操作”菜单里。
  mobileHeaderActions?: ReactNode;
}
export default function TavernPage(props: TavernPageProps) {
  const { session } = useIdentity();
  if (!session) return null;
  return <AuthenticatedTavernPage key={`${session.account.playerId}.${props.treeContext?.libraryEntryId ?? (props.management ? 'management' : 'independent')}`} session={session} {...props} />;
}

function AuthenticatedTavernPage({ session, onNavigateConsole, onNavigateWallet, onNavigateModels, treeContext, management, mapVisible, onOpenCanvas, onClose, onTreeChanged, onShowMap, mobileHeaderActions }: TavernPageProps & { session: IdentitySession }) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  // 手机端对话独占整屏，工具栏必须压成一行、次要动作收进「操作」菜单，否则消息区被挤得只剩几百像素。
  // 独立酒馆（/tavern）与从知识点进入的对话走同一条紧凑路径，桌面端逐区域不变。
  const { logout, logoutPending, logoutError } = useIdentity();
  const accountId = session.account.playerId;
  const roleNotices = useRoleNotices(accountId);
  const [importedRole, setImportedRole] = useState<Character | null>(null);
  const [historyRole, setHistoryRole] = useState('all');
  const [historyOpen,setHistoryOpen]=useState(true);
  const selectionKey = `mapflow.tavern.selection.v1.${accountId}${management ? '.management' : ''}`;
  const treeSelectionKey = treeContext ? `${selectionKey}.tree.${treeContext.libraryEntryId}` : null;
  const [rememberedTreeConversation] = useState(() => {
    try { return treeSelectionKey ? window.localStorage.getItem(treeSelectionKey) : null; } catch { return null; }
  });
  const treeSelectionRestored = useRef(false);
  const treeOpeningApplied = useRef(false);
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
  const [parametersOpen, setParametersOpen] = useState(false);
  const [parametersBusy, setParametersBusy] = useState(false);
  const [openingCharacter, setOpeningCharacter] = useState<string | null>(null);
  const [openError, setOpenError] = useState<unknown>(null);
  const openingLock = useRef(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [generationBusy, setGenerationBusy] = useState(false);
  const pendingCreation = useRef<CreateLearningConversationInput | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [drawer, setDrawer] = useState<'library' | 'details' | 'history' | null>(null);
  const [deleting, setDeleting] = useState<Character | null>(null);
  const [modelSelection, setModelSelection] = useState<TavernModelSelection>(() => readModelSelection(accountId));
  const savedCustomSelection = useRef(readModelSelection(accountId, 'custom'));
  function changeModelSelection(selection: TavernModelSelection) {
    if (selection.provider === 'custom') {
      if (selection.apiKey) savedCustomSelection.current = selection;
      else if (modelSelection.provider === 'platform') selection = { ...savedCustomSelection.current, historyBytes: selection.historyBytes };
    } else if (modelSelection.provider === 'custom' && !selection.model) {
      selection = { ...readModelSelection(accountId, 'platform'), historyBytes: selection.historyBytes };
    }
    saveModelSelection(accountId, selection);
    setModelSelection(selection);
  }
  const charactersKey = ['me', accountId, 'tavern', 'characters'] as const;
  const conversationsKey = treeContext
    ? ['me', accountId, 'learning', treeContext.libraryEntryId, 'conversations'] as const
    : ['me', accountId, management ? 'management' : 'tavern', 'conversations'] as const;
  const detailKey = ['me', accountId, 'tavern', 'conversation', conversationId] as const;
  const creditKey = ['me', accountId, 'credit'] as const;
  const characters = useQuery({ queryKey: charactersKey, queryFn: ({ signal }) => fetchCharacters(signal), retry: false });
  const conversations = useQuery({ queryKey: conversationsKey, queryFn: ({ signal }) => treeContext
    ? fetchLearningAreaConversations(treeContext.libraryEntryId, signal) : management ? fetchConversations(signal, 'management') : fetchConversations(signal), retry: false });
  const belongsToCurrentScene = (item: Conversation) => treeContext
    ? item.scene === 'learning' && item.learningAreaId === treeContext.libraryEntryId
    : (management ? item.scene === 'management' : item.scene === undefined || item.scene === 'tavern') && !item.learningAreaId && !item.libraryEntryId;
  const scopedConversations = conversations.data?.filter(belongsToCurrentScene);
  const conversationInScene = scopedConversations?.some(item => item.conversationId === conversationId) === true;
  const conversationQuery = useQuery({ queryKey: detailKey, queryFn: ({ signal }) => fetchConversation(conversationId!, signal), enabled: !!conversationId && conversationInScene, retry: false });
  const currentDetail = conversationInScene && conversationQuery.data && belongsToCurrentScene(conversationQuery.data.conversation)
    ? conversationQuery.data : undefined;
  const managementRestored = useRef(false);
  const managementOpening = useQuery({ queryKey: ['me', accountId, 'management', 'default-conversation'],
    queryFn: ({ signal }) => openManagementConversation({}, session.csrfToken, signal),
    enabled: !!management && conversations.isSuccess && !conversations.isFetching && scopedConversations?.length === 0, retry: false });
  useEffect(() => {
    if (!management || !conversations.isSuccess || conversations.isFetching || managementRestored.current) return;
    const restored = scopedConversations?.find(item => item.conversationId === conversationId) ?? scopedConversations?.[0];
    if (restored) { managementRestored.current = true; selectConversation(restored.conversationId); }
  }, [management, conversations.isSuccess, conversations.isFetching, scopedConversations, conversationId]);
  useEffect(() => {
    if (!managementOpening.data || managementRestored.current || !management) return;
    managementRestored.current = true;
    const saved = managementOpening.data;
    queryClient.setQueryData(['me', accountId, 'tavern', 'conversation', saved.conversation.conversationId], saved);
    onCreated(saved.conversation); void characters.refetch();
  }, [managementOpening.data]);
  useEffect(() => {
    if (!treeContext && conversationId && conversations.isSuccess && !conversations.isFetching && !conversationInScene) selectConversation(null);
  }, [conversationId, conversations.isSuccess, conversations.isFetching, conversationInScene]);
  const credit = useQuery({ queryKey: creditKey, queryFn: readCreditSummary, staleTime: 30_000, retry: false });
  const platformCatalog = useQuery({ queryKey: ['me', accountId, 'tavern', 'platform-models'],
    queryFn: ({ signal }) => fetchPlatformModels(signal), enabled: modelSelection.provider === 'platform', retry: false });
  const platformModelError = modelSelection.provider !== 'platform' ? undefined
    : !modelSelection.model ? '请选择可用的平台模型；如果列表为空，请联系管理员配置 AnyAI。'
    : platformCatalog.isPending ? '正在读取平台模型，请稍后发送。'
    : platformCatalog.error ? '平台模型列表读取失败，请打开模型配置重试。'
    : !platformCatalog.data?.enabled || !platformCatalog.data.models.some(model => model.id === modelSelection.model)
      ? '上次选择的平台模型暂不可用，请打开模型配置重新选择。' : undefined;
  const rememberedTreeStory = scopedConversations?.find(item => item.conversationId === rememberedTreeConversation
    && item.learningAreaId === treeContext?.libraryEntryId);
  const treeStory = useQuery({ queryKey: ['me', accountId, 'tavern', 'tree-conversation', treeContext?.libraryEntryId],
    queryFn: ({ signal }) => openTreeConversation(treeContext!.libraryEntryId, session.csrfToken, signal),
    enabled: !!treeContext && treeContext.available !== false && conversations.isSuccess && !conversations.isFetching && !rememberedTreeStory, retry: false });
  useEffect(() => {
    if (!treeContext || !conversations.isSuccess || conversations.isFetching || treeSelectionRestored.current) return;
    treeSelectionRestored.current = true;
    const restored = rememberedTreeStory ?? (treeContext.available === false ? scopedConversations?.[0] : undefined);
    if (restored) { treeOpeningApplied.current = true; selectConversation(restored.conversationId); }
  }, [conversations.isSuccess, conversations.isFetching, rememberedTreeStory]);
  useEffect(() => {
    if (!treeStory.data || !treeContext || rememberedTreeStory || conversations.isFetching || treeStory.isFetching || treeOpeningApplied.current) return;
    treeOpeningApplied.current = true;
    queryClient.setQueryData<ConversationDetail>(['me', accountId, 'tavern', 'conversation', treeStory.data.conversation.conversationId], previous =>
      previous && previous.graph.revision >= treeStory.data.graph.revision ? previous : treeStory.data);
    onCreated(treeStory.data.conversation);
    void characters.refetch();
  }, [treeStory.data, treeStory.isFetching, conversations.isFetching, rememberedTreeStory]);
  const selectedCharacter = conversationId ? currentDetail?.character : characters.data?.find(item => item.characterId === characterId) ?? characters.data?.[0];
  const treeReady = !treeContext || (treeContext.available !== false && currentDetail?.conversation.learningAreaId === treeContext.libraryEntryId);
  const canCreate = treeReady && selectedCharacter && characters.data?.some(item => item.characterId === selectedCharacter.characterId);
  const removing = useMutation({ mutationFn: (id: string) => deleteCharacter(id, session.csrfToken), onSuccess: (_, id) => {
    void queryClient.cancelQueries({ queryKey: charactersKey, exact: true });
    queryClient.setQueryData<Character[]>(charactersKey, previous => previous?.filter(item => item.characterId !== id));
    setDeleting(null); if (!conversationId && characterId === id) setCharacterId(null);
  } });

  function selectConversation(id: string | null) {
    setParametersOpen(false);
    setConversationId(id); setDeleting(null); setDrawer(null);
    try {
      if (id) {
        window.localStorage.setItem(treeSelectionKey ?? selectionKey, id);
      } else window.localStorage.removeItem(treeSelectionKey ?? selectionKey);
    } catch { /* Server history remains available without local storage. */ }
  }
  async function createNewConversation() {
    if (openingLock.current || !canCreate || !selectedCharacter || generationBusy || (conversationId && !currentDetail)) return;
    openingLock.current = true; setCreatingConversation(true); setOpenError(null);
    const previous = currentDetail?.conversation;
    try {
      const input = {
        characterId: selectedCharacter.characterId, userName: previous?.userName ?? session.account.username,
        ...(previous?.persona ? { persona: previous.persona } : {}),
        ...(previous?.vocabulary ? { vocabulary: previous.vocabulary } : {}), greetingIndex: 0,
      };
      if (treeContext) {
        const request = pendingCreation.current ?? { ...input, clientRequestId: crypto.randomUUID(), toolsEnabled: previous?.treeToolsEnabled === true };
        pendingCreation.current = request;
        const created = await createLearningConversation(treeContext.libraryEntryId, request, session.csrfToken);
        queryClient.setQueryData(['me', accountId, 'tavern', 'conversation', created.conversation.conversationId], created);
        pendingCreation.current = null;
        onCreated(created.conversation);
      } else if (management) {
        const request = pendingCreation.current ?? { ...input, clientRequestId: crypto.randomUUID() };
        pendingCreation.current = request;
        const created = await openManagementConversation({ ...request, newConversation: true }, session.csrfToken);
        queryClient.setQueryData(['me', accountId, 'tavern', 'conversation', created.conversation.conversationId], created);
        pendingCreation.current = null; onCreated(created.conversation);
      } else onCreated(await createConversation(input, session.csrfToken));
    } catch (failure) { setOpenError(failure); }
    finally { openingLock.current = false; setCreatingConversation(false); }
  }
  async function openCharacter(character: Character) {
    if (openingLock.current || !conversations.isSuccess || !treeReady) return;
    if (currentDetail?.character.characterId === character.characterId) { setDrawer(null); return; }
    setCharacterId(character.characterId);
    setOpenError(null);
    if (conversationId) {
      if (!currentDetail) return;
      openingLock.current=true; setOpeningCharacter(character.characterId);
      try {
        const updated=await switchConversationCharacter(conversationId,currentDetail.graph.revision,character.characterId,session.csrfToken);
        onProfileUpdated(updated); setDrawer(null);
      } catch(failure) { setOpenError(failure); await conversationQuery.refetch(); }
      finally { openingLock.current=false; setOpeningCharacter(null); }
      return;
    }
    setDrawer(null);
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
    queryClient.setQueryData<Character[]>(charactersKey, previous => [...(previous ?? []).filter(item => item.characterId !== imported.characterId), imported]);
    setImportOpen(false); setCreateOpen(false); setImportedRole(imported); roleNotices.added(imported.characterId);
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
    setEditing({ character, renameOnly, ...(currentDetail?.conversation.characterId === character.characterId
      ? { conversation: currentDetail } : {}) });
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
      disabled={openingCharacter !== null || creatingConversation || generationBusy || !!pendingCreation.current || !treeReady || !conversations.isSuccess} onSelect={() => void openCharacter(item)}
      actionsDisabled={openingCharacter !== null || (!!conversationId && !conversationQuery.isSuccess)}
      onRename={() => editCharacter(item, true)} onEdit={() => editCharacter(item, false)}
      onDelete={() => { setDrawer(null); removing.reset(); setDeleting(item); }} />)}</div>
  </div>;
  const characterConversations = (scopedConversations ?? []).filter(item =>
    historyRole === 'all' || item.characterId === historyRole || item.conversationId === conversationId);
  const historyRoles = [...new Set((scopedConversations ?? []).map(item => item.characterId))];
  const history = <nav aria-label="会话历史" className="space-y-4">
    <label className="block text-xs text-slate-400">历史角色
      <select aria-label="筛选历史角色" className={`${inputClass} mt-2`} value={historyRole} onChange={event => setHistoryRole(event.target.value)}>
        <option value="all">全部角色</option>{historyRoles.map(id => <option key={id} value={id}>{characters.data?.find(item => item.characterId === id)?.card.name ?? '已隐藏角色'}</option>)}
      </select>
    </label>
    <div className="space-y-1">{characterConversations.filter(item=>historyRole==='all'||item.characterId===historyRole).map(item=><button type="button" key={item.conversationId}
      aria-label={`打开会话 ${item.title}`} aria-current={item.conversationId===conversationId?'page':undefined}
      className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${item.conversationId===conversationId?'bg-cyan-400/15 text-cyan-200':'text-slate-300 hover:bg-slate-800'}`}
      disabled={creatingConversation||generationBusy||!!pendingCreation.current} onClick={()=>{selectConversation(item.conversationId);setDrawer(null);}}>
      <span className="block truncate">{item.title}</span><span className="mt-1 block truncate text-xs text-slate-500">{characters.data?.find(role=>role.characterId===item.characterId)?.card.name??'已隐藏角色'}</span>
    </button>)}</div>
    {conversations.isSuccess&&scopedConversations?.length===0&&<p className="text-xs leading-6 text-slate-500">当前还没有会话。选择角色后新建会话即可开始。</p>}
  </nav>;
  const summary = <div className="space-y-4">
    <label className="block text-xs text-slate-400">历史会话
      <select aria-label="选择会话" className={`${inputClass} mt-2`} value={conversationId ?? ''} disabled={creatingConversation || generationBusy || !!pendingCreation.current} onChange={event => {
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
    ...(currentDetail && conversationId ? [
      ...(treeContext && treeContext.available !== false ? [{ id: 'tools', label: '技能树与工具', content: <TreeToolsPanel key={`${conversationId}.${currentDetail.graph.revision}`} detail={currentDetail} csrfToken={session.csrfToken}
        accountId={accountId} onUpdated={onProfileUpdated} onConflict={async () => { await conversationQuery.refetch(); }} /> }] : []),
      { id: 'profile', label: '会话设定', content: <ConversationProfilePanel detail={currentDetail} csrfToken={session.csrfToken}
        onUpdated={onProfileUpdated} onConflict={async () => { await conversationQuery.refetch(); }} /> },
    ] : []),
  ];
  // 手机端顶栏整条让位：额度与下面这份菜单原样落进对话工具栏的「操作」菜单，
  // 桌面顶栏的「更多」下拉复用同一份节点，避免两处各写一遍之后各自漂移。
  const tavernMenuItems = <>
    {onNavigateModels && <button type="button" className={headerMenuItem} onClick={onNavigateModels}>模型价格</button>}
    <button type="button" className={headerMenuItem} onClick={onNavigateConsole}>学习控制台</button>
    <div data-keep-menu-open className="space-y-3 border-t border-slate-800 px-2 py-3"><ThemeSwitcher /><div><p className="mb-2 text-xs text-slate-500">学习积分</p><CreditPill credit={credit.data ?? null} onSignedIn={() => void credit.refetch()} /></div></div>
    <IdentityAccess onRequestLogout={() => setLogoutOpen(true)} />
  </>;

  return <div className={`flex ${treeContext || management ? 'h-full flex-1' : 'h-dvh'} min-h-0 flex-col overflow-hidden bg-slate-950 text-slate-100`}>
    {!treeContext && !management && !isMobile && <header className="relative z-30 flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-950 px-3 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3"><button type="button" className={buttonClass} aria-label="返回学习控制台" onClick={onNavigateConsole}>← <span className="hidden sm:inline">学习控制台</span></button>
        <div><h1 className="text-lg font-bold">独立酒馆</h1><p className="hidden text-xs text-slate-500 sm:block">一个角色，一段属于你的故事</p></div></div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {onNavigateWallet && <WalletBalance accountId={accountId} onClick={onNavigateWallet} />}
        <HeaderMoreMenu>{tavernMenuItems}</HeaderMoreMenu>
      </div>
    </header>}
    <main className="conversation-workspace flex min-h-0 flex-1">
      {!isMobile&&historyOpen&&!mapVisible&&<>
        <aside aria-label="当前场景会话列表" className="shrink-0 overflow-y-auto border-r border-slate-800 p-3" style={{width:'var(--panel-width, 240px)'}}>
          <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{treeContext?'学习区会话':management?'管理会话':'酒馆会话'}</h2>
            <button className="text-xs text-slate-400 hover:text-cyan-200" aria-label="收起会话列表" onClick={()=>setHistoryOpen(false)}>收起</button></div>
          {canCreate&&<button type="button" className={`${primaryClass} mb-4 w-full`} disabled={creatingConversation||generationBusy||openingCharacter!==null||!conversations.isSuccess||(!!conversationId&&!currentDetail)}
            onClick={()=>void createNewConversation()}>{creatingConversation?'创建中…':pendingCreation.current?'重试新建会话':'新建会话'}</button>}
          {history}
          {!treeContext&&!management&&<section aria-label="角色库" className="mt-5 border-t border-slate-800 pt-4">{library}</section>}
        </aside>
        <PanelResizeHandle label="调整会话列表与聊天宽度" storageKey={`mapflow.chat.history-width.v1.${accountId}`} minWidth={180} remainingWidth={360}/>
      </>}
      <section aria-label="角色对话" className="flex min-w-0 flex-1 flex-col">
        <div className={isMobile
          ? 'flex shrink-0 flex-nowrap items-center gap-2 border-b border-slate-800 px-3 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))]'
          : 'flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2 sm:px-5'}>
          {(treeContext || management) && onClose && <button type="button" className={buttonClass} aria-label="返回学习区列表" onClick={onClose}>←</button>}
          <button type="button" className={buttonClass} aria-label="打开会话列表" onClick={()=>{if(isMobile||mapVisible)setDrawer('history');else setHistoryOpen(open=>!open);}}>◫</button>
          <button type="button" className={buttonClass} aria-label="打开角色列表" onClick={() => { roleNotices.clear(); setDrawer('library'); }}>☰{roleNotices.count > 0 && <span className="ml-1 text-xs text-cyan-200">新增 {roleNotices.count}</span>}</button>
          <div className={`flex ${isMobile ? 'min-w-0' : 'min-w-[100px]'} flex-1 items-center gap-2`}><CharacterAvatar character={selectedCharacter} /><div className="min-w-0"><h2 className="truncate text-sm font-semibold">{selectedCharacter?.card.name ?? '欢迎来到酒馆'}</h2><p className="mt-0.5 truncate text-xs text-slate-500">{treeContext ? treeContext.nodeTitle ?? treeContext.title : conversationId ? '故事正在继续' : '选择角色，开启故事'}</p></div></div>
          {!isMobile && onShowMap && <button type="button" className={`${buttonClass} shrink-0`} onClick={onShowMap}>查看地图</button>}
          {!isMobile && (!historyOpen||mapVisible) && canCreate && <button type="button" className={`${buttonClass} shrink-0`} disabled={creatingConversation || generationBusy || openingCharacter !== null || !conversations.isSuccess || (!!conversationId && !currentDetail)}
            onClick={() => void createNewConversation()}>{creatingConversation ? '创建中…' : pendingCreation.current ? '重试新建会话' : '新建会话'}</button>}
          <button type="button" className={`${buttonClass} shrink-0`} onClick={() => { setConfigurationSection('overview'); setConfigurationOpen(true); }}>配置</button>
          {isMobile && <HeaderMoreMenu label="操作" menuLabel={treeContext ? '会话操作' : '操作菜单'}>
            {onShowMap && <button type="button" className={headerMenuItem} onClick={onShowMap}>查看地图</button>}
            {canCreate && <button type="button" className={headerMenuItem} disabled={creatingConversation || generationBusy || openingCharacter !== null || !conversations.isSuccess || (!!conversationId && !currentDetail)}
              onClick={() => void createNewConversation()}>{creatingConversation ? '创建中…' : pendingCreation.current ? '重试新建会话' : '新建会话'}</button>}
            {mobileHeaderActions}
            {!treeContext && <>
              <div data-keep-menu-open className="border-t border-slate-800 px-2 py-3">{onNavigateWallet && <WalletBalance accountId={accountId} onClick={onNavigateWallet} />}</div>
              {tavernMenuItems}
            </>}
          </HeaderMoreMenu>}
        </div>
        {treeContext && currentDetail?.conversation.libraryEntryId === treeContext.libraryEntryId && <span className="sr-only">已关联：{treeContext.title}</span>}
        {treeStory.error && <ErrorNotice error={treeStory.error} onRetry={() => void treeStory.refetch()} />}
        {managementOpening.error && <ErrorNotice error={managementOpening.error} onRetry={() => void managementOpening.refetch()} />}
        {importedRole && <div role="status" className="flex items-center gap-3 border-b border-slate-800 px-4 py-2 text-sm text-cyan-200">
          <span>角色卡「{importedRole.card.name}」已加入角色库</span><button type="button" className={buttonClass} aria-label={`使用${importedRole.card.name}`}
            disabled={generationBusy || !treeReady || !!pendingCreation.current} onClick={() => { void openCharacter(importedRole); setImportedRole(null); }}>使用</button>
          <button type="button" aria-label="关闭导入提示" onClick={() => setImportedRole(null)}>×</button>
        </div>}
        {openError != null && <div className="p-4"><ErrorNotice error={openError} /></div>}
        {conversations.error && <div className="p-4"><ErrorNotice error={conversations.error} onRetry={() => void conversations.refetch()} /></div>}
        {conversationId ? currentDetail ? <ConversationPane key={`${accountId}.${conversationId}`} detail={currentDetail} accountId={accountId} csrfToken={session.csrfToken} onCompleted={onCompleted} onRecovered={onRecovered} onGraphChanged={onGraphChanged}
          nodeReference={treeContext?.nodeId && treeContext.nodeTitle ? { id: treeContext.nodeId, title: treeContext.nodeTitle } : undefined}
          mapVisible={mapVisible} onOpenCanvas={onOpenCanvas}
          readOnly={treeContext?.available === false}
          modelSelection={{ ...modelSelection, billingPolicy: platformCatalog.data?.policyVersion }} platformModelError={platformModelError}
          onBusyChange={setGenerationBusy}
          configurationOpen={configurationOpen} configurationSection={configurationSection}
          onOpenModelConfiguration={() => { setConfigurationSection('model'); setConfigurationOpen(true); }}
          onOpenParameters={() => setParametersOpen(true)}
          onNavigateWallet={onNavigateWallet} onCloseConfiguration={() => setConfigurationOpen(false)} configuration={configurationSections} />
          : <div className="p-6">{conversationQuery.isPending ? <p role="status" className="text-sm text-slate-400">正在恢复会话与历史…</p> : <ErrorNotice error={conversationQuery.error} onRetry={() => void conversationQuery.refetch()} />}</div>
          : <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-8 text-center">
            <CharacterAvatar character={selectedCharacter} large /><h2 className="text-xl font-bold">{selectedCharacter ? `与${selectedCharacter.card.name}相遇` : '你的故事，从这里开始'}</h2>
            <p className="max-w-sm text-sm leading-7 text-slate-400">{selectedCharacter ? '选择角色后点击新建会话，即可开始故事。你的聊天记录会自动保存。' : '打开角色库，导入你喜欢的角色卡。会话和聊天历史保存在当前账号。'}</p>
          </div>}
      </section>
    </main>
    <MobileDrawer open={drawer !== null} desktopVisible onClose={() => setDrawer(null)}>
      <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">{drawer === 'library' ? '角色与账号' : drawer==='history'?'会话列表':'会话详情'}</h2><button type="button" className={buttonClass} onClick={() => setDrawer(null)}>关闭</button></div>
      {drawer === 'library' ? <><IdentityAccess onRequestLogout={() => { setDrawer(null); setLogoutOpen(true); }} /><div className="mt-5">{library}</div></> : drawer==='history'?history:summary}
    </MobileDrawer>
    {configurationOpen && !currentDetail && <TavernDialog title="配置" initialSection={configurationSection} onClose={() => setConfigurationOpen(false)} sections={configurationSections} />}
    {parametersOpen && currentDetail && conversationId && <TavernDialog title="模型参数" busy={parametersBusy} onClose={() => setParametersOpen(false)}>
      <GenerationSettingsPanel conversationId={conversationId} settings={currentDetail.conversation.generationSettings}
        version={currentDetail.conversation.generationSettingsVersion} csrfToken={session.csrfToken}
        onBusyChange={setParametersBusy} onUpdated={onGenerationSettingsUpdated} onConflict={async () => { await conversationQuery.refetch(); }} />
    </TavernDialog>}
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
