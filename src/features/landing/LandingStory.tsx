import { useEffect, useRef, useState } from 'react';
import {
  getSectionScrollProgress,
  getStoryChapterStyle,
  getStoryPathDrawProgress,
} from './landingMotion';

const STORY_CHAPTERS = [
  {
    index: '01',
    kicker: '从一个问题开始',
    title: '先找到你真正想学的地方。',
    detail: '不用先把整门课从头看完，先从眼前的问题出发。',
    accent: 'cyan',
  },
  {
    index: '02',
    kicker: '拆成可执行的节点',
    title: '把复杂技术，变成下一步。',
    detail: '每个节点都有清晰目标，知道要理解什么，也知道怎样算完成。',
    accent: 'blue',
  },
  {
    index: '03',
    kicker: '沿着依赖关系前进',
    title: '不是背目录，而是在走能力。',
    detail: '前置关系把零散知识连成路径，卡住时也知道该回到哪里。',
    accent: 'violet',
  },
  {
    index: '04',
    kicker: '留下可以验证的结果',
    title: '学会，不再只是“感觉会了”。',
    detail: '完成节点、留下证据，再把这棵树带到下一次学习和实践里。',
    accent: 'amber',
  },
] as const;

const CHAPTER_POSITIONS = [
  'left-[5%] top-[17%] lg:left-[9%] lg:top-[18%]',
  'right-[5%] top-[34%] lg:right-[9%] lg:top-[34%]',
  'left-[5%] top-[53%] lg:left-[14%] lg:top-[52%]',
  'right-[5%] top-[71%] lg:right-[13%] lg:top-[70%]',
];

export default function LandingStory() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const scrollRoot = section?.closest<HTMLElement>('[data-testid="product-landing"]');
    if (!section || !scrollRoot) return;

    let frameId = 0;
    const updateProgress = () => {
      frameId = 0;
      const rootRect = scrollRoot.getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();
      const sectionStart = sectionRect.top - rootRect.top + scrollRoot.scrollTop;
      const sectionScrollDistance = Math.max(section.offsetHeight - scrollRoot.clientHeight, 1);
      setProgress(
        getSectionScrollProgress(scrollRoot.scrollTop, sectionStart, sectionScrollDistance),
      );
    };
    const requestProgressUpdate = () => {
      if (frameId === 0) frameId = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    scrollRoot.addEventListener('scroll', requestProgressUpdate, { passive: true });
    window.addEventListener('resize', requestProgressUpdate);

    return () => {
      scrollRoot.removeEventListener('scroll', requestProgressUpdate);
      window.removeEventListener('resize', requestProgressUpdate);
      if (frameId !== 0) window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mediaQuery) return;

    const updateMotionPreference = () => setReducedMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener?.('change', updateMotionPreference);
    return () => mediaQuery.removeEventListener?.('change', updateMotionPreference);
  }, []);

  const pathDrawProgress = getStoryPathDrawProgress(progress);

  return (
    <section
      ref={sectionRef}
      id="workflow"
      data-testid="landing-story"
      className="relative min-h-[290vh] overflow-clip border-y border-white/10 bg-[#06111f]"
      aria-labelledby="workflow-title"
    >
      <div className="sticky top-0 flex min-h-[calc(100svh-4.5rem)] items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(34,211,238,0.12),transparent_27%),linear-gradient(115deg,rgba(7,17,31,0.98),rgba(8,28,47,0.9))]" />
        <div className="pointer-events-none absolute inset-y-0 left-[7%] hidden w-px bg-gradient-to-b from-transparent via-cyan-300/30 to-transparent lg:block" />
        <div className="pointer-events-none absolute bottom-8 left-[7%] hidden -translate-x-1/2 rotate-180 text-[10px] font-bold tracking-[0.4em] text-cyan-300/60 [writing-mode:vertical-rl] lg:block">
          MAPFLOW / THE ROUTE
        </div>

        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-90"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M 9 7 C 72 11, 84 18, 77 30 S 19 43, 22 57 S 84 68, 82 79 S 30 88, 91 96"
            pathLength="1"
            stroke="rgba(148,163,184,0.18)"
            strokeWidth="0.16"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
          <path
            data-testid="landing-story-path"
            d="M 9 7 C 72 11, 84 18, 77 30 S 19 43, 22 57 S 84 68, 82 79 S 30 88, 91 96"
            pathLength="1"
            stroke="url(#landing-story-gradient)"
            strokeWidth="0.34"
            strokeLinecap="round"
            strokeDasharray="1"
            strokeDashoffset={1 - pathDrawProgress}
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
          <defs>
            <linearGradient id="landing-story-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#67e8f9" />
              <stop offset="0.48" stopColor="#a78bfa" />
              <stop offset="1" stopColor="#fbbf24" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative mx-auto h-full min-h-[calc(100svh-4.5rem)] w-full max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="absolute left-5 top-10 max-w-[19rem] sm:left-8 lg:left-[11%] lg:top-[9%]">
            <p className="text-[11px] font-bold tracking-[0.18em] text-cyan-300">THE MAPFLOW ROUTE</p>
            <h2 id="workflow-title" className="mt-4 text-3xl font-black tracking-[-0.045em] text-white sm:text-5xl">
              把学习，变成一条可以走的路。
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-400 sm:text-base">
              滚动不是换页面，而是在沿着能力路径前进。
            </p>
          </div>

          {STORY_CHAPTERS.map((chapter, chapterIndex) => {
            const style = getStoryChapterStyle(
              progress,
              chapterIndex,
              STORY_CHAPTERS.length,
              reducedMotion,
            );

            return (
              <article
                key={chapter.index}
                data-testid={`landing-story-chapter-${chapter.index}`}
                className={`absolute w-[min(19rem,calc(100%-2.5rem))] rounded-[1.35rem] border border-white/10 bg-slate-950/65 p-5 shadow-[0_26px_70px_-35px_rgba(34,211,238,0.8)] backdrop-blur-xl transition-[opacity,transform] duration-100 ${CHAPTER_POSITIONS[chapterIndex]}`}
                style={{
                  opacity: style.opacity,
                  transform: `translate3d(0, ${style.translateY}px, 0) scale(${style.scale})`,
                  willChange: 'opacity, transform',
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className={`font-mono text-xs ${accentTextClass[chapter.accent]}`}>
                    /{chapter.index}
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_15px_currentColor]" aria-hidden="true" />
                </div>
                <p className="mt-7 text-[10px] font-bold tracking-[0.16em] text-slate-500">{chapter.kicker}</p>
                <h3 className="mt-3 text-xl font-black leading-8 text-white">{chapter.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{chapter.detail}</p>
              </article>
            );
          })}

          <div className="absolute bottom-8 right-5 text-right sm:right-8 lg:right-[10%]">
            <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500">SCROLL TO EXPLORE</p>
            <p className="mt-2 font-mono text-2xl font-bold text-cyan-200">
              {String(Math.round(progress * 100)).padStart(2, '0')}
              <span className="ml-1 text-xs text-cyan-300/60">%</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const accentTextClass = {
  cyan: 'text-cyan-300',
  blue: 'text-blue-300',
  violet: 'text-violet-300',
  amber: 'text-amber-300',
} as const;
