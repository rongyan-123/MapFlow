import { getTreeGuide } from './learningEntry';
import type { PersonalLibraryEntry } from '../tree-library/types';
import type { SkillTree } from '../../types/learning';

interface WorkbenchHomeProps {
  mode: 'public' | 'personal';
  publicTrees: SkillTree[];
  personalEntries: PersonalLibraryEntry[];
  onOpenPublicTree: (treeId: string) => void;
  onContinuePersonalTree: (libraryEntryId: string) => void;
  onCreateTree: () => void;
  createTreeDisabled?: boolean;
  createTreeLabel?: string;
}

export default function WorkbenchHome({
  mode,
  publicTrees,
  personalEntries,
  onOpenPublicTree,
  onContinuePersonalTree,
  onCreateTree,
  createTreeDisabled = false,
  createTreeLabel = '创建自己的地图',
}: WorkbenchHomeProps) {
  const hasPersonalTrees = personalEntries.length > 0;

  return (
    <main
      data-testid="workbench-home"
      className="min-h-0 flex-1 overflow-y-auto bg-[#f6f4ee] text-slate-900"
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">MapFlow / {mode === 'public' ? '探索' : '我的学习'}</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950 sm:text-5xl">{mode === 'public' ? '今天想弄懂什么？' : '继续你的学习'}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">{mode === 'public' ? '从一个具体问题开始。先了解方向，再决定要不要打开整张地图。' : '从你已经留下的节点继续，或者选择一个新的方向。'}</p>
          </div>
          <button
            type="button"
            onClick={onCreateTree}
            disabled={createTreeDisabled}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-700 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            {createTreeLabel}
          </button>
        </div>

        {mode === 'personal' && !hasPersonalTrees && (
          <section className="mt-10 rounded-[1.5rem] border border-dashed border-slate-300 bg-white/70 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-slate-900">还没有自己的学习树</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">先从下面的公共方向选一棵，加入后才会记录你的节点进度。</p>
          </section>
        )}

        {mode === 'personal' && hasPersonalTrees && (
          <section className="mt-10" aria-labelledby="personal-trees-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="personal-trees-title" className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">你的学习进度</h2>
              <span className="text-xs text-slate-500">真实保存的节点记录</span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {personalEntries.map((entry) => (
                <PersonalTreeCard key={entry.library_entry_id} entry={entry} onContinue={onContinuePersonalTree} />
              ))}
            </div>
          </section>
        )}

        {mode === 'public' && hasPersonalTrees && (
          <section className="mt-10 rounded-[1.25rem] border border-slate-200 bg-white/70 p-5 sm:p-6" aria-labelledby="continue-learning-title">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="continue-learning-title" className="font-bold text-slate-900">已有一棵树？</h2>
                <p className="mt-1 text-sm text-slate-600">从已保存的节点进度继续。</p>
                <p className="mt-2 text-xs font-semibold text-emerald-700">
                  {personalEntries[0].completed_nodes} / {personalEntries[0].tree.total_nodes} 个节点已完成
                </p>
              </div>
              <button
                type="button"
                aria-label={`继续探索 ${personalEntries[0].tree.title}`}
                onClick={() => onContinuePersonalTree(personalEntries[0].library_entry_id)}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
              >
                继续探索
              </button>
            </div>
          </section>
        )}

        {(mode === 'public' || !hasPersonalTrees) && (
          <section className="mt-10" aria-labelledby="public-directions-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="public-directions-title" className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">选择一个方向</h2>
              <span className="text-xs text-slate-500">先看简介，再决定下一步</span>
            </div>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              {publicTrees.map((tree, index) => (
                <PublicTreeCard key={tree.id} tree={tree} index={index} onOpen={onOpenPublicTree} />
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}

function PublicTreeCard({ tree, index, onOpen }: { tree: SkillTree; index: number; onOpen: (treeId: string) => void }) {
  const guide = getTreeGuide(tree);
  return (
    <article className="group rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_20px_55px_-42px_rgba(15,23,42,0.6)] transition hover:-translate-y-0.5 hover:border-teal-700/45 hover:shadow-[0_24px_70px_-42px_rgba(15,118,110,0.6)] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#e2f1ed] text-sm font-bold text-teal-800">0{index + 1}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{tree.total_nodes} 个节点</span>
      </div>
      <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-teal-700">{guide.eyebrow}</p>
      <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">{guide.displayTitle}</h2>
      <p className="mt-4 text-sm leading-7 text-slate-600">{guide.audience}</p>
      <p className="mt-5 rounded-xl bg-[#f4f7f4] px-4 py-3 text-sm font-semibold leading-6 text-slate-800">{guide.question}</p>
      <button
        type="button"
        aria-label={`查看 ${tree.title} 简介`}
        onClick={() => onOpen(tree.id)}
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-teal-700/30 bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-900 transition hover:border-teal-700 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
      >
        看看这个方向
        <span className="ml-2" aria-hidden="true">→</span>
      </button>
    </article>
  );
}

function PersonalTreeCard({ entry, onContinue }: { entry: PersonalLibraryEntry; onContinue: (libraryEntryId: string) => void }) {
  const guide = getTreeGuide(entry.tree);
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_20px_55px_-42px_rgba(15,23,42,0.6)] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">我的学习树</p>
          <h3 className="mt-3 text-xl font-black tracking-[-0.035em] text-slate-950">{guide.displayTitle}</h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{entry.completed_nodes} / {entry.tree.total_nodes} 个节点已完成</span>
      </div>
      <p className="mt-5 text-sm leading-7 text-slate-600">你的完成记录会保存在当前账号里，随时可以从这里继续。</p>
      <button
        type="button"
        aria-label={`继续探索 ${entry.tree.title}`}
        onClick={() => onContinue(entry.library_entry_id)}
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
      >
        继续探索
        <span className="ml-2" aria-hidden="true">→</span>
      </button>
    </article>
  );
}
