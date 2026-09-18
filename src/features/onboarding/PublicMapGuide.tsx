import { useEffect, useState, type ReactNode, type RefObject } from 'react';

export const PUBLIC_GUIDE_STORAGE_KEY = 'mapflow.guide.public.v1.seen';
const PUBLIC_GUIDE_FIRST_LINE = '你现在看到的，就是一张学习地图，';
const PUBLIC_GUIDE_SECOND_LINE = '里面有许多节点，展示了一个技术或方向';
const PUBLIC_GUIDE_THIRD_LINE = '从浅到深、从易到难，';
const PUBLIC_GUIDE_FOURTH_LINE = '需要掌握的所有节点。';
export const PUBLIC_GUIDE_COPY =
  `${PUBLIC_GUIDE_FIRST_LINE}${PUBLIC_GUIDE_SECOND_LINE}${PUBLIC_GUIDE_THIRD_LINE}${PUBLIC_GUIDE_FOURTH_LINE}`;
const PUBLIC_LIBRARY_FIRST_LINE = '这里是网站的公共池，';
const PUBLIC_LIBRARY_SECOND_LINE = '不仅有官方的推荐地图，';
const PUBLIC_LIBRARY_THIRD_LINE = '也有各个用户自己上传的，';
const PUBLIC_LIBRARY_FOURTH_LINE = '点击一个技能树，将它加入到自己的地图库内';
export const PUBLIC_LIBRARY_GUIDE_COPY =
  `${PUBLIC_LIBRARY_FIRST_LINE}${PUBLIC_LIBRARY_SECOND_LINE}${PUBLIC_LIBRARY_THIRD_LINE}${PUBLIC_LIBRARY_FOURTH_LINE}`;
const PERSONAL_GUIDE_FIRST_LINE = '这里是你的个人地图库，';
const PERSONAL_GUIDE_SECOND_LINE = '你之后所创建的技能树，都会显示在这里。';
const PERSONAL_GUIDE_THIRD_LINE =
  '（而且如果你有本地agent，也可以让agent来完全操控你的个人地图库，';
const PERSONAL_GUIDE_FOURTH_LINE = '具体详情，请查看上方的Agent接入教程）';
export const PERSONAL_GUIDE_COPY =
  `${PERSONAL_GUIDE_FIRST_LINE}${PERSONAL_GUIDE_SECOND_LINE}${PERSONAL_GUIDE_THIRD_LINE}${PERSONAL_GUIDE_FOURTH_LINE}`;
export const GENERATION_BUTTON_GUIDE_COPY = '点击此按钮，生成技能树';
export const GENERATION_PANEL_GUIDE_COPY =
  '输入你想学的任何东西，技能，方向，主题，ai都会根据目前主流学习路线，以及你个人的情况，来为你定制一份地图。';

export type PublicGuideStep =
  | 'map'
  | 'library'
  | 'personal'
  | 'personal-status'
  | 'generation-button'
  | 'generation-panel';

export interface PublicGuideTargetRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PublicGuideViewport {
  width: number;
  height: number;
}

export interface PublicGuideCardPlacement {
  left: number;
  top: number;
  width: number;
  placement: 'left' | 'right' | 'top' | 'bottom';
}

const GUIDE_STEP_INDEX: Record<PublicGuideStep, number> = {
  map: 1,
  library: 2,
  personal: 3,
  'personal-status': 4,
  'generation-button': 5,
  'generation-panel': 6,
};
const GUIDE_STEP_INDEX_WITHOUT_STATUS: Record<
  Exclude<PublicGuideStep, 'personal-status'>,
  number
> = {
  map: 1,
  library: 2,
  personal: 3,
  'generation-button': 4,
  'generation-panel': 5,
};
const GUIDE_STEP_TOTAL_WITH_STATUS = Object.keys(GUIDE_STEP_INDEX).length;
const GUIDE_STEP_TOTAL_WITHOUT_STATUS = Object.keys(GUIDE_STEP_INDEX_WITHOUT_STATUS).length;
const GUIDE_STEP_TITLES: Record<PublicGuideStep, string> = {
  map: '先看懂一张学习地图',
  library: '从公共池找到你的地图',
  personal: '这里保存你的个人地图',
  'personal-status': '记录你的学习进度',
  'generation-button': '开始生成你的学习地图',
  'generation-panel': '把一个主题变成学习地图',
};
const GUIDE_CARD_MAX_WIDTH = 280;
const GUIDE_CARD_ESTIMATED_HEIGHT = 230;
const GUIDE_VIEWPORT_MARGIN = 16;
const GUIDE_TARGET_GAP = 12;

export function getPublicGuideCardPlacement(
  targetRect: PublicGuideTargetRect | null,
  viewport: PublicGuideViewport,
): PublicGuideCardPlacement {
  const width = Math.min(
    GUIDE_CARD_MAX_WIDTH,
    Math.max(0, viewport.width - GUIDE_VIEWPORT_MARGIN * 2),
  );
  const maxTop = Math.max(
    GUIDE_VIEWPORT_MARGIN,
    viewport.height - GUIDE_CARD_ESTIMATED_HEIGHT - GUIDE_VIEWPORT_MARGIN,
  );

  if (!targetRect) {
    return {
      left: GUIDE_VIEWPORT_MARGIN,
      top: GUIDE_VIEWPORT_MARGIN,
      width,
      placement: 'top',
    };
  }

  const targetRight = targetRect.left + targetRect.width;
  const targetBottom = targetRect.top + targetRect.height;
  const leftFits = targetRect.left >= width + GUIDE_VIEWPORT_MARGIN + GUIDE_TARGET_GAP;
  const rightFits =
    viewport.width - targetRight >= width + GUIDE_VIEWPORT_MARGIN + GUIDE_TARGET_GAP;
  const alignedTop = Math.min(
    maxTop,
    Math.max(GUIDE_VIEWPORT_MARGIN, targetRect.top + GUIDE_TARGET_GAP),
  );

  if (leftFits) {
    return {
      left: Math.max(
        GUIDE_VIEWPORT_MARGIN,
        targetRect.left - width - GUIDE_TARGET_GAP,
      ),
      top: alignedTop,
      width,
      placement: 'left',
    };
  }

  if (rightFits) {
    return {
      left: Math.min(
        viewport.width - width - GUIDE_VIEWPORT_MARGIN,
        targetRight + GUIDE_TARGET_GAP,
      ),
      top: alignedTop,
      width,
      placement: 'right',
    };
  }

  const topFits =
    targetRect.top >=
    GUIDE_VIEWPORT_MARGIN + GUIDE_CARD_ESTIMATED_HEIGHT + GUIDE_TARGET_GAP;
  if (topFits) {
    return {
      left: Math.max(
        GUIDE_VIEWPORT_MARGIN,
        (viewport.width - width) / 2,
      ),
      top: targetRect.top - GUIDE_CARD_ESTIMATED_HEIGHT - GUIDE_TARGET_GAP,
      width,
      placement: 'top',
    };
  }

  const bottomFits =
    viewport.height - targetBottom >=
    GUIDE_VIEWPORT_MARGIN + GUIDE_CARD_ESTIMATED_HEIGHT + GUIDE_TARGET_GAP;
  if (bottomFits) {
    return {
      left: Math.max(
        GUIDE_VIEWPORT_MARGIN,
        (viewport.width - width) / 2,
      ),
      top: targetBottom + GUIDE_TARGET_GAP,
      width,
      placement: 'bottom',
    };
  }

  return {
    left: GUIDE_VIEWPORT_MARGIN,
    top: Math.min(maxTop, Math.max(GUIDE_VIEWPORT_MARGIN, targetRect.top)),
    width,
    placement: 'bottom',
  };
}

interface PublicMapGuideProps {
  step: PublicGuideStep;
  targetRef: RefObject<HTMLElement | null>;
  additionalTargetRef?: RefObject<HTMLElement | null>;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  onOpenAgentGuide: () => void;
  statusStepEnabled?: boolean;
}

function readViewportSize(): PublicGuideViewport {
  if (typeof window === 'undefined') return { width: 1280, height: 720 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function GuideBody({
  step,
  onOpenAgentGuide,
}: {
  step: PublicGuideStep;
  onOpenAgentGuide: () => void;
}): ReactNode {
  if (step === 'map') return PUBLIC_GUIDE_COPY;
  if (step === 'library') return PUBLIC_LIBRARY_GUIDE_COPY;
  if (step === 'generation-button') return GENERATION_BUTTON_GUIDE_COPY;
  if (step === 'generation-panel') return GENERATION_PANEL_GUIDE_COPY;
  if (step === 'personal-status') {
    return (
      <>
        <span className="block font-semibold">点击这里，记录你在这个节点上的学习状态。</span>
        <span className="mt-2 block text-xs font-normal leading-5 text-slate-900/75">
          （接入本地 Agent 后，它可以直接修改地图中的各种内容，包括学习进度。强烈推荐使用本地 Agent，查看
          <button
            type="button"
            aria-label="查看 Agent 接入教程"
            onClick={onOpenAgentGuide}
            className="font-semibold underline decoration-slate-900/50 underline-offset-2 transition hover:text-slate-950"
          >
            Agent 接入教程
          </button>
          。）
        </span>
      </>
    );
  }

  return (
    <>
      <span data-testid="public-map-guide-personal-headline" className="block font-semibold">
        {PERSONAL_GUIDE_FIRST_LINE}
        {PERSONAL_GUIDE_SECOND_LINE}
      </span>
      <span
        data-testid="public-map-guide-personal-note"
        className="mt-2 block text-xs font-normal leading-5 text-slate-900/75"
      >
        {PERSONAL_GUIDE_THIRD_LINE}
        {PERSONAL_GUIDE_FOURTH_LINE}
      </span>
    </>
  );
}

export default function PublicMapGuide({
  step,
  targetRef,
  additionalTargetRef,
  onNext,
  onPrevious,
  onClose,
  onOpenAgentGuide,
  statusStepEnabled = true,
}: PublicMapGuideProps) {
  const [targetRect, setTargetRect] = useState<PublicGuideTargetRect | null>(null);
  const [viewportSize, setViewportSize] = useState(readViewportSize);
  const isGenerationPanelStep = step === 'generation-panel';
  const stepIndex = statusStepEnabled
    ? GUIDE_STEP_INDEX[step]
    : step === 'personal-status'
      ? GUIDE_STEP_INDEX_WITHOUT_STATUS.personal
      : GUIDE_STEP_INDEX_WITHOUT_STATUS[step];
  const stepTotal = statusStepEnabled
    ? GUIDE_STEP_TOTAL_WITH_STATUS
    : GUIDE_STEP_TOTAL_WITHOUT_STATUS;
  const isFirstStep = stepIndex === 1;
  const isLastStep = stepIndex === stepTotal;

  useEffect(() => {
    const updateLayout = () => {
      const rects = [targetRef, additionalTargetRef]
        .map((ref) => ref?.current?.getBoundingClientRect())
        .filter((rect): rect is DOMRect => Boolean(rect && rect.width && rect.height));
      if (!rects.length) {
        setTargetRect(null);
      } else {
        const left = Math.min(...rects.map((rect) => rect.left));
        const top = Math.min(...rects.map((rect) => rect.top));
        const right = Math.max(...rects.map((rect) => rect.right));
        const bottom = Math.max(...rects.map((rect) => rect.bottom));
        setTargetRect({
          left,
          top,
          width: right - left,
          height: bottom - top,
        });
      }
      setViewportSize(readViewportSize());
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    window.addEventListener('scroll', updateLayout, true);
    return () => {
      window.removeEventListener('resize', updateLayout);
      window.removeEventListener('scroll', updateLayout, true);
    };
  }, [additionalTargetRef, targetRef]);

  const focusScope =
    step === 'map'
      ? 'map'
      : step === 'library'
        ? 'public-library'
        : step === 'personal'
          ? 'personal-content'
          : step === 'personal-status'
            ? 'personal-status'
          : step === 'generation-button'
            ? 'generation-button'
            : 'generation-panel';
  const cardPlacement = getPublicGuideCardPlacement(targetRect, viewportSize);

  return (
    <div
      data-testid="public-map-guide"
      role="dialog"
      aria-modal="true"
      aria-labelledby="public-map-guide-title"
      className="pointer-events-none fixed inset-0 z-[80]"
    >
      {targetRect ? (
        <>
          <div
            data-testid="public-map-guide-blocker"
            aria-hidden="true"
            className="pointer-events-auto absolute"
            style={{
              top: 0,
              left: 0,
              right: 0,
              height: Math.max(0, targetRect.top),
            }}
          />
          <div
            data-testid="public-map-guide-blocker"
            aria-hidden="true"
            className="pointer-events-auto absolute"
            style={{
              top: targetRect.top,
              left: 0,
              width: Math.max(0, targetRect.left),
              height: targetRect.height,
            }}
          />
          <div
            data-testid="public-map-guide-blocker"
            aria-hidden="true"
            className="pointer-events-auto absolute"
            style={{
              top: targetRect.top,
              left: targetRect.left + targetRect.width,
              right: 0,
              height: targetRect.height,
            }}
          />
          <div
            data-testid="public-map-guide-blocker"
            aria-hidden="true"
            className="pointer-events-auto absolute"
            style={{
              top: targetRect.top + targetRect.height,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          {isGenerationPanelStep && (
            <div
              data-testid="public-map-guide-target-blocker"
              aria-hidden="true"
              className="pointer-events-auto absolute"
              style={{
                left: targetRect.left,
                top: targetRect.top,
                width: targetRect.width,
                height: targetRect.height,
              }}
            />
          )}
          <div
            data-testid="public-map-guide-focus"
            data-focus-scope={focusScope}
            aria-hidden="true"
            className="absolute rounded-[2rem] border-2 border-fuchsia-300/90"
            style={{
              left: targetRect.left - 10,
              top: targetRect.top - 10,
              width: targetRect.width + 20,
              height: targetRect.height + 20,
              boxShadow:
                '0 0 0 9999px rgba(2, 6, 23, 0.78), 0 0 48px 8px rgba(217, 70, 239, 0.72)',
            }}
          />
        </>
      ) : (
        <>
          <div
            data-testid="public-map-guide-blocker"
            aria-hidden="true"
            className="pointer-events-auto absolute inset-0"
          />
          <div
            data-testid="public-map-guide-focus"
            data-focus-scope={focusScope}
            aria-hidden="true"
            className="absolute inset-0 bg-slate-950/80"
          />
        </>
      )}

      <section
        data-testid="public-map-guide-card"
        data-placement={cardPlacement.placement}
        className="pointer-events-auto absolute animate-[mapflow-guide-float_4s_ease-in-out_infinite] rounded-2xl border-2 border-fuchsia-200/90 bg-gradient-to-br from-fuchsia-400 via-amber-300 to-lime-200 p-4 text-slate-950 shadow-[0_0_36px_rgba(217,70,239,0.58),0_18px_70px_rgba(251,191,36,0.3)]"
        style={{
          left: cardPlacement.left,
          top: cardPlacement.top,
          width: cardPlacement.width,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span
            data-testid="public-map-guide-progress"
            className="text-xs font-semibold tracking-wide text-slate-900/65"
          >
            {stepIndex} / {stepTotal}
          </span>
          <button
            type="button"
            aria-label="关闭引导"
            title="跳过引导"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-xl leading-none text-slate-900/70 transition hover:bg-slate-950/10 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
          >
            ×
          </button>
        </div>

        <h2
          id="public-map-guide-title"
          className="mt-1 text-base font-bold leading-6 sm:text-lg"
        >
          {GUIDE_STEP_TITLES[step]}
        </h2>
        <div className="mt-2 text-sm leading-6 text-slate-950/85">
          <GuideBody step={step} onOpenAgentGuide={onOpenAgentGuide} />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div
            data-testid="public-map-guide-dots"
            aria-label={`引导进度：第 ${stepIndex} 步，共 ${stepTotal} 步`}
            className="flex items-center gap-1.5"
          >
            {Array.from({ length: stepTotal }, (_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={`h-2 w-2 rounded-full transition ${
                  index + 1 === stepIndex
                    ? 'w-5 bg-slate-950'
                    : 'bg-slate-950/25'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                type="button"
                aria-label="上一步"
                onClick={onPrevious}
                className="rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-900/70 transition hover:bg-slate-950/10 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
              >
                上一步
              </button>
            )}
            <button
              type="button"
              aria-label={isLastStep ? '开始体验' : '下一步'}
              onClick={onNext}
              className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-lime-100 transition hover:-translate-y-0.5 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-300"
            >
              {isLastStep ? '开始体验' : '下一步'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
