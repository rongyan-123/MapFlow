import { useEffect, useRef, useState } from 'react';
import {
  MAPFLOW_PROJECT_TASK,
  MAPFLOW_SKILL_SOURCE,
  MCP_VERIFICATION_COMMANDS,
  getMcpClientConfig,
  getSkillInstallCommand,
} from './mcpConfig';
import type { OnboardingAgentClient } from '../learning-entry/onboardingState';

interface McpGuideDialogProps {
  onClose: () => void;
}

const clients: Array<{ id: OnboardingAgentClient; label: string }> = [
  { id: 'codex', label: 'Codex' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'other', label: '其他 MCP Agent' },
];

export default function McpGuideDialog({ onClose }: McpGuideDialogProps) {
  const [client, setClient] = useState<OnboardingAgentClient>('codex');
  const [step, setStep] = useState(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const config = getMcpClientConfig(client);
  const steps = ['选择客户端', '注册 MCP', '授权验证', '开始使用'];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/25 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-guide-dialog-title"
        aria-describedby="mcp-guide-dialog-description"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-[#f7fbf9] text-slate-900 shadow-[0_30px_100px_-30px_rgba(15,118,110,0.22)]"
      >
        <header className="flex items-start justify-between gap-5 border-b border-slate-200 px-5 py-5 sm:px-7">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-teal-700">MAPFLOW / AGENT</p>
            <h2 id="mcp-guide-dialog-title" className="mt-2 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
              在自己的 Agent 中连接 MapFlow
            </h2>
            <p id="mcp-guide-dialog-description" className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              选择客户端，完成一次本机授权，再让 Agent 读取你的学习进度。
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭 Agent 接入教程"
            onClick={onClose}
            className="shrink-0 rounded-xl px-2.5 py-1 text-2xl leading-none text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-7 sm:px-7">
          <ol className="grid grid-cols-4 gap-2 border-b border-slate-200 py-5" aria-label="Agent 接入步骤">
            {steps.map((label, index) => (
              <li
                key={label}
                className={`flex min-w-0 items-center gap-2 text-xs ${index <= step ? 'text-teal-800' : 'text-slate-500'}`}
              >
                <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] font-bold ${index <= step ? 'border-teal-300 bg-teal-100' : 'border-slate-300'}`}>
                  {index + 1}
                </span>
                <span className="truncate">{label}</span>
              </li>
            ))}
          </ol>

          {step === 0 && (
            <section className="py-6" aria-labelledby="mcp-guide-client-title">
              <p className="text-[11px] font-bold tracking-[0.16em] text-teal-700">第 1 步</p>
              <h3 id="mcp-guide-client-title" className="mt-2 text-lg font-bold text-slate-950">选择你正在使用的客户端</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Codex 和 Claude Code 会显示各自的注册命令，其他客户端使用通用配置。</p>
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {clients.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={client === item.id}
                    onClick={() => setClient(item.id)}
                    className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${client === item.id ? 'border-teal-400 bg-teal-100 text-teal-900' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-800'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm leading-7 text-teal-900">
                <strong className="font-bold text-teal-800">Node.js 18+：</strong>先准备好本机 Node.js，下一步会把 MCP 注册到你选中的客户端。
              </div>
              <div className="mt-5 flex justify-end">
                <button type="button" onClick={() => setStep(1)} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800">
                  下一步
                  <span aria-hidden="true"> →</span>
                </button>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="py-6" aria-labelledby="mcp-guide-config-title">
              <p className="text-[11px] font-bold tracking-[0.16em] text-teal-700">第 2 步</p>
              <h3 id="mcp-guide-config-title" className="mt-2 text-lg font-bold text-slate-950">在 {config.label} 中注册 MCP</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">执行注册命令后，客户端会知道如何启动 MapFlow 连接器。</p>
              {config.registrationCommand ? (
                <CommandBlock
                  command={config.registrationCommand}
                  testId="mcp-guide-install-command"
                  copyLabel={`复制 ${config.label} 注册命令`}
                />
              ) : (
                <>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <ConfigValue label="command" value={config.command} />
                    <ConfigValue label="args" value={config.args.join(' ')} />
                  </div>
                  <CommandBlock
                    command={`${config.command} ${config.args.join(' ')}`}
                    copyLabel="复制通用 MCP 配置"
                  />
                </>
              )}
              <p className="mt-4 text-xs leading-5 text-slate-500">单独运行 npx 只会启动连接器；请在客户端完成注册。</p>
              <NavigationButtons onBack={() => setStep(0)} onNext={() => setStep(2)} />
            </section>
          )}

          {step === 2 && (
            <section className="py-6" aria-labelledby="mcp-guide-auth-title">
              <p className="text-[11px] font-bold tracking-[0.16em] text-teal-700">第 3 步</p>
              <h3 id="mcp-guide-auth-title" className="mt-2 text-lg font-bold text-slate-950">授权并确认连接账号</h3>
              <ol className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
                <li className="flex gap-3"><StepDot>1</StepDot><span>首次运行时，浏览器会打开 MapFlow 授权页；如果尚未登录，先登录你的账号。</span></li>
                <li className="flex gap-3"><StepDot>2</StepDot><span>确认授权用途后，在页面中允许连接。</span></li>
                <li className="flex gap-3"><StepDot>3</StepDot><span>让 Agent 调用 <code className="rounded bg-teal-50 px-1.5 py-0.5 font-mono text-teal-800">mapflow.whoami</code> 和 <code className="rounded bg-teal-50 px-1.5 py-0.5 font-mono text-teal-800">mapflow.get_progress</code>，确认账号与进度属于你。</span></li>
              </ol>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {MCP_VERIFICATION_COMMANDS.map((command) => (
                  <code key={command} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs text-teal-800">mapflow.{command}</code>
                ))}
              </div>
              <NavigationButtons onBack={() => setStep(1)} onNext={() => setStep(3)} />
            </section>
          )}

          {step === 3 && (
            <section className="py-6" aria-labelledby="mcp-guide-start-title">
              <p className="text-[11px] font-bold tracking-[0.16em] text-teal-700">第 4 步</p>
              <h3 id="mcp-guide-start-title" className="mt-2 text-lg font-bold text-slate-950">安装 Skill，从当前项目建立地图</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">MCP 负责连接账号，Skill 负责把项目整理成学习地图。下面是已核实的 GitHub Skill 来源。</p>
              <div
                data-testid="mcp-guide-video-placeholder"
                role="img"
                aria-label="Agent 接入视频教程占位"
                className="mt-5 flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-100 px-4 text-center text-sm text-slate-500"
              >
                <span><strong className="font-semibold text-slate-700">视频教程即将上线</strong><br />当前为占位内容，暂不可播放。</span>
              </div>
              <CommandBlock
                command={getSkillInstallCommand(client)}
                copyLabel="复制 Skill 安装命令"
              />
              <p className="mt-3 text-xs leading-5 text-slate-500">
                <a href={MAPFLOW_SKILL_SOURCE} target="_blank" rel="noreferrer" className="text-teal-800 underline underline-offset-2">查看已核实的 GitHub Skill 来源</a>。安装 Skill 只准备本地工作流，下一步仍需让 Agent 生成并确认地图。
              </p>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">给 Agent 的建图任务</p>
              <CommandBlock
                command={MAPFLOW_PROJECT_TASK}
                copyLabel="复制建图任务"
              />
              <p className="mt-3 text-xs leading-5 text-slate-500">当前预览环境的服务端创建入口仍在部署验证；安装 Skill 不会自动创建地图，实际创建以服务端版本为准。</p>
              <div className="flex justify-between gap-3 pt-5">
                <button type="button" onClick={() => setStep(2)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-400 hover:text-teal-800">上一步</button>
                <button type="button" onClick={onClose} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800">完成</button>
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

function NavigationButtons({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex justify-between gap-3 pt-6">
      <button type="button" onClick={onBack} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-400 hover:text-teal-800">上一步</button>
      <button type="button" onClick={onNext} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800">下一步<span aria-hidden="true"> →</span></button>
    </div>
  );
}

function CommandBlock({
  command,
  testId,
  copyLabel,
}: {
  command: string;
  testId?: string;
  copyLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  async function copyCommand() {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopied(false);
      setCopyError(true);
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
    }
  }

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
        <span className="text-[10px] font-bold tracking-[0.16em] text-slate-500">TERMINAL</span>
        <button type="button" aria-label={copyLabel} onClick={() => void copyCommand()} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-teal-800 transition hover:bg-teal-100 hover:text-teal-900">
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <textarea
        ref={fallbackRef}
        aria-label="命令文本，可手动复制"
        readOnly
        value={command}
        rows={2}
        data-testid={testId}
        onFocus={(event) => event.currentTarget.select()}
        className="w-full resize-none bg-transparent px-4 py-3 font-mono text-sm leading-6 text-slate-800 outline-none"
      />
      {copyError && <p role="alert" className="border-t border-rose-200 px-4 py-2 text-xs text-rose-700">当前浏览器不允许自动复制，命令已选中，请按 Ctrl/Cmd+C。</p>}
    </div>
  );
}

function ConfigValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[10px] font-bold tracking-[0.14em] text-slate-500">{label}</div>
      <code className="mt-1 block break-all font-mono text-sm text-teal-800">{value}</code>
    </div>
  );
}

function StepDot({ children }: { children: React.ReactNode }) {
  return <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 font-mono text-[10px] font-bold text-teal-800">{children}</span>;
}
