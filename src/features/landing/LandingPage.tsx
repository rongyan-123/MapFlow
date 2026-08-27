import type { IdentitySession } from '../identity/types';

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
      className="min-h-screen overflow-y-auto bg-[#07111f] text-slate-100 selection:bg-cyan-300 selection:text-slate-950"
    >
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07111f]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <a href="/?marketing=1" className="flex min-w-0 items-center gap-3" aria-label="MapFlow 产品首页">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-200/60 bg-cyan-300 font-black text-slate-950 shadow-[0_0_22px_rgba(103,232,249,0.35)]">
              M
            </span>
            <span className="truncate text-sm font-black tracking-[0.18em] text-white sm:text-base">
              MAPFLOW
            </span>
          </a>

          <nav className="hidden items-center gap-7 text-sm text-slate-400 md:flex" aria-label="产品导航">
            <a className="transition hover:text-cyan-200" href="#workflow">
              工作方式
            </a>
            <a className="transition hover:text-cyan-200" href="#features">
              核心能力
            </a>
            <a className="transition hover:text-cyan-200" href="#start">
              开始使用
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
              className="rounded-xl border border-cyan-200/80 bg-cyan-300 px-3.5 py-2 text-sm font-bold text-slate-950 shadow-[0_0_20px_rgba(103,232,249,0.25)] transition hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-[0_0_28px_rgba(103,232,249,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]"
            >
              {session ? '进入控制台' : '开始使用'}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_18%,rgba(34,211,238,0.18),transparent_26%),radial-gradient(circle_at_18%_30%,rgba(59,130,246,0.15),transparent_28%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] opacity-35 [background-image:linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />

          <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 pb-24 pt-20 sm:px-8 lg:grid-cols-[1.04fr_0.96fr] lg:gap-10 lg:pb-32 lg:pt-28">
            <div className="max-w-2xl">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" aria-hidden="true" />
                Learning paths · AI guidance
              </p>
              <h1 className="max-w-2xl text-4xl font-black leading-[1.08] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
                把复杂知识，变成一条可执行的成长路径。
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-slate-400 sm:text-lg">
                MapFlow 把目标、前置关系和学习证据组织成一棵可操作的技能树。你知道下一步学什么，也知道什么时候真的掌握了。
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={onEnterConsole}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-200/90 bg-cyan-300 px-5 py-3.5 text-sm font-black text-slate-950 shadow-[0_0_26px_rgba(103,232,249,0.28)] transition hover:-translate-y-1 hover:bg-cyan-200 hover:shadow-[0_0_36px_rgba(103,232,249,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]"
                >
                  进入控制台
                  <span aria-hidden="true">↗</span>
                </button>
                <a
                  href="#workflow"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-5 py-3.5 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/50 hover:bg-white/5 hover:text-cyan-100"
                >
                  了解它如何工作
                </a>
              </div>

              <div className="mt-12 grid max-w-xl grid-cols-3 gap-5 border-t border-white/10 pt-6">
                <LandingMetric value="01" label="目标拆解" />
                <LandingMetric value="∞" label="路径组合" />
                <LandingMetric value="AI" label="随时解释" />
              </div>
            </div>

            <TreePreview />
          </div>
        </section>

        <section id="workflow" className="border-y border-white/10 bg-[#0a1728]/75">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-300">From intent to evidence</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">每一步都有来路，也都有落点。</h2>
              <p className="mt-5 text-base leading-8 text-slate-400">
                不再把学习变成收藏链接。MapFlow 将一个模糊目标变成可浏览、可完成、可复盘的路径。
              </p>
            </div>

            <div className="mt-14 grid gap-4 md:grid-cols-3">
              <WorkflowStep index="01" title="描述你的目标" detail="告诉 MapFlow 你想解决什么问题、达到什么深度，生成一条属于你的路线。" />
              <WorkflowStep index="02" title="沿着依赖学习" detail="每个节点都标明前置知识、核心概念和可观察证据，减少盲目跳跃。" />
              <WorkflowStep index="03" title="和 AI 一起厘清" detail="在自己的技能树里提问，让 AI 结合当前节点解释、举例，并指出边界。" />
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-300">A calmer way to grow</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">让知识变得有结构，<span className="text-cyan-300">让行动变得有方向。</span></h2>
            </div>
            <p className="max-w-2xl text-base leading-8 text-slate-400 lg:justify-self-end">
              公共技能树提供可复用的起点，个人学习库保留你的真实进度；导出、复盘和对话都围绕同一棵树展开。
            </p>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-2">
            <FeatureCard number="01" title="结构化路径" detail="用节点与依赖关系呈现全局，不必在一堆零散资料中猜下一步。" accent="cyan" />
            <FeatureCard number="02" title="可验证进度" detail="完成状态不是装饰：每个节点都对应学习目标与可观察证据。" accent="blue" />
            <FeatureCard number="03" title="树内 AI 教练" detail="对话围绕当前树和节点展开，解释你的问题，而不是泛泛地聊天。" accent="violet" />
            <FeatureCard number="04" title="带走你的成果" detail="随时导出技能树与学习进度，交给其他工具继续使用和复盘。" accent="amber" />
          </div>
        </section>

        <section id="start" className="relative overflow-hidden border-t border-white/10 bg-[#0a1728]">
          <div className="pointer-events-none absolute -right-32 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-20 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:py-24">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-300">Your next move</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">现在，画出你的第一棵树。</h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-slate-400">进入控制台查看公共技能树，登录后即可保存自己的学习路径。</p>
            </div>
            <button
              type="button"
              onClick={onEnterConsole}
              className="inline-flex shrink-0 items-center justify-center gap-3 rounded-2xl border border-cyan-200/90 bg-cyan-300 px-6 py-4 text-sm font-black text-slate-950 shadow-[0_0_30px_rgba(103,232,249,0.25)] transition hover:-translate-y-1 hover:bg-cyan-200 hover:shadow-[0_0_40px_rgba(103,232,249,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1728]"
            >
              开始使用 MapFlow
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold tracking-[0.16em] text-slate-300">MAPFLOW</span>
          <span>把学习路径变成可以继续前进的地图。</span>
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

function WorkflowStep({ index, title, detail }: { index: string; title: string; detail: string }) {
  return (
    <article className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-cyan-300/[0.06]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-cyan-300">/{index}</span>
        <span className="h-px w-12 bg-white/15 transition group-hover:w-20 group-hover:bg-cyan-300/60" aria-hidden="true" />
      </div>
      <h3 className="mt-12 text-xl font-bold text-white">{title}</h3>
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

function TreePreview() {
  return (
    <div
      aria-label="技能树结构预览"
      className="relative mx-auto aspect-square w-full max-w-[34rem] overflow-hidden rounded-[2rem] border border-white/15 bg-[#0b1c2e]/90 p-5 shadow-[0_24px_100px_rgba(8,47,73,0.45)] sm:p-8"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,0.13),transparent_34%)]" />
      <div className="absolute inset-5 rounded-[1.5rem] border border-dashed border-cyan-300/15 sm:inset-8" />
      <div className="relative flex h-full items-center justify-center">
        <div className="absolute left-[18%] top-[17%] h-20 w-20 rounded-full border border-cyan-300/20 bg-cyan-300/5 blur-xl" />
        <div className="absolute right-[15%] bottom-[15%] h-28 w-28 rounded-full border border-blue-300/20 bg-blue-300/5 blur-2xl" />

        <div className="relative w-full max-w-[23rem]">
          <TreeConnector className="left-1/2 top-[4.6rem] h-14 -translate-x-1/2 rotate-90" />
          <TreeConnector className="left-[37%] top-[10.2rem] h-14 -translate-x-1/2 rotate-[55deg]" />
          <TreeConnector className="left-[63%] top-[10.2rem] h-14 -translate-x-1/2 -rotate-[55deg]" />
          <TreeConnector className="left-[23%] top-[15.7rem] h-16 -translate-x-1/2 rotate-[32deg]" />
          <TreeConnector className="left-[77%] top-[15.7rem] h-16 -translate-x-1/2 -rotate-[32deg]" />

          <PreviewNode className="mx-auto w-[11rem] border-cyan-200/70 bg-cyan-300/15 shadow-[0_0_28px_rgba(103,232,249,0.25)]" label="你的目标" detail="Production AI Agent" active />
          <div className="mt-14 grid grid-cols-2 gap-4">
            <PreviewNode label="前置能力" detail="框架与依赖" />
            <PreviewNode label="应用场景" detail="问题与边界" />
          </div>
          <div className="mt-14 grid grid-cols-2 gap-4 px-2">
            <PreviewNode label="可观察证据" detail="能解释 · 能实现" small />
            <PreviewNode label="持续复盘" detail="进度 · 对话" small />
          </div>
        </div>
      </div>

      <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:bottom-7 sm:left-9 sm:right-9">
        <span>MapFlow / 01</span>
        <span className="flex items-center gap-2 text-cyan-300/70"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> live path</span>
      </div>
    </div>
  );
}

function PreviewNode({
  label,
  detail,
  className = '',
  active = false,
  small = false,
}: {
  label: string;
  detail: string;
  className?: string;
  active?: boolean;
  small?: boolean;
}) {
  return (
    <div className={`relative z-10 rounded-2xl border border-white/15 bg-[#10283d]/90 px-3 py-3 text-center shadow-[0_10px_25px_rgba(2,8,23,0.25)] transition duration-300 hover:-translate-y-1 hover:border-cyan-300/50 ${small ? 'py-2.5' : ''} ${className}`}>
      <div className={`text-xs font-bold ${active ? 'text-cyan-100' : 'text-slate-200'}`}>{label}</div>
      <div className="mt-1 truncate text-[10px] text-slate-500">{detail}</div>
    </div>
  );
}

function TreeConnector({ className }: { className: string }) {
  return <span className={`pointer-events-none absolute z-0 origin-top border-l border-dashed border-cyan-300/45 ${className}`} aria-hidden="true" />;
}
