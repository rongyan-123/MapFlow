import { getTreeGuide } from './learningEntry';
import type { SkillTree } from '../../types/learning';

interface TreeIntroductionProps {
  tree: SkillTree;
  onBack: () => void;
  onStartExploring: (question: string) => void;
  onPreviewMap: () => void;
}

export default function TreeIntroduction({
  tree,
  onBack,
  onStartExploring,
  onPreviewMap,
}: TreeIntroductionProps) {
  const guide = getTreeGuide(tree);

  return (
    <section
      data-testid="tree-introduction"
      className="flex min-h-0 flex-1 overflow-y-auto bg-[#f6f4ee] text-slate-900"
      aria-labelledby="tree-introduction-title"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-10 lg:px-12 lg:py-14">
        <button
          type="button"
          onClick={onBack}
          className="self-start rounded-full border border-slate-300 bg-white/75 px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-teal-600 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
        >
          ← 返回探索
        </button>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">{guide.eyebrow}</p>
            <h1
              id="tree-introduction-title"
              className="mt-4 max-w-3xl text-4xl font-black leading-[1.08] tracking-[-0.05em] text-slate-950 sm:text-6xl"
            >
              {guide.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              {guide.summary}
            </p>
          </div>

          <div className="relative min-h-56 overflow-hidden rounded-[2rem] border border-teal-900/10 bg-[#183c3b] p-6 text-white shadow-[0_24px_70px_-35px_rgba(15,118,110,0.75)] sm:min-h-64 sm:p-8">
            <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full border border-teal-100/20" aria-hidden="true" />
            <div className="absolute -bottom-16 left-8 h-44 w-44 rounded-full border border-amber-100/15" aria-hidden="true" />
            <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-teal-100/70">先从一个问题走进去</p>
            <p className="relative mt-8 max-w-sm text-2xl font-bold leading-9 tracking-[-0.03em]">
              {guide.question}
            </p>
            <span className="absolute bottom-6 right-7 text-5xl text-amber-200/75" aria-hidden="true">↘</span>
          </div>
        </div>

        <div className="mt-12 grid gap-4 border-y border-slate-200 py-6 sm:grid-cols-2">
          <InfoBlock title="适合谁" detail={guide.audience} />
          <InfoBlock title="开始前知道这些就够了" detail={guide.prerequisites.join(' · ')} />
        </div>

        <div className="mt-10 flex flex-col gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.55)] sm:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">推荐起点</p>
            <p className="mt-3 text-lg font-semibold leading-8 text-slate-900">推荐从这个问题开始</p>
            <p className="mt-1 max-w-2xl text-sm leading-7 text-slate-600">你可以先看地图，也可以直接把这个问题带进自己的探索草稿。</p>
          </div>
          <button
            type="button"
            onClick={() => onStartExploring(guide.question)}
            className="w-full rounded-xl border border-teal-700/25 bg-teal-50 px-4 py-3 text-left text-sm font-semibold leading-6 text-teal-900 transition hover:border-teal-700 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
          >
            {guide.question}
          </button>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => onStartExploring(guide.question)}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-teal-800 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
          >
            开始探索
            <span className="ml-2" aria-hidden="true">→</span>
          </button>
          <button
            type="button"
            onClick={onPreviewMap}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-teal-700 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
          >
            先看地图
          </button>
        </div>
      </div>
    </section>
  );
}

function InfoBlock({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-slate-700">{detail}</p>
    </div>
  );
}
