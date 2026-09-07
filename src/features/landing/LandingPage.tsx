import { useState } from 'react';
import type { IdentitySession } from '../identity/types';
import McpGuideDialog from '../mcp/McpGuideDialog';
import LandingStory from './LandingStory';

interface LandingPageProps {
  session: IdentitySession | null;
  onEnterConsole: () => void;
  onLogin: () => void;
}

export default function LandingPage({
  session,
  onEnterConsole,
  onLogin,
}: LandingPageProps) {
  const [mcpGuideOpen, setMcpGuideOpen] = useState(false);

  return (
    <div
      data-testid="product-landing"
      className="mapflow-landing h-full min-h-screen overflow-y-auto bg-[#f7f5ef] text-[#16383b] selection:bg-[#b8e2d5] selection:text-[#16383b]"
    >
      <header className="sticky top-0 z-30 border-b border-[#dce7e1]/90 bg-[#f7f5ef]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <a
            href="/?marketing=1"
            className="flex min-w-0 items-center gap-3"
            aria-label="MapFlow 产品首页"
          >
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#176f70] text-sm font-black text-white shadow-[0_8px_20px_rgba(23,111,112,0.2)]">
              <span className="absolute inset-1 rounded-lg border border-white/40" aria-hidden="true" />
              M
            </span>
            <span className="truncate text-sm font-black tracking-[0.18em] text-[#16383b] sm:text-base">
              MAPFLOW
            </span>
          </a>

          <nav className="hidden items-center gap-7 text-sm text-[#607477] md:flex" aria-label="产品导航">
            <a className="transition hover:text-[#176f70]" href="#route">
              怎么开始
            </a>
            <a className="transition hover:text-[#176f70]" href="#evidence">
              怎么前进
            </a>
            <button
              type="button"
              aria-label="如何在自己的 Agent 里连接 MapFlow"
              onClick={() => setMcpGuideOpen(true)}
              className="transition hover:text-[#176f70]"
            >
              Agent 接入
            </button>
          </nav>

          <span className="hidden text-xs font-medium text-[#82918f] sm:inline">
            从一个问题开始
          </span>
        </div>
      </header>

      <main>
        <section
          className="relative overflow-hidden border-b border-[#dce7e1]"
          aria-labelledby="landing-hero-title"
        >
          <div className="pointer-events-none absolute -right-36 -top-36 h-[28rem] w-[28rem] rounded-full bg-[#cfe9df]/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -left-32 h-[22rem] w-[22rem] rounded-full bg-[#f3d8c7]/55 blur-3xl" />

          <div
            data-testid="landing-hero-grid"
            className="relative mx-auto grid min-w-0 max-w-6xl grid-cols-1 items-center gap-12 px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:pb-24 lg:pt-24"
          >
            <div data-testid="landing-hero-copy" className="w-full min-w-0 max-w-xl">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#b9d8cf] bg-white/65 px-3 py-1.5 text-[11px] font-bold tracking-[0.14em] text-[#176f70]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e07a52] motion-safe:animate-pulse" aria-hidden="true" />
                一张从好奇心出发的学习地图
              </p>
              <h1
                id="landing-hero-title"
                className="max-w-xl text-4xl font-black leading-[1.08] tracking-[-0.055em] text-[#16383b] sm:text-6xl lg:text-[4.25rem]"
              >
                把你想懂的东西，展开成一张地图。
              </h1>
              <p className="mt-6 max-w-lg text-base leading-8 text-[#607477] sm:text-lg">
                选一个好奇的问题，看看自己能走到哪里。
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={onEnterConsole}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#176f70] px-5 py-3.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(23,111,112,0.22)] transition hover:-translate-y-0.5 hover:bg-[#125e60] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176f70] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f5ef]"
                >
                  试着探索一下
                  <span aria-hidden="true">↗</span>
                </button>
                <button
                  type="button"
                  onClick={session ? onEnterConsole : onLogin}
                  className="inline-flex items-center justify-center rounded-2xl border border-[#b9d8cf] bg-white/60 px-5 py-3.5 text-sm font-bold text-[#176f70] transition hover:border-[#176f70] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176f70] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f5ef]"
                >
                  {session ? '继续我的学习' : '登录'}
                </button>
              </div>

              <p className="mt-5 text-xs leading-6 text-[#82918f]">
                不用先选课程，也不用一次学完整套。先从一个具体问题落脚。
              </p>
            </div>

            <LearningMapIllustration />
          </div>
        </section>

        <LandingStory />
      </main>

      <footer className="border-t border-[#dce7e1] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-xs text-[#82918f] sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold tracking-[0.16em] text-[#176f70]">MAPFLOW</span>
          <span>想学哪里，就从哪里开始。</span>
        </div>
      </footer>

      {mcpGuideOpen && <McpGuideDialog onClose={() => setMcpGuideOpen(false)} />}
    </div>
  );
}

function LearningMapIllustration() {
  return (
    <div
      data-testid="landing-map-illustration"
      role="img"
      aria-label="一张从问题走向下一步的轻量学习地图"
      className="relative mx-auto aspect-[1.08] w-full max-w-[36rem] overflow-hidden rounded-[2rem] border border-[#c9dfd7] bg-[#edf5ef] shadow-[0_24px_70px_-34px_rgba(23,111,112,0.45)]"
    >
      <div className="absolute inset-4 rounded-[1.5rem] border border-dashed border-[#b9d8cf] sm:inset-6" />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 640 520"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M92 168C180 80 228 110 286 194C340 272 396 258 470 178C520 125 548 156 566 217"
          stroke="#9bc8ba"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="9 11"
        />
        <path
          d="M117 347C180 287 229 290 284 326C356 373 424 365 512 292"
          stroke="#dfad91"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="8 12"
        />
        <circle cx="92" cy="168" r="13" fill="#176f70" />
        <circle cx="286" cy="194" r="13" fill="#e07a52" />
        <circle cx="470" cy="178" r="13" fill="#176f70" />
        <circle cx="566" cy="217" r="13" fill="#e07a52" />
        <circle cx="117" cy="347" r="13" fill="#e07a52" />
        <circle cx="284" cy="326" r="13" fill="#176f70" />
        <circle cx="512" cy="292" r="13" fill="#176f70" />
      </svg>

      <div className="absolute left-[8%] top-[16%] rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-[0_12px_26px_rgba(23,111,112,0.1)]">
        <p className="text-[10px] font-bold tracking-[0.16em] text-[#82918f]">起点</p>
        <p className="mt-1 text-sm font-black text-[#16383b]">我想弄懂什么？</p>
      </div>
      <div className="absolute left-[38%] top-[36%] rounded-2xl border border-[#f0c9b6] bg-[#fff8f3] px-4 py-3 shadow-[0_12px_26px_rgba(224,122,82,0.12)]">
        <p className="text-[10px] font-bold tracking-[0.16em] text-[#c16d4a]">正在走</p>
        <p className="mt-1 text-sm font-black text-[#16383b]">一个小目标</p>
      </div>
      <div className="absolute right-[8%] top-[17%] rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-[0_12px_26px_rgba(23,111,112,0.1)]">
        <p className="text-[10px] font-bold tracking-[0.16em] text-[#82918f]">下一步</p>
        <p className="mt-1 text-sm font-black text-[#16383b]">可以验证的结果</p>
      </div>
      <div className="absolute bottom-[14%] left-[18%] rounded-xl border border-[#c9dfd7] bg-[#f8fcf8]/90 px-3 py-2 text-xs font-semibold text-[#176f70]">
        前置关系
      </div>
      <div className="absolute bottom-[12%] right-[18%] rounded-xl border border-[#ecd0c1] bg-[#fff8f3]/90 px-3 py-2 text-xs font-semibold text-[#c16d4a]">
        继续探索
      </div>
    </div>
  );
}
