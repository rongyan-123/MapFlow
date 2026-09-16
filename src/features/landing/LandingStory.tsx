import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  getEarthRevealProgress,
  getJellyTilt,
  getStorySceneProgress,
  getStoryTimelineState,
  LANDING_SCENE_COUNT,
  type JellyTilt,
} from './landingMotion';
import LandingCrtShader from './LandingCrtShader';
import LandingPublicMapDemo from './LandingPublicMapDemo';

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  gsap.registerPlugin(ScrollTrigger);
}

type SceneId = 'opening' | 'clarity' | 'domain' | 'mcp' | 'progress';
type LandingMediaAsset = 'course-overload' | 'direction-crossroads';

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
  mediaAsset?: LandingMediaAsset;
  mediaAlt?: string;
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
    mediaAsset: 'course-overload',
    mediaAlt: 'Java、Python、Agent 与工程课程封面组成的学习内容拼贴',
  },
  {
    id: 'domain',
    index: '03',
    title: '想进入一个领域，却不知道到底该学什么？',
    body: '比如 Agent 开发，需要哪些基础，又会遇到哪些工程问题？把学习与就业方向展开成地图，先看清全貌，再决定从哪里开始。',
    mediaAsset: 'direction-crossroads',
    mediaAlt: '背包旅人面对 Agent、后端、前端、运维、数据工程和移动开发六条路线',
  },
  {
    id: 'mcp',
    index: '04',
    title: '让每次理解，都丰富自己的地图。',
    body: '学到一个概念，就把它放进地图；发现新的联系，就把它们连接起来。接入 MCP 后，也可以让你常用的 AI 帮你补充、整理。',
  },
  {
    id: 'progress',
    index: '05',
    title: '学到了哪里，打开地图就知道。',
    body: '已经理解的、还没弄懂的、接下来想探索的，都能在地图上看见。每次回来，都能接着丰富自己的体系。',
  },
];

function getStoryProgress(story: HTMLElement, scrollRoot: HTMLElement): number {
  const rootRect = scrollRoot.getBoundingClientRect();
  const storyRect = story.getBoundingClientRect();
  const storyStart = scrollRoot.scrollTop + storyRect.top - rootRect.top;
  const distance = Math.max(story.scrollHeight - scrollRoot.clientHeight, 1);
  return Math.min(1, Math.max(0, (scrollRoot.scrollTop - storyStart) / distance));
}

function getJellyStyle(tilt: JellyTilt, pressed: boolean, reducedMotion: boolean): CSSProperties {
  return {
    '--mapflow-jelly-x': `${tilt.x}px`,
    '--mapflow-jelly-y': `${tilt.y}px`,
    '--mapflow-jelly-rotate-x': `${reducedMotion ? 0 : -tilt.y * 0.65}deg`,
    '--mapflow-jelly-rotate-y': `${reducedMotion ? 0 : tilt.x * 0.65}deg`,
    '--mapflow-jelly-scale': pressed ? 0.97 : tilt.scale,
  } as CSSProperties;
}

function LandingJellyCta({ onEnterConsole }: { onEnterConsole: () => void }) {
  const [tilt, setTilt] = useState<JellyTilt>({ x: 0, y: 0, scale: 1 });
  const [pressed, setPressed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReducedMotion(mediaQuery.matches);
      if (mediaQuery.matches) setTilt({ x: 0, y: 0, scale: 1 });
    };
    update();
    mediaQuery.addEventListener?.('change', update);
    mediaQuery.addListener?.(update);
    return () => {
      mediaQuery.removeEventListener?.('change', update);
      mediaQuery.removeListener?.(update);
    };
  }, []);

  const reset = () => {
    setPressed(false);
    setTilt({ x: 0, y: 0, scale: 1 });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (reducedMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTilt(getJellyTilt(event.clientX, event.clientY, rect));
  };

  return (
    <button
      type="button"
      className="mapflow-jelly-cta"
      data-testid="landing-jelly-cta"
      onClick={onEnterConsole}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') setPressed(true);
      }}
      onKeyUp={(event) => {
        if (event.key === 'Enter' || event.key === ' ') setPressed(false);
      }}
    >
      <span className="mapflow-jelly-cta__base" aria-hidden="true" />
      <span className="mapflow-jelly-cta__surface" style={getJellyStyle(tilt, pressed, reducedMotion)}>
        <span>打开我的学习地图</span>
        <span aria-hidden="true">↗</span>
      </span>
    </button>
  );
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
    .filter(({ scene }) => scene.mediaAsset);

  const renderScene = (scene: LandingScene, sceneIndex: number, extraContent?: ReactNode) => {
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
        className={`mapflow-story__scene mapflow-story__scene--${scene.id}${extraContent ? ' mapflow-story__scene--with-demo' : ''}`}
        style={sceneStyle}
        aria-labelledby={`landing-scene-title-${scene.index}`}
      >
        <div
          className={`mapflow-story__inner${scene.id === 'opening' ? ' mapflow-story__inner--opening-viewport' : ''}${extraContent ? ' mapflow-story__inner--with-demo' : ''}`}
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
              <>
                <ul className="mapflow-story__proof-points">
                  <li><strong>指引方向</strong><span>先看清下一步从哪里开始。</span></li>
                  <li><strong>学习地图</strong><span>把概念、关系和进度放在一处。</span></li>
                  <li><strong>任何地方皆可用</strong><span>常用 AI / MCP 可以帮你整理思路。</span></li>
                </ul>
                <LandingJellyCta onEnterConsole={onEnterConsole} />
              </>
            )}
          </div>
          {scene.mediaAsset && (
            <div
              className="mapflow-story__mobile-media"
              data-testid={`landing-story-mobile-media-${scene.id}`}
              aria-hidden="true"
            >
              <img
                className="mapflow-story__media-image"
                src={`/landing/${scene.mediaAsset}.webp`}
                alt=""
                draggable={false}
              />
            </div>
          )}
          {extraContent}
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

      <div className="mapflow-story__layout mapflow-story__layout--media">
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
              const normalizedReveal = Math.min(1, Math.max(0, revealProgress));
              return (
                <div
                  key={scene.id}
                  data-testid={`landing-story-media-${scene.id}`}
                  data-media-layer={layerRole}
                  className={`mapflow-story__media-layer mapflow-story__media-layer--${scene.id}`}
                  style={{
                    clipPath: `inset(${(1 - normalizedReveal) * 100}% 0 0 0 round 1.35rem)`,
                  }}
                >
                  <img
                    className="mapflow-story__media-image"
                    src={`/landing/${scene.mediaAsset}.webp`}
                    alt={scene.mediaAlt}
                    draggable={false}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="mapflow-story__copy-column">
          {LANDING_SCENES.slice(1, 3).map((scene, offset) => renderScene(scene, offset + 1))}
        </div>
      </div>

      <div className="mapflow-story__independent-scenes">
        {renderScene(
          LANDING_SCENES[3],
          3,
          <div className="mapflow-story__demo-slot">
            <LandingPublicMapDemo />
          </div>,
        )}
        {renderScene(LANDING_SCENES[4], 4)}
      </div>
    </section>
  );
}
