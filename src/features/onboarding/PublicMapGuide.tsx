import { useEffect, useState, type RefObject } from 'react';

export const PUBLIC_GUIDE_STORAGE_KEY = 'mapflow.guide.public.v1.seen';
export const PUBLIC_GUIDE_COPY =
  '你现在看到的，就是公共的学习地图，之后用户自己生成的地图，都可以申请加入公共池，进行展示。';

interface PublicMapGuideProps {
  targetRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

interface TargetRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export default function PublicMapGuide({
  targetRef,
  onClose,
}: PublicMapGuideProps) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  useEffect(() => {
    const updateTargetRect = () => {
      const element = targetRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      setTargetRect({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    };

    updateTargetRect();
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);
    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [targetRef]);

  return (
    <div
      data-testid="public-map-guide"
      role="dialog"
      aria-modal="true"
      aria-label="公共地图引导"
      className="pointer-events-none fixed inset-0 z-[80]"
    >
      {targetRect ? (
        <div
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
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-slate-950/80" />
      )}

      <section className="pointer-events-auto absolute left-[clamp(1rem,18vw,21rem)] top-[clamp(5rem,17vh,10rem)] w-[min(26rem,calc(100vw-2rem))] animate-[mapflow-guide-float_4s_ease-in-out_infinite] rounded-3xl border-2 border-fuchsia-200/90 bg-gradient-to-br from-fuchsia-400 via-amber-300 to-lime-200 p-5 text-slate-950 shadow-[0_0_36px_rgba(217,70,239,0.58),0_18px_70px_rgba(251,191,36,0.3)] sm:p-6">
        <p className="text-base font-bold leading-7 sm:text-lg sm:leading-8">
          {PUBLIC_GUIDE_COPY}
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            aria-label="关闭引导"
            onClick={onClose}
            className="rounded-xl border-2 border-slate-950/70 bg-slate-950 px-4 py-2 text-sm font-bold text-lime-100 transition hover:-translate-y-0.5 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-300"
          >
            关闭引导
          </button>
        </div>
      </section>
    </div>
  );
}
