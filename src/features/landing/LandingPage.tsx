import { lazy, Suspense, useState } from 'react';
import type { IdentitySession } from '../identity/types';
import McpGuideDialog from '../mcp/McpGuideDialog';
import LandingStory from './LandingStory';

const SkillTree3D = lazy(() => import('./SkillTree3D'));

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
      className="mapflow-landing h-full min-h-screen overflow-y-auto bg-[#07111f] text-slate-100 selection:bg-cyan-300 selection:text-slate-950"
    >
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07111f]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <a
            href="/?marketing=1"
            className="flex min-w-0 items-center gap-3"
            aria-label="MapFlow 产品首页"
          >
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/70 bg-cyan-300 font-black text-slate-950 shadow-[0_0_26px_rgba(103,232,249,0.34)]">
              <span className="absolute inset-1 rounded-xl border border-slate-950/20" aria-hidden="true" />
              M
            </span>
            <span className="truncate text-sm font-black tracking-[0.2em] text-white sm:text-base">
              MAPFLOW
            </span>
          </a>

          <nav className="hidden items-center gap-8 text-sm text-slate-400 md:flex" aria-label="产品导航">
            <a className="transition hover:text-cyan-200" href="#why">
              为什么是 MapFlow
            </a>
            <a className="transition hover:text-cyan-200" href="#workflow">
              怎么学习
            </a>
            <a className="transition hover:text-cyan-200" href="#features">
              能做什么
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onLogin}
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              {session ? '返回控制台' : '登录'}
            </button>
            <button
              type="button"
              aria-label="进入控制台"
              onClick={onEnterConsole}
              className="mapflow-landing-primary-button rounded-xl border border-cyan-200/90 bg-cyan-300 px-3.5 py-2 text-sm font-bold text-slate-950 shadow-[0_0_22px_rgba(103,232,249,0.28)] transition hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-[0_0_30px_rgba(103,232,249,0.48)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]"
            >
              开始使用
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden" aria-labelledby="landing-hero-title">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_76%_18%,rgba(34,211,238,0.2),transparent_27%),radial-gradient(circle_at_8%_38%,rgba(59,130,246,0.15),transparent_29%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] opacity-35 [background-image:linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />

          <div data-testid="landing-hero-grid" className="mx-auto grid min-w-0 max-w-7xl grid-cols-1 items-center gap-14 px-5 pb-24 pt-20 sm:px-8 lg:max-w-[88rem] lg:grid-cols-[1.2fr_0.8fr] lg:gap-8 lg:pb-32 lg:pt-24">
            <div data-testid="landing-hero-copy" className="w-full min-w-0 max-w-2xl lg:max-w-none">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-bold tracking-[0.16em] text-cyan-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" aria-hidden="true" />
                从学习的困惑开始
              </p>
              <h1
                id="landing-hero-title"
                className="max-w-none text-4xl font-black leading-[1.06] tracking-[-0.055em] text-white sm:text-6xl lg:text-[3rem] xl:whitespace-nowrap"
              >
                <span className="block text-cyan-300 xl:whitespace-nowrap">学习——什么时候变得如此困难？</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-slate-400 sm:text-lg lg:max-w-none">
                <span className="block xl:whitespace-nowrap">学习正在被异化成刷课、背题、追赶要求。</span>
                <span className="block xl:whitespace-nowrap">
                  <strong className="font-black text-cyan-200">痛苦、畏难</strong>随之而来，可到底该学什么、学到了什么，依然模糊。
                </span>
                <span className="mt-2 block xl:whitespace-nowrap">
                  MapFlow 帮你看清学习与就业方向，建立自己的 <strong className="font-black text-cyan-200">知识地图</strong>，随时查看学习进度。
                </span>
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={onEnterConsole}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-200/90 bg-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(103,232,249,0.28)] transition hover:-translate-y-1 hover:bg-cyan-200 hover:shadow-[0_0_38px_rgba(103,232,249,0.52)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]"
                >
                  打开我的学习地图
                  <span aria-hidden="true">↗</span>
                </button>
                <a
                  href="#why"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-5 py-3.5 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/50 hover:bg-white/5 hover:text-cyan-100"
                >
                  了解 MapFlow 如何工作
                </a>
                <button
                  type="button"
                  aria-label="如何在自己的 Agent 里连接 MapFlow"
                  onClick={() => setMcpGuideOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-300/35 bg-violet-300/[0.08] px-5 py-3.5 text-sm font-semibold text-violet-100 transition hover:border-violet-200/65 hover:bg-violet-300/[0.14] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]"
                >
                  如何接入 Agent
                  <span aria-hidden="true">↗</span>
                </button>
              </div>

              <div className="mt-12 grid max-w-xl grid-cols-3 gap-5 border-t border-white/10 pt-6 lg:max-w-none">
                <LandingMetric value="01" label="看清学习与就业方向" />
                <LandingMetric value="∞" label="建立自己的知识地图" />
                <LandingMetric value="AI" label="随时查看学习进度" />
              </div>
            </div>

            <Suspense fallback={<LandingSceneLoading />}>
              <SkillTree3D />
            </Suspense>
          </div>
        </section>

        <section id="why" className="relative border-y border-white/10 bg-[#0a1728]/75" aria-labelledby="why-title">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-20 lg:py-28">
            <div>
              <p className="text-[11px] font-bold tracking-[0.18em] text-cyan-300">痛苦与畏难，从哪里来</p>
              <h2 id="why-title" className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">
                学了这么多，
                <span className="block lg:inline text-cyan-300">我到底学会了什么？</span>
              </h2>
              <p className="mt-6 max-w-xl text-base leading-8 text-slate-400">
                写过项目，看过网课，也追问过许多问题。为什么回头看，还是说不清自己掌握了什么？
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <ReasonCard number="01" title="想进入一个领域，却不知道到底该学什么？" detail="比如 Agent 开发，需要哪些基础，又会遇到哪些工程问题？" />
              <ReasonCard number="02" title="先把学习与就业方向展开成地图。" detail="先看清全貌，再决定从哪里开始。" />
              <ReasonCard number="03" title="让每次理解，都丰富自己的地图。" detail="学到一个概念，就把它放进地图；发现新的联系，就把它们连接起来。" />
            </div>
          </div>
        </section>

        <LandingStory />

        <section id="features" className="border-y border-white/10 bg-[#0a1728]/75" aria-labelledby="features-title">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
            <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
              <div>
                <p className="text-[11px] font-bold tracking-[0.18em] text-cyan-300">看清方向，建立地图</p>
                <h2 id="features-title" className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">
                  把理解留下来，
                  <span className="lg:inline text-cyan-300">随时知道自己在哪里。</span>
                </h2>
              </div>
              <p className="max-w-2xl text-base leading-8 text-slate-400 lg:justify-self-end">
                MapFlow 帮你看清学习与就业方向，建立自己的知识地图，随时查看学习进度。
              </p>
            </div>

            <div className="mt-14 grid gap-4 md:grid-cols-2">
              <FeatureCard number="01" title="指引方向" detail="把一个领域需要的基础、路径和下一步放到同一张地图上。" accent="cyan" />
              <FeatureCard number="02" title="学习地图" detail="把概念、关系和完成情况放在一起，随时知道自己在哪里。" accent="blue" />
              <FeatureCard number="03" title="接入 MCP" detail="让常用的 AI 读取并整理你的地图，继续扩展自己的体系。" accent="violet" />
              <FeatureCard number="04" title="任何地方皆可用" detail="写项目、刷网课、追问问题，都可以留下可继续的学习记录。" accent="amber" />
            </div>
          </div>
        </section>

        <section id="start" className="relative overflow-hidden" aria-labelledby="start-title">
          <div className="pointer-events-none absolute -right-32 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-20 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:py-28">
            <div>
              <p className="text-[11px] font-bold tracking-[0.18em] text-cyan-300">从一张地图开始</p>
              <h2 id="start-title" className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">
                学到了哪里，
                <span className="lg:inline text-cyan-300">打开地图就知道。</span>
              </h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-slate-400">
                告诉 MapFlow，你想学什么；从一个方向开始，逐步建立自己的知识地图。
              </p>
            </div>
            <button
              type="button"
              onClick={onEnterConsole}
              className="inline-flex shrink-0 items-center justify-center gap-3 rounded-2xl border border-cyan-200/90 bg-cyan-300 px-6 py-4 text-sm font-black text-slate-950 shadow-[0_0_32px_rgba(103,232,249,0.25)] transition hover:-translate-y-1 hover:bg-cyan-200 hover:shadow-[0_0_42px_rgba(103,232,249,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]"
            >
              打开我的学习地图
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold tracking-[0.16em] text-slate-300">MAPFLOW</span>
          <span>学到哪里，就从哪里继续。</span>
        </div>
      </footer>

      {mcpGuideOpen && <McpGuideDialog onClose={() => setMcpGuideOpen(false)} />}
    </div>
  );
}

function LandingMetric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-black tracking-tight text-white">{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

function LandingSceneLoading() {
  return (
    <div
      data-testid="skill-tree-3d"
      className="relative mx-auto aspect-[0.92] w-full max-w-[42rem] overflow-hidden rounded-[2rem] border border-cyan-200/20 bg-[#081827] shadow-[0_30px_100px_-28px_rgba(34,211,238,0.38)] sm:aspect-square"
      aria-label="正在加载 3D 技能树展示"
    >
      <div className="absolute inset-5 rounded-[1.5rem] border border-dashed border-cyan-300/15 sm:inset-7" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 animate-pulse rounded-full border border-cyan-200/60 bg-cyan-300/10 shadow-[0_0_45px_rgba(103,232,249,0.28)]" />
          <p className="mt-5 text-xs font-semibold tracking-[0.12em] text-cyan-200">正在展开技能树…</p>
        </div>
      </div>
      <div className="absolute bottom-6 left-6 text-[10px] font-bold tracking-[0.18em] text-cyan-300 sm:bottom-8 sm:left-9">
        SKILL TREE / 3D
      </div>
    </div>
  );
}

function ReasonCard({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <article className="group rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/45 hover:bg-cyan-300/[0.07]">
      <div className="flex items-center justify-between text-xs text-cyan-300">
        <span className="font-mono">/{number}</span>
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]" aria-hidden="true" />
      </div>
      <h3 className="mt-10 text-lg font-bold leading-7 text-white">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-400">{detail}</p>
    </article>
  );
}

function FeatureCard({
  number,
  title,
  detail,
  accent,
}: {
  number: string;
  title: string;
  detail: string;
  accent: 'cyan' | 'blue' | 'violet' | 'amber';
}) {
  const accentClass = {
    cyan: 'text-cyan-300 border-cyan-300/25 group-hover:bg-cyan-300/10',
    blue: 'text-blue-300 border-blue-300/25 group-hover:bg-blue-300/10',
    violet: 'text-violet-300 border-violet-300/25 group-hover:bg-violet-300/10',
    amber: 'text-amber-300 border-amber-300/25 group-hover:bg-amber-300/10',
  }[accent];

  return (
    <article className="group rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-black/10 font-mono text-xs ${accentClass}`}>
        {number}
      </span>
      <h3 className="mt-8 text-xl font-bold text-white">{title}</h3>
      <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">{detail}</p>
    </article>
  );
}
