export interface StoryChapterStyle {
  opacity: number;
  translateY: number;
  scale: number;
}

export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function getChapterProgress(
  progress: number,
  chapterIndex: number,
  chapterCount: number,
): number {
  if (chapterCount <= 0 || chapterIndex < 0 || chapterIndex >= chapterCount) return 0;
  const chapterRange = 1 / chapterCount;
  return clampUnit((progress - chapterIndex * chapterRange) / chapterRange);
}

export function getSectionScrollProgress(
  scrollTop: number,
  sectionStart: number,
  sectionScrollDistance: number,
): number {
  if (sectionScrollDistance <= 0) return 0;
  return clampUnit((scrollTop - sectionStart) / sectionScrollDistance);
}

export function getStoryChapterStyle(
  progress: number,
  chapterIndex: number,
  chapterCount: number,
  reducedMotion = false,
): StoryChapterStyle {
  const localProgress = getChapterProgress(progress, chapterIndex, chapterCount);
  const chapterRange = chapterCount > 0 ? 1 / chapterCount : 1;
  const chapterStart = chapterIndex * chapterRange;
  const isBeforeChapter = progress < chapterStart;
  const isAfterChapter = progress > chapterStart + chapterRange;

  if (isBeforeChapter || isAfterChapter) {
    return {
      opacity: 0,
      translateY: reducedMotion ? 0 : isBeforeChapter ? 24 : -24,
      scale: reducedMotion ? 1 : 0.96,
    };
  }

  if (reducedMotion) {
    return { opacity: 1, translateY: 0, scale: 1 };
  }

  const fadeIn = clampUnit((localProgress + 0.1) / 0.2);
  const fadeOut = clampUnit((1.1 - localProgress) / 0.2);
  const opacity = Math.min(fadeIn, fadeOut);

  return {
    opacity,
    translateY: (1 - fadeIn) * 24 - (1 - fadeOut) * 24,
    scale: 0.96 + opacity * 0.04,
  };
}

export function getStoryPathDrawProgress(progress: number): number {
  return clampUnit(progress);
}
