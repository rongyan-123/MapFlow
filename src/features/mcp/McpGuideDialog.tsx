import { useEffect, useState } from 'react';

const INSTALL_COMMAND = 'npx @mapflow-publish/mcp';
const CLAUDE_COMMAND = 'claude mcp add mapflow -- npx @mapflow-publish/mcp';
const SKILL_INSTALL_COMMAND = 'npx skills add rongyan-123/MapFlow --skill mapflow-mcp --global';

interface McpGuideDialogProps {
  onClose: () => void;
}

export default function McpGuideDialog({ onClose }: McpGuideDialogProps) {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);

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

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/85 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-guide-dialog-title"
        aria-describedby="mcp-guide-dialog-description"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-cyan-200/20 bg-[#07111f] shadow-[0_30px_100px_-30px_rgba(34,211,238,0.45)]"
      >
        <header className="flex items-start justify-between gap-5 border-b border-white/10 px-5 py-5 sm:px-7">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-cyan-300">MAPFLOW / AGENT</p>
            <h2 id="mcp-guide-dialog-title" className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">
              在自己的 Agent 中连接 MapFlow
            </h2>
            <p id="mcp-guide-dialog-description" className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              先安装 Skill 让 Agent 理解 MapFlow，再配置 MCP 连接你的账号和技能树。
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭 Agent 接入教程"
            onClick={onClose}
            className="shrink-0 rounded-xl px-2.5 py-1 text-2xl leading-none text-slate-500 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-7 sm:px-7">
          <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] p-4 text-sm leading-7 text-cyan-50">
            <strong className="font-bold text-cyan-200">开始前准备：</strong> Node.js 18+、一个已注册的 MapFlow 账号，以及支持 MCP 的 Agent。你不需要下载或部署一个新的 MapFlow 服务。
          </div>

          <GuideSection number="01" title="它到底是什么？">
            <p>
              <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-cyan-200">@mapflow-publish/mcp</code>{' '}
              是 MapFlow 提供的连接器。它运行在你的电脑上，负责把 Agent 和 MapFlow 账号安全地连起来；你的学习数据仍然留在自己的账号里。
            </p>
          </GuideSection>

          <GuideSection number="02" title="先安装 MapFlow Skill">
            <p>
              Skill 负责告诉 Agent 如何理解 MapFlow 的树结构、节点、块，以及两种固定的布局方式。先安装 Skill，再配置 MCP，Agent 才能按 MapFlow 的规则工作。
            </p>
            <CommandBlock
              command={SKILL_INSTALL_COMMAND}
              testId="mapflow-skill-install-command"
              copyLabel="复制 Skill 安装命令"
              copied={copiedCommand === SKILL_INSTALL_COMMAND}
              onCopy={copyCommand}
            />
            <p className="mt-3 text-slate-500">
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-slate-300">--global</code> 会把 Skill 安装到当前电脑，供支持 Skills 的 Agent 使用；只想给当前项目使用时可以去掉它。
            </p>
          </GuideSection>

          <GuideSection number="03" title="再配置 MCP：一行 npx 命令">
            <p>在终端里运行下面这条命令。第一次运行时，npx 会下载连接器并启动授权流程。</p>
            <CommandBlock
              command={INSTALL_COMMAND}
              testId="mcp-guide-install-command"
              copyLabel="复制 npx 安装命令"
              copied={copiedCommand === INSTALL_COMMAND}
              onCopy={copyCommand}
            />
          </GuideSection>

          <GuideSection number="04" title="如果你使用 Claude Code">
            <p>可以直接把连接器注册到 Claude Code：</p>
            <CommandBlock
              command={CLAUDE_COMMAND}
              copyLabel="复制 Claude Code 配置命令"
              copied={copiedCommand === CLAUDE_COMMAND}
              onCopy={copyCommand}
            />
            <p className="mt-3 text-slate-500">
              配置完成后，你可以直接说“读一下我的学习进度”或“把安全相关的节点整理成块”。
            </p>
          </GuideSection>

          <GuideSection number="05" title="其他支持 MCP 的 Agent 怎么配？">
            <p>如果你的 Agent 提供通用的 MCP 配置项，填写下面两部分即可：</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ConfigValue label="command" value="npx" />
              <ConfigValue label="args" value="@mapflow-publish/mcp" />
            </div>
            <p className="mt-3 text-slate-500">
              有些客户端会把它们写成“命令”和“参数”，本质上就是让客户端执行：
              <code className="ml-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-slate-300">npx @mapflow-publish/mcp</code>。
            </p>
          </GuideSection>

          <GuideSection number="06" title="第一次运行会发生什么？">
            <ol className="space-y-3 text-slate-300">
              <li className="flex gap-3"><StepDot>1</StepDot><span>浏览器会打开 MapFlow 授权页；如果尚未登录，先登录你的账号。</span></li>
              <li className="flex gap-3"><StepDot>2</StepDot><span>确认授权用途后点击“允许”。</span></li>
              <li className="flex gap-3"><StepDot>3</StepDot><span>授权令牌会保存在本机 <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-cyan-200">~/.mapflow/token</code>，之后启动通常会静默连接。</span></li>
            </ol>
            <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-3 text-sm leading-6 text-amber-100">
              授权只针对你自己的 MapFlow 账号。不要把本机 token 文件复制给别人，也不要把它提交到 Git 仓库。
            </p>
          </GuideSection>

          <GuideSection number="07" title="连接以后，Agent 能做什么？">
            <div className="grid gap-3 sm:grid-cols-2">
              <CapabilityCard name="mapflow.get_progress" detail="查看所有技能树和完成进度。" />
              <CapabilityCard name="mapflow.get_tree" detail="读取一棵树的节点、边、块和完成情况。" />
              <CapabilityCard name="mapflow.apply_tree_mutation" detail="按你的指令添加或整理节点、边和块。" />
              <CapabilityCard name="mapflow.whoami" detail="查看当前连接的是哪个账号和授权状态。" />
            </div>
          </GuideSection>

          <GuideSection number="08" title="安全和常见问题">
            <div className="space-y-3 text-sm leading-7 text-slate-300">
              <p><strong className="text-slate-100">令牌放在哪里？</strong> 明文令牌只在授权时写入你的本机；服务器只保存摘要，不能从数据库反推出原令牌。</p>
              <p><strong className="text-slate-100">写操作安全吗？</strong> 每次写入都会记录审计信息，包括哪棵树、什么操作和哪个授权令牌。</p>
              <p><strong className="text-slate-100">npx 不是命令怎么办？</strong> 安装 Node.js 18 或更高版本后重新打开终端，再运行上面的命令。</p>
              <p><strong className="text-slate-100">想换账号怎么办？</strong> 删除本机的 <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-cyan-200">~/.mapflow/token</code> 后重新运行命令，就会重新授权。</p>
            </div>
          </GuideSection>

          {copyError && (
            <p role="alert" className="mt-5 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-3 text-sm text-rose-100">
              当前浏览器不允许自动复制，请手动选中命令复制。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function GuideSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-white/10 py-6 last:border-b-0" aria-labelledby={`mcp-guide-section-${number}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 font-mono text-[11px] font-bold text-cyan-200">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`mcp-guide-section-${number}`} className="text-base font-bold text-white sm:text-lg">
            {title}
          </h3>
          <div className="mt-3 text-sm leading-7 text-slate-300">{children}</div>
        </div>
      </div>
    </section>
  );
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
    <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-slate-950/70">
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

function ConfigValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="text-[10px] font-bold tracking-[0.14em] text-slate-500">{label}</div>
      <code className="mt-1 block break-all font-mono text-sm text-cyan-200">{value}</code>
    </div>
  );
}

function StepDot({ children }: { children: React.ReactNode }) {
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
