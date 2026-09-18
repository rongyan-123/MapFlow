import { useEffect, useState, type ReactNode } from 'react';

const INSTALL_COMMAND = 'npx @mapflow-publish/mcp';
const CLAUDE_COMMAND = 'claude mcp add mapflow -- npx @mapflow-publish/mcp';
const SKILL_INSTALL_COMMAND = 'npx skills add rongyan-123/MapFlow --skill mapflow-mcp --global';

export type AgentGuideSectionId =
  | 'core'
  | 'map'
  | 'node-status'
  | 'quick-start'
  | 'install-skill'
  | 'configure-mcp'
  | 'first-auth'
  | 'capabilities'
  | 'read-progress'
  | 'modify-map'
  | 'manage-progress'
  | 'claude-code'
  | 'other-agents'
  | 'tokens'
  | 'faq';

type AgentGuideGroupId = 'understand' | 'connect' | 'manage' | 'account';

interface GuideItem {
  id: AgentGuideSectionId;
  label: string;
  summary: string;
}

interface GuideGroup {
  id: AgentGuideGroupId;
  title: string;
  items: readonly GuideItem[];
}

const GUIDE_GROUPS: readonly GuideGroup[] = [
  {
    id: 'understand',
    title: '认识 MapFlow',
    items: [
      { id: 'core', label: '核心理念', summary: '先理解 Agent 要管理什么' },
      { id: 'map', label: '学习地图', summary: '地图、节点与学习路线' },
      { id: 'node-status', label: '节点与学习状态', summary: '状态如何记录在个人地图中' },
    ],
  },
  {
    id: 'connect',
    title: '开始接入',
    items: [
      { id: 'quick-start', label: '快速开始', summary: '从安装到第一次连接' },
      { id: 'install-skill', label: '安装 Skill', summary: '让 Agent 理解 MapFlow' },
      { id: 'configure-mcp', label: '配置 MCP', summary: '把 Agent 接入你的账号' },
      { id: 'first-auth', label: '首次授权', summary: '浏览器授权与本机令牌' },
    ],
  },
  {
    id: 'manage',
    title: '让 Agent 管理你的地图',
    items: [
      { id: 'capabilities', label: 'Agent 能做什么', summary: '可调用的核心能力' },
      { id: 'read-progress', label: '读取地图与学习进度', summary: '先看清当前状态' },
      { id: 'modify-map', label: '修改地图与节点', summary: '整理结构与内容' },
      { id: 'manage-progress', label: '管理学习进度', summary: '让 Agent 协助记录进度' },
      { id: 'claude-code', label: 'Claude Code', summary: '一条命令完成配置' },
      { id: 'other-agents', label: '其他 Agent', summary: '使用通用 MCP 配置' },
    ],
  },
  {
    id: 'account',
    title: '账号与安全',
    items: [
      { id: 'tokens', label: '授权与 Token', summary: '令牌保存在哪里' },
      { id: 'faq', label: '常见问题', summary: '连接失败时先看这里' },
    ],
  },
];

interface McpGuideDialogProps {
  onClose: () => void;
  initialSectionId?: AgentGuideSectionId;
}

export default function McpGuideDialog({
  onClose,
  initialSectionId = 'quick-start',
}: McpGuideDialogProps) {
  const [activeSectionId, setActiveSectionId] =
    useState<AgentGuideSectionId>(initialSectionId);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    setActiveSectionId(initialSectionId);
  }, [initialSectionId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const copyCommand = async (command: string) => {
    if (!navigator.clipboard) {
      setCopiedCommand(null);
      setCopyError(true);
      return;
    }

    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(command);
      setCopyError(false);
    } catch {
      setCopiedCommand(null);
      setCopyError(true);
    }
  };

  const activeGuide = findGuide(activeSectionId);

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/85 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-guide-dialog-title"
        aria-describedby="mcp-guide-dialog-description"
        className="flex h-[min(92vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-cyan-200/20 bg-[#07111f] shadow-[0_30px_100px_-30px_rgba(34,211,238,0.45)]"
      >
        <header className="flex items-start justify-between gap-5 border-b border-white/10 px-5 py-5 sm:px-7">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-cyan-300">MAPFLOW / AGENT</p>
            <h2 id="mcp-guide-dialog-title" className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">
              在自己的 Agent 中连接 MapFlow
            </h2>
            <p id="mcp-guide-dialog-description" className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              从理解学习地图开始，完成 Skill、MCP 和首次授权配置，再让 Agent 协助管理你的地图。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="hidden rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/60 hover:text-cyan-100 sm:inline-flex"
            >
              返回工作台
            </button>
            <button
              type="button"
              aria-label="关闭 Agent 接入教程"
              onClick={onClose}
              className="rounded-xl px-2.5 py-1 text-2xl leading-none text-slate-500 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              ×
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="max-h-56 min-h-0 overflow-y-auto border-b border-white/10 bg-slate-950/35 px-4 py-4 lg:max-h-none lg:border-b-0 lg:border-r lg:px-3 lg:py-5">
            <div className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              目录
            </div>
            <nav aria-label="Agent 接入教程目录" className="grid gap-4 sm:grid-cols-2 lg:block">
              {GUIDE_GROUPS.map((group) => (
                <div key={group.id} data-testid={`mcp-guide-group-${group.id}`} className="lg:mb-5">
                  <h3 className="px-2 text-xs font-bold text-cyan-200">{group.title}</h3>
                  <div className="mt-1.5 space-y-1">
                    {group.items.map((item) => {
                      const active = item.id === activeSectionId;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-label={item.label}
                          aria-current={active ? 'page' : undefined}
                          onClick={() => setActiveSectionId(item.id)}
                          className={active
                            ? 'w-full rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-left text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.1)]'
                            : 'w-full rounded-xl border border-transparent px-3 py-2 text-left text-slate-400 transition hover:border-white/10 hover:bg-white/[0.04] hover:text-slate-100'}
                        >
                          <span className="block text-sm font-semibold">{item.label}</span>
                          <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{item.summary}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          <main className="min-h-0 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
            <div className="mx-auto max-w-3xl">
              <div className="text-xs font-semibold text-cyan-300/80">
                {activeGuide.group.title} <span className="px-1 text-slate-600">/</span> {activeGuide.item.label}
              </div>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                {activeGuide.item.label}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{activeGuide.item.summary}</p>

              <div className="mt-7 text-sm leading-7 text-slate-300">
                <GuideContent
                  sectionId={activeSectionId}
                  copiedCommand={copiedCommand}
                  onCopy={copyCommand}
                />
              </div>

              {copyError && (
                <p role="alert" className="mt-6 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-3 text-sm text-rose-100">
                  当前浏览器不允许自动复制，请手动选中命令复制。
                </p>
              )}
            </div>
          </main>
        </div>
      </section>
    </div>
  );
}

function findGuide(sectionId: AgentGuideSectionId): { group: GuideGroup; item: GuideItem } {
  for (const group of GUIDE_GROUPS) {
    const item = group.items.find((candidate) => candidate.id === sectionId);
    if (item) return { group, item };
  }
  return { group: GUIDE_GROUPS[1], item: GUIDE_GROUPS[1].items[0] };
}

function GuideContent({
  sectionId,
  copiedCommand,
  onCopy,
}: {
  sectionId: AgentGuideSectionId;
  copiedCommand: string | null;
  onCopy: (command: string) => void;
}): ReactNode {
  switch (sectionId) {
    case 'core':
      return (
        <div className="space-y-5">
          <p>
            <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-cyan-200">@mapflow-publish/mcp</code>{' '}
            是 MapFlow 的连接器。它运行在你的电脑上，负责把 Agent 和 MapFlow 账号安全地连起来；学习数据仍然留在自己的账号里。
          </p>
          <InfoPanel title="连接后的分工">
            Skill 负责让 Agent 理解 MapFlow 的地图、节点和操作规则；MCP 负责提供真实的读取与写入能力。两者配合，Agent 才能既理解你的地图，也能按你的指令操作它。
          </InfoPanel>
        </div>
      );
    case 'map':
      return (
        <div className="space-y-5">
          <p>MapFlow 把一个技术、技能或方向拆成一张可探索的学习地图。</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <CapabilityCard name="地图" detail="一条从基础到进阶的完整学习路线。" />
            <CapabilityCard name="节点" detail="路线中的具体知识、技能或能力。" />
            <CapabilityCard name="关系" detail="节点之间的前置、并列和递进关系。" />
          </div>
          <p className="text-slate-400">Agent 读取地图后，可以先解释你当前所在的位置，再根据目标帮你安排下一步。</p>
        </div>
      );
    case 'node-status':
      return (
        <div className="space-y-5">
          <p>公共地图是路线的参考；加入个人地图后，你可以为节点记录自己的学习状态。</p>
          <InfoPanel title="状态属于你的个人副本">
            同一张公共地图可以被不同用户加入。每个人的完成状态保存在自己的个人地图里，不会改变公共地图，也不会影响其他人的进度。
          </InfoPanel>
          <p className="text-slate-400">接入本地 Agent 后，它也可以读取和更新这些节点状态，协助你持续维护学习记录。</p>
        </div>
      );
    case 'quick-start':
      return (
        <div className="space-y-5">
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] p-4 text-cyan-50">
            <strong className="font-bold text-cyan-200">开始前准备：</strong> Node.js 18+、一个已注册的 MapFlow 账号，以及支持 MCP 的 Agent。你不需要下载或部署一个新的 MapFlow 服务。
          </div>
          <ol className="space-y-4">
            <li className="flex gap-3"><StepDot>1</StepDot><span>安装 MapFlow Skill，让 Agent 先理解地图结构和操作规则。</span></li>
            <li className="flex gap-3"><StepDot>2</StepDot><span>配置 MCP 连接器，让 Agent 能读取和修改你的账号数据。</span></li>
            <li className="flex gap-3"><StepDot>3</StepDot><span>第一次运行时完成浏览器授权，之后就可以直接让 Agent 管理你的地图。</span></li>
          </ol>
          <p className="text-slate-400">下面的栏目按这个顺序展开；如果你只想快速配置，也可以直接从“安装 Skill”开始。</p>
        </div>
      );
    case 'install-skill':
      return (
        <div className="space-y-4">
          <p>Skill 负责告诉 Agent 如何理解 MapFlow 的树结构、节点、块，以及两种固定的布局方式。先安装 Skill，再配置 MCP，Agent 才能按 MapFlow 的规则工作。</p>
          <CommandBlock
            command={SKILL_INSTALL_COMMAND}
            testId="mapflow-skill-install-command"
            copyLabel="复制 Skill 安装命令"
            copied={copiedCommand === SKILL_INSTALL_COMMAND}
            onCopy={onCopy}
          />
          <p className="text-slate-500">
            <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-slate-300">--global</code> 会把 Skill 安装到当前电脑，供支持 Skills 的 Agent 使用；只想给当前项目使用时可以去掉它。
          </p>
        </div>
      );
    case 'configure-mcp':
      return (
        <div className="space-y-4">
          <p>在终端里运行下面这条命令。第一次运行时，npx 会下载连接器并启动授权流程。</p>
          <CommandBlock
            command={INSTALL_COMMAND}
            testId="mcp-guide-install-command"
            copyLabel="复制 npx 安装命令"
            copied={copiedCommand === INSTALL_COMMAND}
            onCopy={onCopy}
          />
          <p className="text-slate-400">如果你的 Agent 有专门的 MCP 设置页，也可以把命令填写为 <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-cyan-200">npx @mapflow-publish/mcp</code>。</p>
        </div>
      );
    case 'first-auth':
      return (
        <div className="space-y-4">
          <ol className="space-y-3">
            <li className="flex gap-3"><StepDot>1</StepDot><span>浏览器会打开 MapFlow 授权页；如果尚未登录，先登录你的账号。</span></li>
            <li className="flex gap-3"><StepDot>2</StepDot><span>确认授权用途后点击“允许”。</span></li>
            <li className="flex gap-3"><StepDot>3</StepDot><span>授权令牌会保存在本机 <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-cyan-200">~/.mapflow/token</code>，之后启动通常会静默连接。</span></li>
          </ol>
          <p className="rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-3 text-sm leading-6 text-amber-100">授权只针对你自己的 MapFlow 账号。不要把本机 token 文件复制给别人，也不要把它提交到 Git 仓库。</p>
        </div>
      );
    case 'capabilities':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <CapabilityCard name="mapflow.get_progress" detail="查看所有技能树和完成进度。" />
          <CapabilityCard name="mapflow.get_tree" detail="读取一棵树的节点、边、块和完成情况。" />
          <CapabilityCard name="mapflow.apply_tree_mutation" detail="按你的指令添加或整理节点、边和块。" />
          <CapabilityCard name="mapflow.whoami" detail="查看当前连接的是哪个账号和授权状态。" />
        </div>
      );
    case 'read-progress':
      return (
        <div className="space-y-5">
          <p>让 Agent 先读取地图和进度，再提出下一步建议。这样它看到的是你的真实状态，而不是一份脱离上下文的通用计划。</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <CapabilityCard name="mapflow.get_progress" detail="查看所有个人地图的完成比例和当前进展。" />
            <CapabilityCard name="mapflow.get_tree" detail="读取某棵地图的节点、关系、块和节点状态。" />
          </div>
          <p className="text-slate-400">例如：告诉 Agent“我现在有哪些地图，哪张地图最近应该继续学习？”</p>
        </div>
      );
    case 'modify-map':
      return (
        <div className="space-y-5">
          <p>你可以让 Agent 按照你的学习目标整理个人地图：补充遗漏节点、修改标题和说明、调整节点关系，或者把一组节点整理成块。</p>
          <CapabilityCard name="mapflow.apply_tree_mutation" detail="对个人地图执行添加、修改、删除节点，以及调整边和块的操作。" />
          <InfoPanel title="建议先说明范围">
            写操作会改变你的个人地图。下达指令时，尽量说清楚目标地图、要修改的范围，以及是否允许删除或移动已有内容。
          </InfoPanel>
        </div>
      );
    case 'manage-progress':
      return (
        <div className="space-y-5">
          <p>本地 Agent 可以直接修改地图内容和节点进度。你可以把“完成哪些节点、哪些还不熟、下一步学什么”交给它协助维护。</p>
          <InfoPanel title="为什么推荐本地 Agent">
            它可以在你的电脑上持续读取个人地图，并根据你的学习记录更新节点状态。对于需要长期维护的学习路线，接入本地 Agent 会比手动逐个点击更省力。
          </InfoPanel>
          <div className="grid gap-3 sm:grid-cols-2">
            <CapabilityCard name="读取" detail="查看当前节点状态和整体进度。" />
            <CapabilityCard name="更新" detail="把已掌握、学习中或待复习的变化同步到个人地图。" />
          </div>
          <p className="text-slate-400">例如：告诉 Agent“把我刚学完的 TypeScript 泛型标记为已完成，并告诉我下一个前置节点”。</p>
        </div>
      );
    case 'claude-code':
      return (
        <div className="space-y-4">
          <p>如果你使用 Claude Code，可以直接把连接器注册到 Claude Code：</p>
          <CommandBlock
            command={CLAUDE_COMMAND}
            copyLabel="复制 Claude Code 配置命令"
            copied={copiedCommand === CLAUDE_COMMAND}
            onCopy={onCopy}
          />
          <p className="text-slate-500">配置完成后，你可以直接说“读一下我的学习进度”或“把安全相关的节点整理成块”。</p>
        </div>
      );
    case 'other-agents':
      return (
        <div className="space-y-4">
          <p>如果你的 Agent 提供通用的 MCP 配置项，填写下面两部分即可：</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ConfigValue label="command" value="npx" />
            <ConfigValue label="args" value="@mapflow-publish/mcp" />
          </div>
          <p className="text-slate-500">有些客户端会把它们写成“命令”和“参数”，本质上就是让客户端执行：<code className="ml-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-slate-300">npx @mapflow-publish/mcp</code>。</p>
        </div>
      );
    case 'tokens':
      return (
        <div className="space-y-4">
          <InfoPanel title="本机保存令牌">
            明文令牌只在授权时写入你的本机；服务器只保存摘要，不能从数据库反推出原令牌。令牌文件位于 <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-cyan-200">~/.mapflow/token</code>。
          </InfoPanel>
          <p>不要把 token 文件复制给别人，也不要把它提交到 Git 仓库。需要换账号时，删除本机 token 后重新运行连接命令即可。</p>
        </div>
      );
    case 'faq':
      return (
        <div className="space-y-4">
          <FaqItem question="npx 不是命令怎么办？">安装 Node.js 18 或更高版本后重新打开终端，再运行上面的命令。</FaqItem>
          <FaqItem question="想换账号怎么办？">删除本机的 <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-cyan-200">~/.mapflow/token</code> 后重新运行命令，就会重新授权。</FaqItem>
          <FaqItem question="写操作安全吗？">每次写入都会记录审计信息，包括哪棵树、什么操作和哪个授权令牌。</FaqItem>
        </div>
      );
    default:
      return null;
  }
}

function CommandBlock({
  command,
  testId,
  copyLabel,
  copied,
  onCopy,
}: {
  command: string;
  testId?: string;
  copyLabel: string;
  copied: boolean;
  onCopy: (command: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/70">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <span className="text-[10px] font-bold tracking-[0.16em] text-slate-500">TERMINAL</span>
        <button
          type="button"
          aria-label={copyLabel}
          onClick={() => onCopy(command)}
          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/10 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-sm leading-6 text-cyan-100"><code data-testid={testId}>{command}</code></pre>
    </div>
  );
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] p-4">
      <h4 className="text-sm font-bold text-cyan-100">{title}</h4>
      <p className="mt-2 text-sm leading-7 text-slate-300">{children}</p>
    </div>
  );
}

function ConfigValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="text-[10px] font-bold tracking-[0.14em] text-slate-500">{label}</div>
      <code className="mt-1 block break-all font-mono text-sm text-cyan-200">{value}</code>
    </div>
  );
}

function StepDot({ children }: { children: ReactNode }) {
  return (
    <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 font-mono text-[10px] font-bold text-cyan-200">
      {children}
    </span>
  );
}

function CapabilityCard({ name, detail }: { name: string; detail: string }) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <code className="break-all font-mono text-xs font-bold text-cyan-200">{name}</code>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </article>
  );
}

function FaqItem({ question, children }: { question: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <h4 className="font-bold text-slate-100">{question}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-400">{children}</p>
    </div>
  );
}
