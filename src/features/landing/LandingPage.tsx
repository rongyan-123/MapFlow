import { lazy, Suspense } from 'react';
import type { IdentitySession } from '../identity/types';
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

          <div data-testid="landing-hero-grid" className="mx-auto grid min-w-0 max-w-7xl grid-cols-1 items-center gap-14 px-5 pb-24 pt-20 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-8 lg:pb-32 lg:pt-24">
            <div data-testid="landing-hero-copy" className="w-full min-w-0 max-w-2xl">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-bold tracking-[0.16em] text-cyan-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" aria-hidden="true" />
                给好奇心一条能走通的路
              </p>
              <h1
                id="landing-hero-title"
                className="max-w-2xl text-4xl font-black leading-[1.06] tracking-[-0.055em] text-white sm:text-6xl lg:text-[4.65rem]"
              >
                <span className="block">不想再看无聊的网课，</span>
                <span className="mt-2 block text-cyan-300">从你真正想学的地方开始。</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-slate-400 sm:text-lg">
                MapFlow 把一门复杂技术拆成一棵可以探索、可以执行的技能树。每个节点都是一个明确的小目标，沿着依赖关系学习，今天就能开始，学到哪里算到哪里。
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={onEnterConsole}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-200/90 bg-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(103,232,249,0.28)] transition hover:-translate-y-1 hover:bg-cyan-200 hover:shadow-[0_0_38px_rgba(103,232,249,0.52)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]"
                >
                  进入控制台
                  <span aria-hidden="true">↗</span>
                </button>
                <a
                  href="#why"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-5 py-3.5 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/50 hover:bg-white/5 hover:text-cyan-100"
                >
                  先看看它怎么学
                </a>
              </div>

              <div className="mt-12 grid max-w-xl grid-cols-3 gap-5 border-t border-white/10 pt-6">
                <LandingMetric value="01" label="从目标开始" />
                <LandingMetric value="∞" label="自由组合路径" />
                <LandingMetric value="AI" label="卡住就问" />
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
              <p className="text-[11px] font-bold tracking-[0.18em] text-cyan-300">不再从头熬到尾</p>
              <h2 id="why-title" className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">
                你不需要学完整套课，
                <span className="block text-cyan-300">才有资格解决一个问题。</span>
              </h2>
              <p className="mt-6 max-w-xl text-base leading-8 text-slate-400">
                网课常常把知识排成一条只能从头走到尾的队伍，项目又常常把所有问题一次性砸过来。MapFlow 把技术拆成一个个可以执行的小节点，让你从眼前的问题出发，走向真正需要的能力。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <ReasonCard number="01" title="想学哪里，就从哪里开始" detail="不必先完成无关章节，先处理你此刻最想弄懂的节点。" />
              <ReasonCard number="02" title="每一步都小到可以行动" detail="一个节点对应一个目标、一个练习方向和一份可验证的结果。" />
              <ReasonCard number="03" title="卡在哪里，就问哪里" detail="在当前技能树里和 AI 对话，让解释贴着你的学习上下文走。" />
            </div>
          </div>
        </section>

        <LandingStory />

        <section id="features" className="border-y border-white/10 bg-[#0a1728]/75" aria-labelledby="features-title">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
            <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
              <div>
                <p className="text-[11px] font-bold tracking-[0.18em] text-cyan-300">学得更轻，走得更远</p>
                <h2 id="features-title" className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">
                  不只是看懂，
                  <span className="text-cyan-300">而是一步步做出来。</span>
                </h2>
              </div>
              <p className="max-w-2xl text-base leading-8 text-slate-400 lg:justify-self-end">
                公共技能树提供可复用的起点，个人学习库保留你的真实进度；节点、对话、复盘和导出，都围绕同一棵树展开。
              </p>
            </div>

            <div className="mt-14 grid gap-4 md:grid-cols-2">
              <FeatureCard number="01" title="结构化的学习路径" detail="用节点和依赖关系看清全局，也能马上找到下一步。" accent="cyan" />
              <FeatureCard number="02" title="看得见的真实进度" detail="每个节点都有目标和可观察证据，完成不是一个模糊的感觉。" accent="blue" />
              <FeatureCard number="03" title="只围绕你的树对话" detail="在当前技能树里向 AI 提问，让解释贴着你正在学的内容。" accent="violet" />
              <FeatureCard number="04" title="把成果带到别处" detail="随时导出技能树与学习进度，继续交给其他工具使用和复盘。" accent="amber" />
            </div>
          </div>
        </section>

        <section id="start" className="relative overflow-hidden" aria-labelledby="start-title">
          <div className="pointer-events-none absolute -right-32 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-20 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:py-28">
            <div>
              <p className="text-[11px] font-bold tracking-[0.18em] text-cyan-300">轮到你了</p>
              <h2 id="start-title" className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">
                告诉 MapFlow，
                <span className="text-cyan-300">你想学什么。</span>
              </h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-slate-400">
                从一棵技能树开始，把复杂技术拆成今天就能走出的下一步。
              </p>
            </div>
            <button
              type="button"
              onClick={onEnterConsole}
              className="inline-flex shrink-0 items-center justify-center gap-3 rounded-2xl border border-cyan-200/90 bg-cyan-300 px-6 py-4 text-sm font-black text-slate-950 shadow-[0_0_32px_rgba(103,232,249,0.25)] transition hover:-translate-y-1 hover:bg-cyan-200 hover:shadow-[0_0_42px_rgba(103,232,249,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]"
            >
              开始构建我的技能树
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold tracking-[0.16em] text-slate-300">MAPFLOW</span>
          <span>想学哪里，就从哪里开始。</span>
        </div>
      </footer>
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
