import { useState } from 'react';
import AccountsTab from './AccountsTab';
import AnnouncementsTab from './AnnouncementsTab';
import AuditLogTab from './AuditLogTab';
import FeedbackTab from './FeedbackTab';
import InvitationsTab from './InvitationsTab';
import OverviewTab from './OverviewTab';
import RequestObservationsTab from './RequestObservationsTab';

export interface AdminPanelProps {
  onBack: () => void;
  csrfToken: string;
}

type AdminTab =
  | 'overview'
  | 'accounts'
  | 'invitations'
  | 'audit'
  | 'requests'
  | 'feedback'
  | 'announcements';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'overview', label: '概览' },
  { id: 'accounts', label: '用户' },
  { id: 'invitations', label: '邀请码' },
  { id: 'audit', label: '审计日志' },
  { id: 'requests', label: '请求观测' },
  { id: 'feedback', label: '反馈' },
  { id: 'announcements', label: '公告' },
];

export default function AdminPanel({ onBack, csrfToken }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950 text-slate-100">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-2.5 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
        >
          返回
        </button>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
            MapFlow Admin
          </p>
          <h1 className="truncate text-base font-bold tracking-tight">管理面板</h1>
        </div>
        <nav
          role="tablist"
          aria-label="管理面板分区"
          className="ml-auto flex max-w-full shrink-0 items-center gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 p-1 text-xs"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-cyan-300 text-slate-950'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {activeTab === 'overview' && <OverviewTab csrfToken={csrfToken} />}
        {activeTab === 'accounts' && <AccountsTab csrfToken={csrfToken} />}
        {activeTab === 'invitations' && <InvitationsTab csrfToken={csrfToken} />}
        {activeTab === 'audit' && <AuditLogTab csrfToken={csrfToken} />}
        {activeTab === 'requests' && (
          <RequestObservationsTab csrfToken={csrfToken} />
        )}
        {activeTab === 'feedback' && <FeedbackTab csrfToken={csrfToken} />}
        {activeTab === 'announcements' && <AnnouncementsTab csrfToken={csrfToken} />}
      </main>
    </div>
  );
}
