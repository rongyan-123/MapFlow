import { useState } from 'react';
import type { IdentitySession } from '../identity/types';
import McpGuideDialog from '../mcp/McpGuideDialog';
import LandingEarthBackground from './LandingEarthBackground';
import LandingStory from './LandingStory';

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
  const [mcpGuideOpen, setMcpGuideOpen] = useState(false);
  const [earthRevealProgress, setEarthRevealProgress] = useState(0);

  return (
    <div
      data-testid="product-landing"
      className="mapflow-landing"
    >
      <LandingEarthBackground revealProgress={earthRevealProgress} />
      <div
        className="mapflow-landing__veil"
        style={{ opacity: 1 - earthRevealProgress * 0.22 }}
        aria-hidden="true"
      />

      <header className="mapflow-landing__header">
        <div className="mapflow-landing__header-inner">
          <a
            href="/?marketing=1"
            className="mapflow-landing__brand"
            aria-label="MapFlow 产品首页"
          >
            <span className="mapflow-landing__brand-mark" aria-hidden="true">
              <span />
              M
            </span>
            <span>MAPFLOW</span>
          </a>

          <nav className="mapflow-landing__nav" aria-label="产品导航">
            <button
              type="button"
              className="mapflow-landing__agent"
              aria-label="如何在自己的 Agent 里连接 MapFlow"
              onClick={() => setMcpGuideOpen(true)}
            >
              Agent 接入
            </button>
          </nav>

          <div className="mapflow-landing__actions">
            <button
              type="button"
              className="mapflow-landing__login"
              onClick={session ? onEnterConsole : onLogin}
            >
              {session ? '继续我的学习' : '登录'}
            </button>
            <button
              type="button"
              className="mapflow-landing__enter"
              onClick={onEnterConsole}
            >
              进入工作台
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        <LandingStory
          onEnterConsole={onEnterConsole}
          onEarthRevealProgress={setEarthRevealProgress}
        />
      </main>

      {mcpGuideOpen && <McpGuideDialog onClose={() => setMcpGuideOpen(false)} />}
    </div>
  );
}
