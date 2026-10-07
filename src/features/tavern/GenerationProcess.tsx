import type { GenerationProcessEvent } from './types';
const names: Record<string, string> = { read_canvas: '读取画布', apply_canvas_patch: '绘图', read_skill_tree: '读取技能树', web_search: '搜索资料', personal_tree_mutation: '修改技能树' };
export default function GenerationProcess({ events, live = false }: { events: GenerationProcessEvent[]; live?: boolean }) {
  const reasoning = events.flatMap(event => event.type === 'reasoning' ? [event.text] : []).join('');
  const tools = events.filter((event): event is Extract<GenerationProcessEvent, { type: 'tool' }> => event.type === 'tool');
  const latest = tools[tools.length - 1];
  if (!reasoning && !tools.length) return null;
  return <div className="mx-auto mb-3 max-w-3xl text-xs text-slate-400 sm:pl-14">
    {reasoning && <details className="mb-2 rounded-xl border border-slate-800 px-3 py-2"><summary className="cursor-pointer">思考过程</summary><pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-6">{reasoning}</pre></details>}
    {latest && <p role="status">{live && latest.state === 'started' ? '正在' : ''}{names[latest.name] ?? '执行工具'}{latest.state === 'completed' ? ' · 已完成' : latest.state === 'failed' ? ' · 未完成' : ''}</p>}
    {!live && tools.length > 2 && <details className="mt-2"><summary className="cursor-pointer">工具过程</summary><ol className="mt-2 space-y-1">{tools.map((tool, index) => <li key={index}>{names[tool.name] ?? '工具'} · {tool.state === 'completed' ? '完成' : tool.state === 'failed' ? '失败' : '开始'}</li>)}</ol></details>}
  </div>;
}
