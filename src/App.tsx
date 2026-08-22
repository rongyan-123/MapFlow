import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminPanel from './features/admin/AdminPanel';
import CreditPill from './features/credit/CreditPill';
import { readCreditSummary } from './features/credit/creditClient';
import CompletionFlash from './features/skill-tree/CompletionFlash';
import NodeDetailPanel from './features/skill-tree/NodeDetailPanel';
import ProgressOverview from './features/skill-tree/ProgressOverview';
import SkillTreeCanvas from './features/skill-tree/SkillTreeCanvas';
import KnowledgeChatPanel from './features/knowledge-chat/KnowledgeChatPanel';
import IdentityAccess from './features/identity/IdentityAccess';
import { useIdentity } from './features/identity/IdentityContext';
import AnnouncementsButton from './features/announcements/AnnouncementsButton';
import AnnouncementsDialog from './features/announcements/AnnouncementsDialog';
import FeedbackDialog from './features/feedback/FeedbackDialog';
import MobileDrawer from './features/navigation/MobileDrawer';
import TreeGenerationDialog from './features/tree-generation/TreeGenerationDialog';
import { readPlatformGenerationEntitlements } from './features/tree-generation/treeGenerationClient';
import {
  addTreeToPersonalLibrary,
  fetchPersonalLibrary,
  fetchPersonalTree,
  fetchPublicTree,
  fetchPublicTrees,
  setNodeCompletion,
} from './features/tree-library/treeLibraryClient';
import type { TreeGraph } from './features/tree-library/types';
import type {
  LearningTreeSnapshot,
  SkillNode,
  TreeDisplayMode,
} from './types/learning';

type AppView = 'public' | 'personal' | 'admin';
type MobileView = 'list' | 'graph' | 'detail' | 'chat';

export default function App() {
  const queryClient = useQueryClient();
  const {
    identityEnabled,
    generationCapabilities,
    capabilitiesPending,
    capabilitiesError,
    session,
    sessionPending,
    openIdentityDialog,
    logout,
    logoutPending,
    logoutError,
  } = useIdentity();
  const [view, setView] = useState<AppView>('public');
  const [selectedPublicTreeId, setSelectedPublicTreeId] = useState<string | null>(null);
  const [selectedLibraryEntryId, setSelectedLibraryEntryId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [completion, setCompletion] = useState<{ node: SkillNode; nonce: number } | null>(null);
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false);
  const [generationSessionId, setGenerationSessionId] = useState<string | null>(
    readGenerationSessionId,
  );
  const [mobileView, setMobileView] = useState<MobileView>('list');
  const [chatOpen, setChatOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const completedGenerationSessionIdRef = useRef<string | null>(null);
  const accountPlayerId = session?.account.playerId ?? null;
  const personalTreeLibraryQueryKey = [
    'me',
    accountPlayerId,
    'tree-library',
  ] as const;
  const platformEntitlementsQueryKey = [
    'me',
    accountPlayerId,
    'platform-generation-entitlements',
  ] as const;
  const creditQueryKey = ['me', accountPlayerId, 'credit'] as const;

  const publicCatalog = useQuery({
    queryKey: ['trees', 'public'],
    queryFn: fetchPublicTrees,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const publicTree = useQuery({
    queryKey: ['trees', 'public', selectedPublicTreeId],
    queryFn: () => fetchPublicTree(selectedPublicTreeId ?? ''),
    enabled: view === 'public' && selectedPublicTreeId !== null,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const personalLibrary = useQuery({
    queryKey: personalTreeLibraryQueryKey,
    queryFn: fetchPersonalLibrary,
    enabled: accountPlayerId !== null,
    staleTime: 30 * 1000,
    retry: false,
  });
  const personalTree = useQuery({
    queryKey: [...personalTreeLibraryQueryKey, selectedLibraryEntryId],
    queryFn: () => fetchPersonalTree(selectedLibraryEntryId ?? ''),
    enabled:
      view === 'personal' &&
      accountPlayerId !== null &&
      selectedLibraryEntryId !== null,
    staleTime: 15 * 1000,
    retry: false,
  });
  const platformEntitlements = useQuery({
    queryKey: platformEntitlementsQueryKey,
    queryFn: readPlatformGenerationEntitlements,
    enabled:
      accountPlayerId !== null &&
      generationCapabilities?.platformFundedEnabled === true,
    staleTime: 15 * 1000,
    retry: false,
  });
  const creditQuery = useQuery({
    queryKey: creditQueryKey,
    queryFn: readCreditSummary,
    enabled:
      accountPlayerId !== null &&
      generationCapabilities?.platformFundedEnabled === true,
    staleTime: 15 * 1000,
    retry: false,
  });

  useEffect(() => {
    const trees = publicCatalog.data?.trees ?? [];
    if (
      trees.length > 0 &&
      (!selectedPublicTreeId || !trees.some((tree) => tree.id === selectedPublicTreeId))
    ) {
      setSelectedPublicTreeId(trees[0].id);
    }
  }, [publicCatalog.data, selectedPublicTreeId]);

  useEffect(() => {
    if (
      view === 'personal' &&
      session &&
      !selectedLibraryEntryId &&
      personalLibrary.data?.entries[0]
    ) {
      setSelectedLibraryEntryId(personalLibrary.data.entries[0].library_entry_id);
    }
  }, [personalLibrary.data, selectedLibraryEntryId, session, view]);

  useEffect(() => {
    setSelectedLibraryEntryId(null);
    setSelectedNodeId(null);
    setCompletion(null);
    setChatOpen(false);
    setMobileView('list');
  }, [accountPlayerId]);

  useEffect(() => {
    if (!session && !sessionPending && view !== 'public') {
      setView('public');
    }
  }, [session, sessionPending, view]);

  useEffect(() => {
    if (!session && !sessionPending) {
      setAnnouncementsOpen(false);
      setFeedbackOpen(false);
      setGenerationDialogOpen(false);
      setGenerationSessionId(null);
      writeGenerationSessionId(null);
    }
  }, [session, sessionPending]);

  useEffect(() => {
    if (session && generationCapabilities?.enabled && generationSessionId) {
      setView('personal');
      setGenerationDialogOpen(true);
    }
  }, [generationCapabilities?.enabled, generationSessionId, session]);

  useEffect(() => {
    const activeSessionId =
      platformEntitlements.data?.activePlatformSessionId ?? null;
    if (!activeSessionId) {
      return;
    }
    if (
      !session ||
      !generationCapabilities?.enabled ||
      generationSessionId ||
      activeSessionId === completedGenerationSessionIdRef.current
    ) {
      return;
    }
    setGenerationSessionId(activeSessionId);
    writeGenerationSessionId(activeSessionId);
  }, [
    generationCapabilities?.enabled,
    generationSessionId,
    platformEntitlements.data?.activePlatformSessionId,
    session,
  ]);

  const activeGraph =
    view === 'public' ? publicTree.data?.graph : personalTree.data?.graph;
  const completedNodeIds =
    view === 'personal' ? personalTree.data?.completed_node_ids ?? [] : [];
  const displayMode: TreeDisplayMode = view === 'public' ? 'showcase' : 'personal';
  const snapshot = activeGraph
    ? snapshotFromGraph(activeGraph, completedNodeIds)
    : null;

  useEffect(() => {
    if (!activeGraph) return;
    if (!activeGraph.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(activeGraph.nodes[0]?.id ?? null);
    }
  }, [activeGraph, selectedNodeId]);

  const addTree = useMutation({
    mutationFn: (treeId: string) => {
      if (!session) throw new Error('请先登录或激活账号。');
      return addTreeToPersonalLibrary(treeId, session.csrfToken);
    },
    onSuccess: async (added) => {
      setSelectedLibraryEntryId(added.library_entry_id);
      setSelectedNodeId(null);
      setCompletion(null);
      setView('personal');
      await queryClient.invalidateQueries({ queryKey: personalTreeLibraryQueryKey });
    },
  });

  const completionMutation = useMutation({
    mutationFn: ({ nodeId, completed }: { nodeId: string; completed: boolean }) => {
      if (!session || !selectedLibraryEntryId) {
        throw new Error('个人技能树会话已失效，请重新登录。');
      }
      return setNodeCompletion(
        selectedLibraryEntryId,
        nodeId,
        completed,
        session.csrfToken,
      );
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: personalTreeLibraryQueryKey });
      if (variables.completed) {
        const node = activeGraph?.nodes.find((item) => item.id === variables.nodeId);
        if (node) setCompletion({ node, nonce: Date.now() });
      } else {
        setCompletion(null);
      }
    },
  });

  const selectPublicTree = (treeId: string) => {
    setSelectedPublicTreeId(treeId);
    setSelectedNodeId(null);
    setCompletion(null);
    setChatOpen(false);
    setMobileView('graph');
  };
  const selectPersonalTree = (libraryEntryId: string) => {
    setSelectedLibraryEntryId(libraryEntryId);
    setSelectedNodeId(null);
    setCompletion(null);
    setChatOpen(false);
    setMobileView('graph');
  };
  const showPersonalLibrary = () => {
    if (!session) {
      openIdentityDialog();
      return;
    }
    setView('personal');
    setSelectedNodeId(null);
    setCompletion(null);
    setChatOpen(false);
  };
  const joinSelectedTree = () => {
    if (!session) {
      openIdentityDialog();
      return;
    }
    if (selectedPublicTreeId) addTree.mutate(selectedPublicTreeId);
  };
  const openTreeGenerator = () => {
    if (!session) {
      openIdentityDialog();
      return;
    }
    if (!generationCapabilities?.enabled) return;
    setView('personal');
    setGenerationDialogOpen(true);
  };
  const rememberGenerationSession = (nextSessionId: string | null) => {
    setGenerationSessionId(nextSessionId);
    writeGenerationSessionId(nextSessionId);
  };
  const showGeneratedTree = (libraryEntryId: string) => {
    completedGenerationSessionIdRef.current = generationSessionId;
    setSelectedLibraryEntryId(libraryEntryId);
    setSelectedNodeId(null);
    setCompletion(null);
    setChatOpen(false);
    setView('personal');
    setGenerationDialogOpen(false);
    rememberGenerationSession(null);
    void queryClient.invalidateQueries({ queryKey: personalTreeLibraryQueryKey });
  };

  const openKnowledgeChat = () => {
    if (!session) {
      openIdentityDialog();
      return;
    }
    if (view !== 'personal' || !selectedLibraryEntryId) return;
    setChatOpen(true);
    setMobileView('chat');
  };
  const closeKnowledgeChat = () => {
    setChatOpen(false);
    setMobileView('detail');
  };
  const goBackOnMobile = () => {
    if (mobileView === 'chat') {
      closeKnowledgeChat();
      return;
    }
    setMobileView(mobileView === 'detail' ? 'graph' : 'list');
  };

  // admin 视图整体替换页面（卸载个人/公共内容，返回时重新挂载）；
  // 放在公共树库加载分支之前，避免树库重试失败时把管理员踢出面板。
  if (view === 'admin' && session) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
        <AdminPanel
          onBack={() => {
            setView('personal');
            setMobileView('list');
          }}
          csrfToken={session.csrfToken}
        />
      </div>
    );
  }

  if (publicCatalog.isPending) return <FullPageStatus message="正在读取公共技能树…" />;
  if (publicCatalog.isError || !publicCatalog.data) {
    return (
      <FullPageStatus
        title="公共技能树暂时无法读取"
        message={readableError(publicCatalog.error)}
        actionLabel="重新读取"
        onAction={() => void publicCatalog.refetch()}
      />
    );
  }

  const selectedPublicTree = publicCatalog.data.trees.find(
    (tree) => tree.id === selectedPublicTreeId,
  );
  const selectedPersonalEntry = personalLibrary.data?.entries.find(
    (entry) => entry.library_entry_id === selectedLibraryEntryId,
  );
  const activeTitle =
    activeGraph?.tree.title ??
    (view === 'public' ? selectedPublicTree?.title : selectedPersonalEntry?.tree.title) ??
    'MapFlow 技能树';
  const treePending =
    view === 'public'
      ? selectedPublicTreeId !== null && publicTree.isPending
      : selectedLibraryEntryId !== null && personalTree.isPending;
  const treeError = view === 'public' ? publicTree.error : personalTree.error;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-2 sm:px-5 max-lg:pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-2">
          {mobileView === 'list' && (
            <button
              type="button"
              aria-label="打开功能菜单"
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 lg:hidden"
            >
              ☰
            </button>
          )}
          {mobileView !== 'list' && mobileView !== 'chat' && (
            <button
              type="button"
              aria-label="返回上一级"
              onClick={goBackOnMobile}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 lg:hidden"
            >
              ←
            </button>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">
              {activeTitle}
            </h1>
            <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">
              {view === 'public'
                ? '公共示例树 · 全亮预览，不代表你的学习进度'
                : '我的学习树 · 进度仅保存在当前账号'}
            </p>
          </div>
        </div>
        <nav className="hidden shrink-0 items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/80 p-1 text-xs lg:flex">
          <ViewButton
            active={view === 'public'}
            onClick={() => {
              setView('public');
              setSelectedNodeId(null);
              setCompletion(null);
              setChatOpen(false);
              setMobileView('list');
            }}
          >
            公共树库
          </ViewButton>
          <ViewButton active={view === 'personal'} onClick={showPersonalLibrary}>
            我的学习
          </ViewButton>
          {session?.account.isAdmin && (
            <ViewButton active={view === 'admin'} onClick={() => setView('admin')}>
              管理面板
            </ViewButton>
          )}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden lg:block">
            <AnnouncementsButton />
          </div>
          <div className="hidden lg:block">
            <button
              type="button"
              aria-label="意见反馈"
              onClick={() => setFeedbackOpen(true)}
              className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-600 hover:text-white"
            >
              意见反馈
            </button>
          </div>
          {session &&
            generationCapabilities?.platformFundedEnabled === true && (
              <CreditPill
                credit={creditQuery.data ?? null}
                onSignedIn={() => {
                  void creditQuery.refetch();
                  void platformEntitlements.refetch();
                }}
              />
            )}
          <div className="hidden lg:block">
            <IdentityAccess />
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          data-testid="mobile-list"
          className={`${
            mobileView === 'list' ? 'flex' : 'hidden'
          } w-full min-h-0 flex-1 flex-col overflow-y-auto border-b border-slate-800 bg-slate-950/95 p-3 max-lg:pb-24 lg:flex lg:w-64 lg:flex-none lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r`}
        >
          <div className="mb-3 px-1">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {view === 'public' ? '公共树池' : '个人树库'}
            </h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-600">
              {view === 'public'
                ? '所有人可浏览；加入后生成独立进度。'
                : '这里只显示当前账号已加入的树。'}
            </p>
          </div>

          <div className="space-y-2">
            {view === 'public' ? (
              publicCatalog.data.trees.map((tree) => (
                <TreeChoice
                  key={tree.id}
                  title={tree.title}
                  subtitle={`${tree.topic} · ${tree.total_nodes} 节点`}
                  active={tree.id === selectedPublicTreeId}
                  onClick={() => selectPublicTree(tree.id)}
                />
              ))
            ) : personalLibrary.isPending ? (
              <SidebarMessage>正在读取个人树库…</SidebarMessage>
            ) : personalLibrary.isError ? (
              <SidebarMessage>{readableError(personalLibrary.error)}</SidebarMessage>
            ) : personalLibrary.data?.entries.length ? (
              personalLibrary.data.entries.map((entry) => (
                <TreeChoice
                  key={entry.library_entry_id}
                  title={entry.tree.title}
                  subtitle={`${entry.completed_nodes}/${entry.tree.total_nodes} 已完成`}
                  active={entry.library_entry_id === selectedLibraryEntryId}
                  onClick={() => selectPersonalTree(entry.library_entry_id)}
                />
              ))
            ) : (
              <SidebarMessage>还没有技能树，先从公共树池加入一棵吧。</SidebarMessage>
            )}
          </div>

          {view === 'personal' &&
            session &&
            (capabilitiesPending ||
              capabilitiesError ||
              generationCapabilities?.enabled === true) && (
              <div className="mt-4">
                {generationCapabilities?.platformFundedEnabled &&
                  platformEntitlements.data && (
                    <p className="mb-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-center text-[11px] font-medium text-amber-200">
                      平台免费生成剩余 {platformEntitlements.data.available} 次
                    </p>
                  )}
                <button
                  type="button"
                  aria-label={
                    generationSessionId ? '查看技能树生成任务' : '生成新技能树'
                  }
                  onClick={openTreeGenerator}
                  disabled={!generationCapabilities?.enabled}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/45 bg-cyan-400/10 px-3 py-2.5 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/15 disabled:cursor-wait disabled:opacity-60"
                >
                  {generationSessionId && (
                    <span
                      data-generation-pulse
                      aria-hidden="true"
                      className="h-2 w-2 animate-pulse rounded-full bg-cyan-300"
                    />
                  )}
                  {generationSessionId
                    ? '生成任务进行中 · 点击查看'
                    : capabilitiesPending
                    ? '正在检查生成能力…'
                    : capabilitiesError
                    ? '生成能力暂不可用'
                    : '生成新技能树'}
                </button>
              </div>
            )}

          {view === 'public' && selectedPublicTreeId && (
            <button
              type="button"
              disabled={addTree.isPending}
              onClick={joinSelectedTree}
              className="mt-4 w-full rounded-xl bg-cyan-300 px-3 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
            >
              {addTree.isPending ? '正在加入…' : '加入我的学习'}
            </button>
          )}
          {addTree.error && <MutationError error={addTree.error} />}
          {completionMutation.error && <MutationError error={completionMutation.error} />}
        </aside>

        <section
          data-testid="mobile-graph"
          className={`${mobileView === 'graph' ? 'block' : 'hidden'} relative min-w-0 flex-1 lg:block`}
        >
          {snapshot ? (
            <SkillTreeCanvas
              key={mobileView}
              snapshot={snapshot}
              displayMode={displayMode}
              selectedNodeId={selectedNodeId}
              onSelectNode={(nodeId) => {
                setSelectedNodeId(nodeId);
                setMobileView('detail');
              }}
            />
          ) : treePending ? (
            <InlineStatus message="正在加载完整技能树…" />
          ) : treeError ? (
            <InlineStatus message={readableError(treeError)} />
          ) : (
            <InlineStatus
              message={
                view === 'personal'
                  ? '从公共树池加入一棵技能树后，就可以从零记录进度。'
                  : '请选择一棵公共技能树。'
              }
            />
          )}
        </section>

        {snapshot ? (
          <div
            data-testid="mobile-detail"
            className={`${
              mobileView === 'detail' && !chatOpen ? 'flex' : 'hidden'
            } min-h-0 flex-1 flex-col overflow-y-auto ${chatOpen ? 'lg:hidden' : 'lg:flex'} lg:w-80 lg:flex-none`}
          >
            <NodeDetailPanel
              snapshot={snapshot}
              displayMode={displayMode}
              selectedNodeId={selectedNodeId}
              completionPending={completionMutation.isPending}
              onSetCompleted={
                view === 'personal'
                  ? (nodeId, completed) =>
                      completionMutation.mutate({ nodeId, completed })
                  : undefined
              }
              onOpenChat={
                view === 'personal' && session && selectedLibraryEntryId
                  ? openKnowledgeChat
                  : undefined
              }
            />
          </div>
        ) : (
          <aside
            data-testid="mobile-detail"
            className={`${
              mobileView === 'detail' && !chatOpen ? 'flex' : 'hidden'
            } w-full min-h-0 flex-1 flex-col items-center justify-center border-t border-slate-800 bg-slate-950/95 p-6 text-center text-sm text-slate-600 ${chatOpen ? 'lg:hidden' : 'lg:flex'} lg:w-80 lg:flex-none lg:border-l lg:border-t-0`}
          >
            选择并加载技能树后，可在这里查看节点详情。
          </aside>
        )}

        {snapshot && view === 'personal' && session && selectedLibraryEntryId && (
          <div
            data-testid="knowledge-chat-panel"
            hidden={!chatOpen}
            className={`${mobileView === 'chat' ? 'flex' : 'hidden'} min-h-0 w-full flex-1 flex-col overflow-hidden ${chatOpen ? 'lg:flex' : 'lg:hidden'} lg:w-80 lg:flex-none`}
          >
            <KnowledgeChatPanel
              treeTitle={activeTitle}
              libraryEntryId={selectedLibraryEntryId}
              csrfToken={session.csrfToken}
              onClose={closeKnowledgeChat}
            />
          </div>
        )}
      </main>

      {snapshot && (
        <ProgressOverview
          displayMode={displayMode}
          totalNodes={snapshot.nodes.length}
          progress={snapshot.progress}
        />
      )}

      {completion && (
        <CompletionFlash
          key={completion.nonce}
          node={completion.node}
          onComplete={() => setCompletion(null)}
        />
      )}

      {generationDialogOpen &&
        session &&
        generationCapabilities?.enabled && (
          <TreeGenerationDialog
            capabilities={generationCapabilities}
            csrfToken={session.csrfToken}
            sessionId={generationSessionId}
            platformEntitlements={platformEntitlements.data ?? null}
            credit={creditQuery.data ?? null}
            onSessionIdChange={rememberGenerationSession}
            onPlatformEntitlementsChanged={() => {
              void platformEntitlements.refetch();
              void creditQuery.refetch();
            }}
            onComplete={showGeneratedTree}
            onClose={() => setGenerationDialogOpen(false)}
          />
        )}

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {(identityEnabled || session) && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5">
            {session ? (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-100">
                  {session.account.username}
                </div>
                <div className="font-mono text-[10px] text-cyan-300">
                  {session.account.playerId}
                </div>
              </div>
            ) : (
              <span className="text-sm text-slate-500">未登录</span>
            )}
            {session ? (
              <button
                type="button"
                aria-label="退出登录"
                disabled={logoutPending}
                onClick={() => void logout().catch(() => undefined)}
                className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:border-rose-400/60 hover:text-rose-300 disabled:opacity-50"
              >
                退出
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  openIdentityDialog();
                  setDrawerOpen(false);
                }}
                className="shrink-0 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/20"
              >
                登录 / 激活账号
              </button>
            )}
            {logoutError && (
              <span className="sr-only" role="alert">
                {logoutError instanceof Error ? logoutError.message : '退出失败'}
              </span>
            )}
          </div>
        )}

        <nav className="flex flex-col gap-1">
          <DrawerItem
            active={view === 'public'}
            onClick={() => {
              setView('public');
              setSelectedNodeId(null);
              setCompletion(null);
              setMobileView('list');
              setDrawerOpen(false);
            }}
          >
            公共树库
          </DrawerItem>
          <DrawerItem
            active={view === 'personal'}
            onClick={() => {
              showPersonalLibrary();
              setMobileView('list');
              setDrawerOpen(false);
            }}
          >
            我的学习
          </DrawerItem>
          {session?.account.isAdmin && (
            <DrawerItem
              active={view === 'admin'}
              onClick={() => {
                setView('admin');
                setDrawerOpen(false);
              }}
            >
              管理面板
            </DrawerItem>
          )}
        </nav>

        {session && (
          <div className="mt-4 flex flex-col gap-1 border-t border-slate-800 pt-4">
            <DrawerItem
              onClick={() => {
                setAnnouncementsOpen(true);
                setDrawerOpen(false);
              }}
            >
              公告
            </DrawerItem>
            <DrawerItem
              onClick={() => {
                setFeedbackOpen(true);
                setDrawerOpen(false);
              }}
            >
              意见反馈
            </DrawerItem>
          </div>
        )}
      </MobileDrawer>

      {announcementsOpen && session && (
        <AnnouncementsDialog onClose={() => setAnnouncementsOpen(false)} />
      )}
      {feedbackOpen && session && (
        <FeedbackDialog onClose={() => setFeedbackOpen(false)} />
      )}

    </div>
  );
}

function readGenerationSessionId(): string | null {
  const sessionId = new URLSearchParams(window.location.search).get(
    'generationSession',
  );
  if (!sessionId || sessionId.length > 128) return null;
  return sessionId;
}

function writeGenerationSessionId(sessionId: string | null) {
  const url = new URL(window.location.href);
  if (sessionId) url.searchParams.set('generationSession', sessionId);
  else url.searchParams.delete('generationSession');
  window.history.replaceState(
    window.history.state,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  );
}

function snapshotFromGraph(
  graph: TreeGraph,
  completedNodeIds: readonly string[],
): LearningTreeSnapshot {
  return {
    tree: graph.tree,
    nodes: graph.nodes,
    edges: graph.edges,
    current_node_id: null,
    progress: completedNodeIds.map((nodeId) => ({
      node_id: nodeId,
      status: 'completed',
      evidence: '',
    })),
  };
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 font-semibold transition ${
        active
          ? 'bg-cyan-300 text-slate-950'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function DrawerItem({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
        active
          ? 'bg-cyan-300 text-slate-950'
          : 'text-slate-300 hover:bg-slate-900 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function TreeChoice({
  title,
  subtitle,
  active,
  onClick,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`查看 ${title}`}
      aria-current={active ? 'true' : undefined}
      onClick={onClick}
      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
        active
          ? 'border-cyan-400/70 bg-cyan-400/10 text-slate-100'
          : 'border-slate-800 bg-slate-900/65 text-slate-400 hover:border-slate-700'
      }`}
    >
      <span className="block text-sm font-semibold leading-5">{title}</span>
      <span className="mt-1 block text-[11px] text-slate-500">{subtitle}</span>
    </button>
  );
}

function SidebarMessage({ children }: { children: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-800 px-3 py-4 text-xs leading-5 text-slate-500">
      {children}
    </p>
  );
}

function MutationError({ error }: { error: Error }) {
  return (
    <p role="alert" className="mt-3 text-xs leading-5 text-rose-300">
      {error.message}
    </p>
  );
}

function InlineStatus({ message }: { message: string }) {
  return (
    <div className="grid h-full place-items-center p-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function FullPageStatus({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <main className="grid h-screen place-items-center bg-slate-950 p-6 text-slate-300">
      <div className="max-w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center">
        {title && <h1 className="text-lg font-semibold text-slate-100">{title}</h1>}
        <p className="mt-2 text-sm leading-6 text-slate-400">{message}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            className="mt-4 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </main>
  );
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : '技能树服务暂时不可用，请稍后重试。';
}
