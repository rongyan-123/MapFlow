import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import CompletionFlash from './features/skill-tree/CompletionFlash';
import NodeDetailPanel from './features/skill-tree/NodeDetailPanel';
import ProgressOverview from './features/skill-tree/ProgressOverview';
import SkillTreeCanvas from './features/skill-tree/SkillTreeCanvas';
import IdentityAccess from './features/identity/IdentityAccess';
import { useIdentity } from './features/identity/IdentityContext';
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

type AppView = 'public' | 'personal';

export default function App() {
  const queryClient = useQueryClient();
  const {
    session,
    sessionPending,
    openIdentityDialog,
  } = useIdentity();
  const [view, setView] = useState<AppView>('public');
  const [selectedPublicTreeId, setSelectedPublicTreeId] = useState<string | null>(null);
  const [selectedLibraryEntryId, setSelectedLibraryEntryId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [completion, setCompletion] = useState<{ node: SkillNode; nonce: number } | null>(null);

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
    queryKey: ['me', 'tree-library'],
    queryFn: fetchPersonalLibrary,
    enabled: session !== null,
    staleTime: 30 * 1000,
    retry: false,
  });
  const personalTree = useQuery({
    queryKey: ['me', 'tree-library', selectedLibraryEntryId],
    queryFn: () => fetchPersonalTree(selectedLibraryEntryId ?? ''),
    enabled:
      view === 'personal' && session !== null && selectedLibraryEntryId !== null,
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
    if (!session && !sessionPending && view === 'personal') {
      setView('public');
      setSelectedLibraryEntryId(null);
      setSelectedNodeId(null);
    }
  }, [session, sessionPending, view]);

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
      await queryClient.invalidateQueries({ queryKey: ['me', 'tree-library'] });
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
      await queryClient.invalidateQueries({ queryKey: ['me', 'tree-library'] });
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
  };
  const selectPersonalTree = (libraryEntryId: string) => {
    setSelectedLibraryEntryId(libraryEntryId);
    setSelectedNodeId(null);
    setCompletion(null);
  };
  const showPersonalLibrary = () => {
    if (!session) {
      openIdentityDialog();
      return;
    }
    setView('personal');
    setSelectedNodeId(null);
    setCompletion(null);
  };
  const joinSelectedTree = () => {
    if (!session) {
      openIdentityDialog();
      return;
    }
    if (selectedPublicTreeId) addTree.mutate(selectedPublicTreeId);
  };

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
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-2 sm:px-5">
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
        <nav className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/80 p-1 text-xs">
          <ViewButton
            active={view === 'public'}
            onClick={() => {
              setView('public');
              setSelectedNodeId(null);
              setCompletion(null);
            }}
          >
            公共树库
          </ViewButton>
          <ViewButton active={view === 'personal'} onClick={showPersonalLibrary}>
            我的学习
          </ViewButton>
        </nav>
        <IdentityAccess />
      </header>

      <main className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-950/95 p-3">
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

        <section className="relative min-w-0 flex-1">
          {snapshot ? (
            <SkillTreeCanvas
              snapshot={snapshot}
              displayMode={displayMode}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
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
          />
        ) : (
          <aside className="flex w-80 shrink-0 items-center justify-center border-l border-slate-800 bg-slate-950/95 p-6 text-center text-sm text-slate-600">
            选择并加载技能树后，可在这里查看节点详情。
          </aside>
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
    </div>
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
      <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center">
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
