import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LearningTreeSnapshot, SkillNode, SkillTree } from '../../types/learning';
import SkillTreeCanvas from '../skill-tree/SkillTreeCanvas';
import {
  fetchPublicTree,
  fetchPublicTrees,
} from '../tree-library/treeLibraryClient';
import type { TreeGraph } from '../tree-library/types';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface LoadState<T> {
  status: LoadStatus;
  value: T | null;
}

const EMPTY_STATE = <T,>(): LoadState<T> => ({ status: 'idle', value: null });

export function chooseLandingPublicTree(trees: SkillTree[]): SkillTree | null {
  const searchableTree = (tree: SkillTree) => `${tree.title} ${tree.topic}`.toLowerCase();
  const pythonAgentTree = trees.find((tree) => {
    const searchable = searchableTree(tree);
    return searchable.includes('python') && (searchable.includes('agent') || searchable.includes('智能体'));
  });
  return (
    pythonAgentTree
    ?? trees.find((tree) => {
      const searchable = searchableTree(tree);
      return searchable.includes('agent') || searchable.includes('智能体');
    })
    ?? trees[0]
    ?? null
  );
}

export function snapshotFromLandingGraph(graph: TreeGraph): LearningTreeSnapshot {
  return {
    tree: graph.tree,
    nodes: graph.nodes,
    edges: graph.edges,
    current_node_id: null,
    progress: [],
    demo_source: 'landing-public',
  };
}

export function getLandingPreviewNodeIds(graph: TreeGraph, maxNodes = 10): string[] {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const childrenById = new Map<string, string[]>();
  const childIds = new Set<string>();
  for (const edge of graph.edges) {
    const children = childrenById.get(edge.source_node_id) ?? [];
    children.push(edge.target_node_id);
    childrenById.set(edge.source_node_id, children);
    childIds.add(edge.target_node_id);
  }

  const preferredRoot = graph.nodes.find((node) => {
    const searchable = `${node.title} ${node.description ?? ''}`.toLowerCase();
    return !childIds.has(node.id) && searchable.includes('python');
  }) ?? graph.nodes.find((node) => !childIds.has(node.id)) ?? graph.nodes[0];
  if (!preferredRoot) return [];

  const queue = [preferredRoot.id];
  const visited = new Set<string>();
  const previewNodeIds: string[] = [];
  while (queue.length > 0 && previewNodeIds.length < maxNodes) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId) || !nodesById.has(nodeId)) continue;
    visited.add(nodeId);
    previewNodeIds.push(nodeId);
    queue.push(...(childrenById.get(nodeId) ?? []));
  }
  return previewNodeIds;
}

function initialExplorationMode(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return !window.matchMedia('(max-width: 860px)').matches;
}

function getNodeObjectives(node: SkillNode): string[] {
  if (!node.learning_objectives) return [];
  return node.learning_objectives
    .split(/\n|；|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function LandingPublicMapDemo() {
  const [catalog, setCatalog] = useState<LoadState<SkillTree[]>>(() => EMPTY_STATE<SkillTree[]>());
  const [detail, setDetail] = useState<LoadState<TreeGraph>>(() => EMPTY_STATE<TreeGraph>());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isExploring, setIsExploring] = useState(initialExplorationMode);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(
    () => typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined',
  );
  const demoRef = useRef<HTMLDivElement>(null);
  const catalogRequestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);

  useEffect(() => {
    const target = demoRef.current;
    if (!target || hasEnteredViewport) return undefined;
    if (typeof window.IntersectionObserver === 'undefined') {
      setHasEnteredViewport(true);
      return undefined;
    }

    const root = target.closest<HTMLElement>('.mapflow-landing');
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setHasEnteredViewport(true);
        observer.disconnect();
      },
      { root, rootMargin: '480px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasEnteredViewport]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(max-width: 860px)');
    const syncExplorationMode = () => setIsExploring(!mediaQuery.matches);
    syncExplorationMode();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', syncExplorationMode);
      return () => mediaQuery.removeEventListener('change', syncExplorationMode);
    }
    mediaQuery.addListener?.(syncExplorationMode);
    return () => mediaQuery.removeListener?.(syncExplorationMode);
  }, []);

  const loadCatalog = useCallback(() => {
    const requestId = catalogRequestIdRef.current + 1;
    catalogRequestIdRef.current = requestId;
    setCatalog({ status: 'loading', value: null });
    setDetail(EMPTY_STATE<TreeGraph>());
    setSelectedNodeId(null);

    void fetchPublicTrees()
      .then(({ trees }) => {
        if (requestId !== catalogRequestIdRef.current) return;
        setCatalog({ status: 'ready', value: trees });
      })
      .catch(() => {
        if (requestId === catalogRequestIdRef.current) {
          setCatalog({ status: 'error', value: null });
        }
      });
  }, []);

  useEffect(() => {
    if (!hasEnteredViewport) return undefined;
    void loadCatalog();
    return () => {
      catalogRequestIdRef.current += 1;
    };
  }, [hasEnteredViewport, loadCatalog]);

  const selectedTree = useMemo(
    () => chooseLandingPublicTree(catalog.value ?? []),
    [catalog.value],
  );

  useEffect(() => {
    if (catalog.status !== 'ready') return undefined;
    if (!selectedTree) {
      setDetail({ status: 'error', value: null });
      return undefined;
    }

    let cancelled = false;
    const requestId = detailRequestIdRef.current + 1;
    detailRequestIdRef.current = requestId;
    setDetail({ status: 'loading', value: null });
    setSelectedNodeId(null);
    void fetchPublicTree(selectedTree.id)
      .then(({ graph }) => {
        if (!cancelled && requestId === detailRequestIdRef.current) {
          setDetail({ status: 'ready', value: graph });
        }
      })
      .catch(() => {
        if (!cancelled && requestId === detailRequestIdRef.current) {
          setDetail({ status: 'error', value: null });
        }
      });

    return () => {
      cancelled = true;
      detailRequestIdRef.current += 1;
    };
  }, [catalog.status, selectedTree]);

  const snapshot = detail.value ? snapshotFromLandingGraph(detail.value) : null;
  const initialFitNodeIds = useMemo(
    () => (detail.value ? getLandingPreviewNodeIds(detail.value) : []),
    [detail.value],
  );
  const selectedNode = snapshot?.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const objectives = selectedNode ? getNodeObjectives(selectedNode) : [];

  const retry = () => {
    void loadCatalog();
  };

  return (
    <div
      ref={demoRef}
      className="mapflow-public-map-demo"
      data-testid="landing-public-map-demo"
      data-exploring={isExploring ? 'true' : 'false'}
      aria-label="公共地图预览，只读"
      aria-readonly="true"
    >
      <div className="mapflow-public-map-demo__header">
        <div>
          <span className="mapflow-public-map-demo__eyebrow">公共地图预览</span>
          <h3>{selectedTree?.title ?? 'Agent 开发学习地图'}</h3>
        </div>
      </div>
      <p className="mapflow-public-map-demo__hint">
        拖动地图，点开一个节点。
      </p>

      {!hasEnteredViewport ? (
        <div className="mapflow-public-map-demo__status" role="status">
          下滑进入，查看公共地图。
        </div>
      ) : catalog.status === 'loading' || detail.status === 'loading' ? (
        <div className="mapflow-public-map-demo__status" role="status">
          正在加载公共学习地图…
        </div>
      ) : catalog.status === 'error' || detail.status === 'error' || !snapshot ? (
        <div className="mapflow-public-map-demo__status mapflow-public-map-demo__status--error" role="alert">
          <p>公共学习地图暂时无法加载。</p>
          <button type="button" onClick={retry} aria-label="重新加载公共示例">
            重新加载
          </button>
        </div>
      ) : (
        <>
          <div className="mapflow-public-map-demo__canvas-shell">
            <SkillTreeCanvas
              snapshot={snapshot}
              displayMode="showcase"
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              interactionMode={isExploring ? 'landing-preview' : 'passive'}
              surfaceTheme="light"
              initialFitNodeIds={initialFitNodeIds}
            />
          </div>
          <button
            type="button"
            className="mapflow-public-map-demo__explore-toggle"
            aria-pressed={isExploring}
            onClick={() => setIsExploring((current) => !current)}
          >
            {isExploring ? '继续阅读' : '探索地图'}
          </button>
          <aside className="mapflow-public-map-demo__detail" aria-live="polite">
            {selectedNode ? (
              <>
                <span className="mapflow-public-map-demo__detail-label">节点内容</span>
                <h4>{selectedNode.title}</h4>
                {selectedNode.description && <p>{selectedNode.description}</p>}
                {objectives.length > 0 && (
                  <ul>
                    {objectives.map((objective) => <li key={objective}>{objective}</li>)}
                  </ul>
                )}
              </>
            ) : (
              <p>选择一个节点查看内容。</p>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
