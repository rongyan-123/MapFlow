import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  getEarthRevealProgress,
  getStorySceneProgress,
  getStoryTimelineState,
  LANDING_SCENE_COUNT,
} from './landingMotion';
import {
  LANDING_MAP_EDGES,
  LANDING_MAP_MCP_NODE,
  LANDING_MAP_NODES,
  getLandingMapNode,
} from './landingMapData';
import LandingCrtShader from './LandingCrtShader';

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  gsap.registerPlugin(ScrollTrigger);
}

type SceneId = 'opening' | 'clarity' | 'domain' | 'mcp' | 'progress';
type MapVariant = 'whole' | 'domain' | 'mcp' | 'progress';

interface LandingStoryProps {
  onEnterConsole: () => void;
  onEarthRevealProgress?: (progress: number) => void;
}

interface LandingScene {
  id: SceneId;
  index: string;
  title: string;
  body: string;
  transition?: string;
  variant?: MapVariant;
}

const LANDING_SCENES: LandingScene[] = [
  {
    id: 'opening',
    index: '01',
    title: '学习——什么时候变得如此困难？',
    body: '学习正在被异化成刷课、背题、追赶要求。痛苦、畏难随之而来，可到底该学什么、学到了什么，依然模糊。',
  },
  {
    id: 'clarity',
    index: '02',
    title: '学了这么多，我到底学会了什么？',
    body: '写过项目，看过网课，也追问过许多问题。为什么回头看，还是说不清自己掌握了什么？',
    transition: '这些理解，还没有汇成一张看得见全貌的学习地图。',
    variant: 'whole',
  },
  {
    id: 'domain',
    index: '03',
    title: '想进入一个领域，却不知道到底该学什么？',
    body: '比如 Agent 开发，需要哪些基础，又会遇到哪些工程问题？把学习与就业方向展开成地图，先看清全貌，再决定从哪里开始。',
    variant: 'domain',
  },
  {
    id: 'mcp',
    index: '04',
    title: '让每次理解，都丰富自己的地图。',
    body: '学到一个概念，就把它放进地图；发现新的联系，就把它们连接起来。接入 MCP 后，也可以让你常用的 AI 帮你补充、整理。',
    variant: 'mcp',
  },
  {
    id: 'progress',
    index: '05',
    title: '学到了哪里，打开地图就知道。',
    body: '已经理解的、还没弄懂的、接下来想探索的，都能在地图上看见。每次回来，都能接着丰富自己的体系。',
    variant: 'progress',
  },
];

function getStoryProgress(story: HTMLElement, scrollRoot: HTMLElement): number {
  const rootRect = scrollRoot.getBoundingClientRect();
  const storyRect = story.getBoundingClientRect();
  const storyStart = scrollRoot.scrollTop + storyRect.top - rootRect.top;
  const distance = Math.max(story.scrollHeight - scrollRoot.clientHeight, 1);
  return Math.min(1, Math.max(0, (scrollRoot.scrollTop - storyStart) / distance));
}

export default function LandingStory({
  onEnterConsole,
  onEarthRevealProgress,
}: LandingStoryProps) {
  const storyRef = useRef<HTMLElement>(null);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);

  useEffect(() => {
    const story = storyRef.current;
    const scrollRoot = story?.closest<HTMLElement>('.mapflow-landing');
    if (!story || !scrollRoot) return undefined;

    const updateStoryState = (triggerProgress?: number | Event) => {
      const nextStoryProgress = typeof triggerProgress === 'number'
        ? triggerProgress
        : getStoryProgress(story, scrollRoot);
      const timelineState = getStoryTimelineState(nextStoryProgress, LANDING_SCENE_COUNT);
      setActiveSceneIndex(timelineState.activeSceneIndex);
      setStoryProgress(nextStoryProgress);
      onEarthRevealProgress?.(getEarthRevealProgress(nextStoryProgress));
    };

    updateStoryState();
    scrollRoot.addEventListener('scroll', updateStoryState, { passive: true });

    const mediaStage = story.querySelector<HTMLElement>('[data-testid="landing-story-media-stage"]');
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const canUseScrollTrigger = typeof window.matchMedia === 'function';
    const scrollTrigger = canUseScrollTrigger && !prefersReducedMotion && mediaStage
      ? ScrollTrigger.create({
        trigger: story,
        scroller: scrollRoot,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => updateStoryState(self.progress),
        onRefresh: (self) => updateStoryState(self.progress),
      })
      : undefined;

    const handleResize = () => {
      scrollTrigger?.refresh();
      updateStoryState();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      scrollRoot.removeEventListener('scroll', updateStoryState);
      window.removeEventListener('resize', handleResize);
      scrollTrigger?.kill();
    };
  }, [onEarthRevealProgress]);

  const timelineState = getStoryTimelineState(storyProgress, LANDING_SCENE_COUNT);
  const mediaScenes = LANDING_SCENES
    .map((scene, sceneIndex) => ({ scene, sceneIndex }))
    .filter(({ scene }) => scene.variant);

  const renderScene = (scene: LandingScene, sceneIndex: number) => {
    const sceneProgress = getStorySceneProgress(storyProgress, sceneIndex, LANDING_SCENE_COUNT);
    const isActive = sceneIndex === activeSceneIndex;
    const sceneStyle = {
      '--mapflow-scene-progress': sceneProgress,
    } as CSSProperties;

    return (
      <article
        key={scene.id}
        id={sceneIndex === LANDING_SCENES.length - 1 ? 'evidence' : undefined}
        data-testid={`landing-story-scene-${scene.index}`}
        data-scene-index={sceneIndex}
        data-active={isActive ? 'true' : 'false'}
        data-scene-id={scene.id}
        className={`mapflow-story__scene mapflow-story__scene--${scene.id}`}
        style={sceneStyle}
        aria-labelledby={`landing-scene-title-${scene.index}`}
      >
        <div
          className={`mapflow-story__inner${scene.id === 'opening' ? ' mapflow-story__inner--opening-viewport' : ''}`}
          data-testid={scene.id === 'opening' ? 'landing-opening-viewport' : undefined}
        >
          <div className="mapflow-story__copy">
            {scene.id === 'opening' ? (
              <div className="mapflow-story__crt-title">
                <h2 id={`landing-scene-title-${scene.index}`} aria-label={scene.title}>
                  <span className="mapflow-story__title-lead">学习——</span>
                  <span className="mapflow-story__title-question">
                    <span className="mapflow-story__title-question-key">什么时候</span>
                    {scene.title.slice('学习——什么时候'.length)}
                  </span>
                </h2>
                <LandingCrtShader text={scene.title} progress={sceneProgress} />
              </div>
            ) : (
              <h2 id={`landing-scene-title-${scene.index}`} aria-label={scene.title}>
                {scene.id === 'clarity' ? (
                  <>
                    <span className="mapflow-story__title-segment mapflow-story__title-segment--prefix">
                      学了这么多，
                    </span>
                    <span className="mapflow-story__title-segment">
                      <span className="mapflow-story__title-clarity-key">我到底</span>
                      学会了什么？
                    </span>
                  </>
                ) : scene.id === 'progress' ? (
                  <>
                    <span className="mapflow-story__title-segment mapflow-story__title-segment--progress-prefix">
                      学到了哪里，
                    </span>
                    <span className="mapflow-story__title-segment mapflow-story__title-segment--progress-answer">
                      打开地图就知道。
                    </span>
                  </>
                ) : (
                  scene.title
                )}
              </h2>
            )}
            <p className="mapflow-story__body">{scene.body}</p>
            {scene.id === 'opening' && (
              <div className="mapflow-story__opening-answer">
                <p>看清学习与就业方向，建立自己的知识地图，随时查看学习进度。</p>
                <strong>这是 MapFlow 想帮你做的事。</strong>
              </div>
            )}
            {scene.transition && <p className="mapflow-story__transition">{scene.transition}</p>}
            {scene.id === 'mcp' && (
              <p className="mapflow-story__example">
                <span>示例操作</span>
                把刚才讨论的数据库迁移，整理进我的地图
              </p>
            )}
            {scene.id === 'progress' && (
              <button
                type="button"
                className="mapflow-story__cta"
                onClick={onEnterConsole}
              >
                打开我的学习地图
                <span aria-hidden="true">↗</span>
              </button>
            )}
          </div>
        </div>
        {sceneIndex < LANDING_SCENES.length - 1 && (
          <span className="mapflow-story__scroll-cue" aria-hidden="true">
            向下阅读 <span>↓</span>
          </span>
        )}
      </article>
    );
  };

  return (
    <section
      ref={storyRef}
      id="route"
      data-testid="landing-story"
      className="mapflow-story"
      aria-label="MapFlow 学习地图产品叙事"
    >
      <div className="mapflow-story__opening">
        {renderScene(LANDING_SCENES[0], 0)}
      </div>

      <div className="mapflow-story__layout">
        <div
          className="mapflow-story__media-stage"
          data-testid="landing-story-media-stage"
          data-base-scene={timelineState.baseSceneIndex}
          data-next-scene={timelineState.nextSceneIndex ?? ''}
          data-media-reveal={timelineState.mediaRevealProgress}
          aria-hidden="true"
          style={{ '--mapflow-media-progress': storyProgress } as CSSProperties}
        >
          <div className="mapflow-story__media-stack">
            {mediaScenes.map(({ scene, sceneIndex }) => {
              const isBaseLayer = timelineState.baseSceneIndex === sceneIndex;
              const isNextLayer = timelineState.nextSceneIndex === sceneIndex;
              const layerRole = isBaseLayer ? 'base' : isNextLayer ? 'next' : 'hidden';
              const revealProgress = isBaseLayer
                ? 1
                : isNextLayer
                  ? timelineState.mediaRevealProgress
                  : 0;
              const mcpRevealProgress = scene.id === 'mcp'
                ? revealProgress
                : scene.id === 'progress'
                  ? 1
                  : 0;

              return (
                <LearningMapGraphic
                  key={scene.id}
                  variant={scene.variant ?? 'whole'}
                  revealProgress={revealProgress}
                  active={timelineState.activeSceneIndex === sceneIndex}
                  layerRole={layerRole}
                  mcpRevealProgress={mcpRevealProgress}
                />
              );
            })}
          </div>
        </div>

        <div className="mapflow-story__copy-column">
          {LANDING_SCENES.slice(1).map((scene, offset) => renderScene(scene, offset + 1))}
        </div>
      </div>
    </section>
  );
}

function LearningMapGraphic({
  variant,
  revealProgress,
  active,
  layerRole,
  mcpRevealProgress,
}: {
  variant: MapVariant;
  revealProgress: number;
  active: boolean;
  layerRole: 'base' | 'next' | 'hidden';
  mcpRevealProgress: number;
}) {
  const baseNodeIds = LANDING_MAP_NODES.map((node) => node.id);
  const nodeIds = baseNodeIds;
  const nodes = nodeIds
    .map((nodeId) => getLandingMapNode(nodeId))
    .filter((node): node is NonNullable<typeof node> => Boolean(node));
  const edges = LANDING_MAP_EDGES.filter(
    (edge) => nodeIds.includes(edge.source) && nodeIds.includes(edge.target),
  );
  const mcpNode = variant === 'mcp' || variant === 'progress' ? LANDING_MAP_MCP_NODE : null;
  const normalizedRevealProgress = Math.min(1, Math.max(0, revealProgress));
  const revealStyle = {
    clipPath: `inset(${(1 - normalizedRevealProgress) * 100}% 0 0 0 round 1.35rem)`,
  } as CSSProperties;

  return (
    <div
      data-testid={`landing-map-graphic-${variant}`}
      data-media-layer={layerRole}
      className={`mapflow-map-graphic mapflow-map-graphic--${variant} mapflow-map-graphic--layer-${layerRole}${active ? ' is-active' : ''}`}
      style={revealStyle}
      role="img"
      aria-label={`Agent 学习地图：${[...nodes, ...(mcpNode ? [mcpNode] : [])].map((node) => node.label).join('、')}`}
    >
      <svg className="mapflow-map-graphic__lines" viewBox="0 0 640 420" fill="none">
        <defs>
          <linearGradient id={`mapflow-edge-${variant}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#60e4d4" />
            <stop offset="1" stopColor="#7f9dff" />
          </linearGradient>
        </defs>
        {edges.map((edge) => {
          const source = getLandingMapNode(edge.source);
          const target = getLandingMapNode(edge.target);
          if (!source || !target) return null;
          const sourcePoint = nodePosition(source.id);
          const targetPoint = nodePosition(target.id);
          const controlX = (sourcePoint.x + targetPoint.x) / 2;
          return (
            <path
              key={edge.id}
              d={`M ${sourcePoint.x} ${sourcePoint.y} Q ${controlX} ${Math.min(sourcePoint.y, targetPoint.y) - 40} ${targetPoint.x} ${targetPoint.y}`}
              stroke={`url(#mapflow-edge-${variant})`}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="6 9"
              opacity="0.72"
            />
          );
        })}
        {mcpNode && mcpRevealProgress > 0.01 && (
          <path
            d="M 422 154 Q 452 254 430 346"
            stroke="#ffb784"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="4 8"
            opacity={0.8 * mcpRevealProgress}
          />
        )}
      </svg>
      {nodes.map((node) => {
        const position = nodePosition(node.id);
        return (
          <span
            key={node.id}
            data-testid={`landing-map-node-${node.id}`}
            className={`mapflow-map-graphic__node mapflow-map-graphic__node--${node.status}`}
            style={{ left: `${(position.x / 640) * 100}%`, top: `${(position.y / 420) * 100}%` }}
          >
            <span className="mapflow-map-graphic__node-dot" />
            <span className="mapflow-map-graphic__node-label">{node.label}</span>
          </span>
        );
      })}
      {mcpNode && mcpRevealProgress > 0.12 && (
        <span
          data-testid="landing-map-mcp-node"
          className="mapflow-map-graphic__mcp-node"
          style={{ left: '67.2%', top: '82.4%', opacity: mcpRevealProgress }}
        >
          <span className="mapflow-map-graphic__node-dot" />
          <span>{mcpNode.label}</span>
        </span>
      )}
      <div className="mapflow-map-graphic__legend">
        <span className="mapflow-map-graphic__legend-label">
          {variant === 'progress' ? '示意进度' : '示意关系'}
        </span>
        <span><i className="is-understood" />已理解</span>
        <span><i className="is-exploring" />正在探索</span>
        <span><i className="is-next" />下一步</span>
      </div>
    </div>
  );
}

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  python: { x: 92, y: 276 },
  fastapi: { x: 206, y: 184 },
  llm: { x: 324, y: 256 },
  agent: { x: 422, y: 154 },
  langgraph: { x: 530, y: 96 },
  rag: { x: 512, y: 300 },
  production: { x: 586, y: 218 },
  mcp: { x: 500, y: 294 },
};

function nodePosition(nodeId: string) {
  return NODE_POSITIONS[nodeId] ?? { x: 320, y: 210 };
}
