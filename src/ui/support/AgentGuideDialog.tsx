import { useEffect, useId, useRef, useState } from 'react';
import { agentGuide } from '../../domains/support/agentGuide';
import useIsMobile from '../../lib/useIsMobile';
import { Dialog } from '../Dialog';
import { Button } from '../Button';
import { Icon } from '../Icon';

const groups = [...new Set(agentGuide.map(item => item.group))];

export default function AgentGuideDialog({ onClose, initialSectionId = 'quick-start' }: { onClose: () => void; initialSectionId?: string }) {
  const isMobile = useIsMobile();
  const directoryId = useId();
  const article = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState(initialSectionId);
  const [copied, setCopied] = useState('');
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const section = agentGuide.find(item => item.id === selected) ?? agentGuide[3];
  const nextSection = agentGuide[agentGuide.indexOf(section) + 1];

  useEffect(() => {
    if (!isMobile) setDirectoryOpen(false);
  }, [isMobile]);

  const selectSection = (id: string) => {
    setSelected(id);
    setCopied('');
    setDirectoryOpen(false);
    const content = article.current?.closest('.mf-dialog-content');
    if (content) content.scrollTop = 0;
  };

  const directory = <nav id={directoryId} className="mf-guide-directory" aria-label="接入教程目录">
    {groups.map((group, index) => <section key={group} data-testid={`mcp-guide-group-${['understand', 'connect', 'manage', 'account'][index]}`}>
      <h3>{group}</h3>
      {agentGuide.filter(item => item.group === group).map(item => <button
        type="button"
        key={item.id}
        aria-current={item.id === section.id ? 'page' : undefined}
        onClick={() => selectSection(item.id)}
      >{item.title}</button>)}
    </section>)}
  </nav>;

  return <Dialog
    title="Agent 接入教程"
    layout="workspace"
    className="mf-agent-guide"
    onClose={onClose}
    headerLeading={isMobile && <Button
      className="mf-guide-menu-toggle"
      aria-label="打开教程目录"
      aria-expanded={directoryOpen}
      aria-controls={directoryOpen ? directoryId : undefined}
      onClick={() => setDirectoryOpen(true)}
    ><Icon name="menu" />目录</Button>}
  >
    <div className="mf-guide-layout">
      {!isMobile && directory}
      <article ref={article} className="mf-stack">
        <p className="mf-eyebrow">{section.group}</p>
        <h2>{section.title}</h2>
        {section.paragraphs.map(paragraph => <p key={paragraph} className="mf-small">{paragraph}</p>)}
        {section.command && <div className="mf-command">
          <code>{section.command}</code>
          <Button onClick={() => void navigator.clipboard.writeText(section.command!).then(() => setCopied('命令已复制')).catch(() => setCopied('请选中命令手动复制'))}>复制命令</Button>
          {copied && <span role="status">{copied}</span>}
        </div>}
        {nextSection ? <Button variant="primary" className="mf-guide-next" onClick={() => selectSection(nextSection.id)}>
          <span>下一节：{nextSection.title}</span><Icon name="right" />
        </Button> : <p role="status" className="mf-small mf-muted">已读到最后一节</p>}
      </article>
    </div>
    {isMobile && directoryOpen && <Dialog title="教程目录" layout="drawer" className="mf-guide-drawer" onClose={() => setDirectoryOpen(false)}>
      {directory}
    </Dialog>}
  </Dialog>;
}
