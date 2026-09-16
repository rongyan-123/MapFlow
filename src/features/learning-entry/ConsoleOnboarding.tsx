import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { ConsoleOnboardingState, WebsiteOnboardingStep } from './onboardingState';

export interface ConsoleOnboardingProps {
  state: ConsoleOnboardingState;
  onChange: (patch: Partial<ConsoleOnboardingState>) => void;
  onSkip: () => void;
  onReopen: () => void;
  onOpenAgentGuide: () => void;
  paused?: boolean;
}

interface ViewportRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export const WEBSITE_ONBOARDING_STEPS: readonly WebsiteOnboardingStep[] = [
  'generate-map',
  'public-library',
  'personal-library',
  'map-canvas',
  'map-node',
  'chat',
  'progress',
];

const WEBSITE_STEP_COPY: Record<
  WebsiteOnboardingStep,
  { label: string; title: string; detail: ReactNode; missingTarget: string }
> = {
  'generate-map': {
    label: '生成学习地图',
    title: '先生成一张属于你的学习地图',
    detail: '输入一个想学的主题，MapFlow 会帮你整理出一条可探索的学习路线。',
    missingTarget: '打开“更多”菜单，就能找到创建自己的地图。',
  },
  'public-library': {
    label: '公共地图',
    title: '从左侧公共地图选一个方向',
    detail: '这里汇集了可以直接浏览的学习地图，先挑一个你感兴趣的方向。',
    missingTarget: '回到探索页，就能看到公共地图列表。',
  },
  'personal-library': {
    label: '我的地图',
    title: '在我的地图里保留你的进度',
    detail: '加入后的地图会出现在这里，节点完成情况只跟随当前账号保存。',
    missingTarget: '登录后打开“我的学习”，就能看到你的地图。',
  },
  'map-canvas': {
    label: '地图画布',
    title: '拖动地图、缩放视图',
    detail: '进入任意地图后，用拖动和缩放找到你想先了解的区域。',
    missingTarget: '打开任意地图后，这个提示会跟随画布定位。',
  },
  'map-node': {
    label: '地图节点',
    title: '点一个节点看详情',
    detail: '选择一个真实节点，就能查看它的说明、前后关系和下一步建议。',
    missingTarget: '打开一张有内容的地图，再点选其中一个节点。',
  },
  chat: {
    label: '聊天提问',
    title: '在聊天里提问',
    detail: '从节点详情打开聊天，输入问题后再点击发送，按你的节奏继续追问。',
    missingTarget: '先点开一个节点，再从详情面板打开聊天。',
  },
  progress: {
    label: '记录进度',
    title: '记录你的学习进度',
    detail: '理解一个节点后，在个人地图的详情面板里按你的理解标记完成。',
    missingTarget: '进入个人地图并点开一个节点，再向下滚动详情面板找到“标记为已完成”。',
  },
};

const PUBLIC_CHAT_COPY: Pick<
  (typeof WEBSITE_STEP_COPY)['chat'],
  'label' | 'title' | 'detail' | 'missingTarget'
> = {
  label: '聊天提问',
  title: '先把地图加入我的学习',
  detail: '公共地图先点击“加入我的学习”；登录后回到我的地图，再从节点详情打开聊天。完成后这里会继续提示输入和发送。',
  missingTarget: '点击“加入我的学习”或“登录并加入我的学习”，登录后回到我的地图。',
};

const TARGET_SELECTORS: Record<WebsiteOnboardingStep, readonly string[]> = {
  'generate-map': [
    '[data-mapflow-onboarding-target="generate-map"]',
    '[data-testid="top-generate-tree"]',
  ],
  'public-library': [
    '[data-mapflow-onboarding-target="public-sidebar"]',
    '[data-mapflow-onboarding-target="public-nav"]',
  ],
  'personal-library': [
    '[data-mapflow-onboarding-target="personal-sidebar"]',
    '[data-mapflow-onboarding-target="personal-nav"]',
  ],
  'map-canvas': [
    '[data-mapflow-onboarding-target="map-surface"]',
    '[data-mapflow-onboarding-target="map-entry"]',
  ],
  'map-node': ['[data-mapflow-onboarding-target="node"]'],
  chat: [
    '[data-mapflow-onboarding-target="chat-entry"]',
    '[data-mapflow-onboarding-target="chat-compose"]',
    '[data-mapflow-onboarding-target="chat-input"]',
    '[data-mapflow-onboarding-target="chat-send"]',
  ],
  progress: ['[data-mapflow-onboarding-target="progress"]'],
};

function getViewportSize() {
  return {
    width: Math.max(0, document.documentElement.clientWidth || window.innerWidth),
    height: Math.max(0, document.documentElement.clientHeight || window.innerHeight),
  };
}

function sameRect(previous: ViewportRect | null, next: ViewportRect | null) {
  if (previous === next) return true;
  if (!previous || !next) return false;
  return (
    previous.top === next.top &&
    previous.right === next.right &&
    previous.bottom === next.bottom &&
    previous.left === next.left &&
    previous.width === next.width &&
    previous.height === next.height
  );
}

function readChatContext() {
  if (typeof document === 'undefined') {
    return { hasChatEntry: false, hasPublicJoinAction: false };
  }

  return {
    hasChatEntry: Boolean(document.querySelector('[data-mapflow-onboarding-target="chat-entry"]')),
    hasPublicJoinAction: Boolean(
      document.querySelector('[data-mapflow-onboarding-target="join-personal"]'),
    ),
  };
}

function isLargeTargetRect(targetRect: ViewportRect | null) {
  if (!targetRect) return false;
  const viewport = getViewportSize();
  return targetRect.width >= viewport.width * 0.5 && targetRect.height >= viewport.height * 0.5;
}

function isTargetActionable(element: HTMLElement, rect: DOMRect) {
  if (typeof document.elementFromPoint !== 'function') return true;

  const points = [
    [rect.left + 2, rect.top + 2],
    [rect.right - 2, rect.top + 2],
    [rect.left + 2, rect.bottom - 2],
    [rect.right - 2, rect.bottom - 2],
    [rect.left + rect.width / 2, rect.top + rect.height / 2],
  ];

  return points.every(([x, y]) => {
    const hit = document.elementFromPoint(x, y);
    if (!hit) return true;
    if (element.contains(hit)) return true;
    return Boolean(hit.closest('.mapflow-onboarding__layer'));
  });
}

export default function ConsoleOnboarding({
  state,
  onChange,
  onSkip,
  onReopen,
  onOpenAgentGuide,
  paused = false,
}: ConsoleOnboardingProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [targetRect, setTargetRect] = useState<ViewportRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({});
  const [waitingCollapsed, setWaitingCollapsed] = useState(false);
  const [chatContext, setChatContext] = useState(readChatContext);
  const activeTour = !paused && !state.dismissed && state.path !== 'agent';
  const websiteStep = state.websiteStep;
  const stepIndex = WEBSITE_ONBOARDING_STEPS.indexOf(websiteStep);
  const copy =
    websiteStep === 'chat' && chatContext.hasPublicJoinAction && !chatContext.hasChatEntry
      ? PUBLIC_CHAT_COPY
      : WEBSITE_STEP_COPY[websiteStep];
  const requiresVisibleTarget = websiteStep === 'map-node' || websiteStep === 'chat' || websiteStep === 'progress';
  const shouldTrapFocus = activeTour && (state.path === null || Boolean(targetRect));

  const findTargetElement = useCallback((): HTMLElement | null => {
    if (!activeTour || state.path !== 'website') return null;
    for (const selector of TARGET_SELECTORS[websiteStep]) {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element || element.hasAttribute('disabled') || element.getClientRects().length === 0) continue;
      const rect = element.getBoundingClientRect();
      const computed = window.getComputedStyle(element);
      if (rect.width > 0 && rect.height > 0 && computed.display !== 'none' && computed.visibility !== 'hidden') {
        return element;
      }
    }
    return null;
  }, [activeTour, state.path, websiteStep]);

  const findTargetRect = useCallback((): ViewportRect | null => {
    if (!activeTour || state.path !== 'website') return null;

    const viewport = getViewportSize();
    for (const selector of TARGET_SELECTORS[websiteStep]) {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element || element.getClientRects().length === 0) continue;
      const rect = element.getBoundingClientRect();
      const computed = window.getComputedStyle(element);
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        computed.display === 'none' ||
        computed.visibility === 'hidden'
      ) {
        continue;
      }

      // Use the viewport intersection for both position and dimensions. An
      // element entirely outside the viewport must never create a fake hole.
      const left = Math.max(0, rect.left);
      const right = Math.min(viewport.width, rect.right);
      const top = Math.max(0, rect.top);
      const bottom = Math.min(viewport.height, rect.bottom);
      const width = right - left;
      const height = bottom - top;
      if (width <= 0 || height <= 0) continue;
      if (
        requiresVisibleTarget &&
        (rect.left < 0 ||
          rect.right > viewport.width ||
          rect.top < 0 ||
          rect.bottom > viewport.height)
      ) {
        continue;
      }
      if (!isTargetActionable(element, rect)) continue;

      return { top, right, bottom, left, width, height };
    }

    return null;
  }, [activeTour, state.path, websiteStep]);

  useEffect(() => {
    setWaitingCollapsed(false);
  }, [state.path, websiteStep]);

  useEffect(() => {
    if (!activeTour) {
      setTargetRect(null);
      return;
    }

    if (!previousFocusRef.current && document.activeElement instanceof HTMLElement) {
      previousFocusRef.current = document.activeElement;
    }

    let animationFrame = 0;
    let retryCount = 0;
    const measure = () => {
      const next = findTargetRect();
      setTargetRect((previous) => (sameRect(previous, next) ? previous : next));
      const nextChatContext = readChatContext();
      setChatContext((previous) =>
        previous.hasChatEntry === nextChatContext.hasChatEntry &&
        previous.hasPublicJoinAction === nextChatContext.hasPublicJoinAction
          ? previous
          : nextChatContext,
      );
      if (!next && retryCount < 12) {
        retryCount += 1;
        animationFrame = window.requestAnimationFrame(measure);
      }
    };
    const scheduleMeasure = () => {
      retryCount = 0;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(measure);
    };
    const viewportChange = () => scheduleMeasure();
    const mutationObserver = new MutationObserver(scheduleMeasure);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(document.documentElement);
    window.addEventListener('resize', viewportChange);
    window.addEventListener('scroll', viewportChange, true);
    window.addEventListener('popstate', viewportChange);
    measure();

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', viewportChange);
      window.removeEventListener('scroll', viewportChange, true);
      window.removeEventListener('popstate', viewportChange);
    };
  }, [activeTour, findTargetRect]);

  useLayoutEffect(() => {
    if (!activeTour) {
      if (!paused) {
        previousFocusRef.current?.focus();
        previousFocusRef.current = null;
      }
      return;
    }

    if (!shouldTrapFocus) return;

    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) {
      const firstButton = dialog.querySelector<HTMLButtonElement>('button:not([disabled])');
      firstButton?.focus();
    }

    const tooltip = dialogRef.current;
    if (!tooltip) return;
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 12;
    const gap = 14;
    const viewport = getViewportSize();
    const maxLeft = Math.max(margin, viewport.width - tooltipRect.width - margin);
    const largeTarget = isLargeTargetRect(targetRect);
    const preferredLeft = targetRect
      ? largeTarget
        ? targetRect.left + 16
        : targetRect.left + (targetRect.width - tooltipRect.width) / 2
      : (viewport.width - tooltipRect.width) / 2;
    const left = Math.min(Math.max(margin, preferredLeft), maxLeft);
    const fitsBelow = Boolean(
      targetRect && targetRect.bottom + gap + tooltipRect.height <= viewport.height - margin,
    );
    const fitsAbove = Boolean(
      targetRect && targetRect.top - gap - tooltipRect.height >= margin,
    );
    let top = targetRect
      ? largeTarget
        ? targetRect.top + 16
        : fitsBelow
        ? targetRect.bottom + gap
        : fitsAbove
        ? targetRect.top - tooltipRect.height - gap
        : Math.max(margin, (viewport.height - tooltipRect.height) / 2)
      : Math.max(margin, (viewport.height - tooltipRect.height) / 2);
    top = Math.min(Math.max(margin, top), Math.max(margin, viewport.height - tooltipRect.height - margin));
    setTooltipStyle({ left: `${Math.round(left)}px`, top: `${Math.round(top)}px` });
  }, [activeTour, shouldTrapFocus, state.path, targetRect, websiteStep]);

  useEffect(() => {
    if (!activeTour) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onSkip();
        return;
      }
      if (event.key !== 'Tab' || !shouldTrapFocus) return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'),
      );
      const target = targetRect ? findTargetElement() : null;
      if (target) {
        const targetFocusable = target.matches('button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])')
          ? [target]
          : Array.from(target.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        for (const element of targetFocusable) {
          if (!focusable.includes(element)) focusable.push(element);
        }
      }
      if (focusable.length === 0) return;
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? currentIndex <= 0
          ? focusable.length - 1
          : currentIndex - 1
        : (currentIndex + 1) % focusable.length;
      event.preventDefault();
      focusable[nextIndex]?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTour, findTargetElement, onSkip, shouldTrapFocus, targetRect]);

  if (paused) return null;

  if (state.dismissed) {
    return (
      <button type="button" onClick={onReopen} className="mapflow-onboarding__reopen">
        重新打开新手引导
      </button>
    );
  }

  if (state.path === 'agent') {
    return (
      <section className="mapflow-onboarding mapflow-onboarding--agent-resume" aria-label="Agent 接入路径">
        <div>
          <p className="mapflow-onboarding__eyebrow">Agent 路径</p>
          <p className="mapflow-onboarding__resume-copy">教程已准备好，按需完成本地连接。</p>
        </div>
        <div className="mapflow-onboarding__resume-actions">
          <button type="button" onClick={onOpenAgentGuide} className="mapflow-onboarding__resume-primary">
            打开 Agent 接入教程
          </button>
          <button
            type="button"
            onClick={() => onChange({ path: 'website', websiteStep: 'generate-map' })}
            className="mapflow-onboarding__text-button"
          >
            切换到网站开始
          </button>
        </div>
      </section>
    );
  }

  if (state.path === null) {
    return renderPortal(
      <div className="mapflow-onboarding__layer">
        <div className="mapflow-onboarding__full-mask" aria-hidden="true" />
        <div
          ref={dialogRef}
          className="mapflow-onboarding__path-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mapflow-onboarding-title"
        >
          <div className="mapflow-onboarding__path-heading">
            <p className="mapflow-onboarding__eyebrow">第一次来 MapFlow？</p>
            <h2 id="mapflow-onboarding-title">选择一种开始方式</h2>
            <p className="mapflow-onboarding__lede">选好之后，你可以随时切换路径。</p>
          </div>
          <div className="mapflow-onboarding__path-grid">
            <PathChoice
              title="直接在网站开始"
              detail="适用于没接触过 Agent 的用户"
              onClick={() => onChange({ path: 'website', websiteStep: 'generate-map' })}
            />
            <PathChoice
              title="连接自己的 Agent"
              detail="适用于接触过 Agent 或正在使用 Agent 的用户"
              onClick={() => {
                onChange({ path: 'agent' });
                onOpenAgentGuide();
              }}
            />
          </div>
          <button type="button" onClick={onSkip} className="mapflow-onboarding__skip">
            跳过引导
          </button>
        </div>
      </div>,
    );
  }

  const isFirstStep = stepIndex <= 0;
  const isLastStep = stepIndex >= WEBSITE_ONBOARDING_STEPS.length - 1;

  if (!targetRect && waitingCollapsed) {
    return renderPortal(
      <div className="mapflow-onboarding__layer">
        <div ref={dialogRef} className="mapflow-onboarding__waiting-collapsed">
          <button type="button" onClick={() => setWaitingCollapsed(false)}>
            展开导览提示
          </button>
        </div>
      </div>,
    );
  }

  return renderPortal(
    <div className="mapflow-onboarding__layer">
      <SpotlightMask targetRect={targetRect} />
      <div
        ref={dialogRef}
        className={`mapflow-onboarding__tooltip${isLargeTargetRect(targetRect) ? ' mapflow-onboarding__tooltip--canvas' : ''}`}
        style={tooltipStyle}
        role="dialog"
        aria-modal={targetRect ? 'true' : undefined}
        aria-labelledby="mapflow-website-onboarding-title"
      >
        <div>
          <div className="mapflow-onboarding__tooltip-topline">
            <span>网站引导 · {stepIndex + 1} / {WEBSITE_ONBOARDING_STEPS.length}</span>
            <button type="button" onClick={onSkip} className="mapflow-onboarding__tooltip-skip">
              跳过引导
            </button>
            {!targetRect && (
              <button
                type="button"
                onClick={() => setWaitingCollapsed(true)}
                className="mapflow-onboarding__tooltip-skip"
              >
                收起提示
              </button>
            )}
          </div>
          <p className="mapflow-onboarding__tooltip-label">{copy.label}</p>
          <h2 id="mapflow-website-onboarding-title">{copy.title}</h2>
          <p className="mapflow-onboarding__tooltip-detail">{copy.detail}</p>
          {!targetRect && (
            <p className="mapflow-onboarding__tooltip-note">{copy.missingTarget}</p>
          )}
          <div className="mapflow-onboarding__tooltip-actions">
            <button
              type="button"
              onClick={() => {
                if (isFirstStep) onChange({ path: null });
                else onChange({ websiteStep: WEBSITE_ONBOARDING_STEPS[stepIndex - 1] });
              }}
              className="mapflow-onboarding__tooltip-secondary"
            >
              上一步
            </button>
            <button
              type="button"
              disabled={!targetRect && requiresVisibleTarget}
              onClick={() => {
                if (isLastStep) onChange({ dismissed: true });
                else onChange({ websiteStep: WEBSITE_ONBOARDING_STEPS[stepIndex + 1] });
              }}
              className="mapflow-onboarding__tooltip-primary"
            >
              下一步
            </button>
          </div>
        </div>
      </div>
    </div>,
  );
}

function renderPortal(content: ReactNode) {
  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}

function PathChoice({
  title,
  detail,
  onClick,
}: {
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-label={title} className="mapflow-onboarding__path-choice" onClick={onClick}>
      <span className="mapflow-onboarding__path-title">{title}</span>
      <span className="mapflow-onboarding__path-detail">{detail}</span>
      <span className="mapflow-onboarding__path-arrow" aria-hidden="true">→</span>
    </button>
  );
}

function SpotlightMask({ targetRect }: { targetRect: ViewportRect | null }) {
  if (!targetRect) return null;

  const horizontal = {
    left: 0,
    right: 0,
    position: 'fixed' as const,
    zIndex: 70,
    background: 'rgba(2, 6, 23, 0.78)',
    pointerEvents: 'auto' as const,
  };

  return (
    <>
      <div className="mapflow-onboarding__mask-piece" aria-hidden="true" style={{ ...horizontal, top: 0, height: targetRect.top }} />
      <div className="mapflow-onboarding__mask-piece" aria-hidden="true" style={{ ...horizontal, top: targetRect.bottom, bottom: 0 }} />
      <div className="mapflow-onboarding__mask-piece" aria-hidden="true" style={{ top: targetRect.top, left: 0, width: targetRect.left, height: targetRect.height }} />
      <div className="mapflow-onboarding__mask-piece" aria-hidden="true" style={{ top: targetRect.top, right: 0, width: Math.max(0, window.innerWidth - targetRect.right), height: targetRect.height }} />
      <div
        className="mapflow-onboarding__spotlight"
        data-testid="mapflow-onboarding-spotlight"
        aria-hidden="true"
        style={{
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
        }}
      />
    </>
  );
}
