import { useState } from 'react';
import type { Navigate } from '../app/useLocation';
import { learningGuide } from '../domains/support/agentGuide';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import { NotificationsDialog } from '../ui/support/NotificationsDialog';
import { FeedbackDialog } from '../ui/support/FeedbackDialog';
import AgentGuideDialog from '../ui/support/AgentGuideDialog';

export default function SupportPage({ page, accountId, csrfToken, navigate, initialFeedbackId }: {
  page: 'help' | 'messages'; accountId: string; csrfToken: string; navigate: Navigate; initialFeedbackId?: string;
}) {
  const [section, setSection] = useState(new URLSearchParams(window.location.search).has('feedback') ? 'feedback' : 'start');
  const [agentOpen, setAgentOpen] = useState(false);
  const [step, setStep] = useState(0);
  const title = page === 'messages' ? '消息' : '帮助与反馈';
  const guide = learningGuide[step];
  return <><PageHeader title={title} /><div className="mf-content"><main className="mf-page">
    <div className="mf-page-heading"><div><h2>{title}</h2><p>{page === 'messages' ? '公告、反馈回复和与你有关的动态。' : '查看使用说明，或告诉我们遇到的问题。'}</p></div></div>
    {page === 'messages' ? <NotificationsDialog embedded accountId={accountId} csrfToken={csrfToken} onClose={() => navigate('/assistant')} onFeedback={id => navigate(`/help${id ? `?feedback=${encodeURIComponent(id)}` : '?feedback='}`)} /> :
      <div className="mf-help-layout"><nav aria-label="帮助目录" className="mf-help-directory">
        {learningGuide.map((item, index) => <Button key={item.title} variant="quiet" aria-pressed={section === 'start' && step === index} onClick={() => { setSection('start'); setStep(index); }}>{item.title}</Button>)}
        <Button variant="quiet" onClick={() => setAgentOpen(true)}>Skill / MCP 接入</Button>
        <Button variant="quiet" aria-pressed={section === 'feedback'} onClick={() => setSection('feedback')}>提交与查看反馈</Button>
      </nav><section className="mf-card">
        {section === 'feedback' ? <FeedbackDialog embedded key={initialFeedbackId ?? 'feedback'} initialFeedbackId={initialFeedbackId} accountId={accountId} csrfToken={csrfToken} onClose={() => setSection('start')} /> : <div className="mf-stack"><h2>{guide.title}</h2><p>{guide.description}</p><div><Button variant="primary" onClick={() => navigate(guide.path)}>{guide.action}</Button></div><a href="/guides/getting-started">阅读完整使用教程</a></div>}
      </section></div>}
  </main></div>{agentOpen && <AgentGuideDialog onClose={() => setAgentOpen(false)} />}</>;
}
