export interface StoryChapterStyle {
  opacity: number;
  translateY: number;
  scale: number;
}

export type PointerIntent = 'scroll' | 'rotate' | 'pinch';

export const LANDING_SCENE_COUNT = 5;
export const MIN_EARTH_ZOOM = 0.72;
export const MAX_EARTH_ZOOM = 1.34;

export interface JellyTiltRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface JellyTilt {
  x: number;
  y: number;
  scale: number;
}

export function getEarthRevealProgress(progress: number): number {
  const clarityProgress = getStorySceneProgress(progress, 1, LANDING_SCENE_COUNT);
  return getMediaRevealProgress(clarityProgress, 0.2, 0.6);
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

export function getSceneProgress(
  progress: number,
  sceneIndex: number,
  sceneCount = LANDING_SCENE_COUNT,
): number {
  if (sceneCount <= 0 || sceneIndex < 0 || sceneIndex >= sceneCount) return 0;
  return Number(clampUnit((progress - sceneIndex / sceneCount) * sceneCount).toFixed(6));
}

/**
 * Calculates chapter-local progress from the scroll timeline used by the
 * pinned story stage. Five chapters occupy four viewport-to-viewport spans.
 */
export function getStorySceneProgress(
  progress: number,
  sceneIndex: number,
  sceneCount = LANDING_SCENE_COUNT,
): number {
  if (sceneCount <= 0 || sceneIndex < 0 || sceneIndex >= sceneCount) return 0;
  if (sceneCount === 1) return 1;

  const intervalCount = sceneCount - 1;
  const intervalSize = 1 / intervalCount;
  if (sceneIndex === sceneCount - 1) return clampUnit(progress) >= 1 ? 1 : 0;
  const sceneStart = sceneIndex * intervalSize;
  return Number(clampUnit((clampUnit(progress) - sceneStart) / intervalSize).toFixed(6));
}

export interface StoryTimelineState {
  activeSceneIndex: number;
  baseSceneIndex: number;
  nextSceneIndex: number | null;
  mediaRevealProgress: number;
}

/**
 * Maps the normalized story scroll range to the chapter centers used by the
 * sticky media stage. The first and last chapters are the ends of the range,
 * so four scroll intervals connect five full-screen chapters.
 */
export function getStoryTimelineState(
  progress: number,
  sceneCount = LANDING_SCENE_COUNT,
): StoryTimelineState {
  if (sceneCount <= 0) {
    return {
      activeSceneIndex: 0,
      baseSceneIndex: 0,
      nextSceneIndex: null,
      mediaRevealProgress: 0,
    };
  }

  if (sceneCount === 1) {
    return {
      activeSceneIndex: 0,
      baseSceneIndex: 0,
      nextSceneIndex: null,
      mediaRevealProgress: 0,
    };
  }

  const normalizedProgress = clampUnit(progress);
  const intervalCount = sceneCount - 1;
  const timelinePosition = normalizedProgress * intervalCount;
  const segmentIndex = Math.min(intervalCount - 1, Math.floor(timelinePosition));
  const segmentProgress = clampUnit(timelinePosition - segmentIndex);
  const activeSceneIndex = Math.min(sceneCount - 1, Math.round(timelinePosition));
  const isAtEnd = normalizedProgress >= 1;
  const mediaRevealProgress = segmentIndex === 0
    ? 1
    : Number(segmentProgress.toFixed(6));

  return {
    activeSceneIndex,
    baseSceneIndex: isAtEnd ? sceneCount - 1 : segmentIndex,
    nextSceneIndex: isAtEnd ? null : segmentIndex + 1,
    mediaRevealProgress: isAtEnd ? 0 : mediaRevealProgress,
  };
}

export function getMediaRevealProgress(
  sceneProgress: number,
  revealStart = 0.2,
  revealEnd = 0.7,
): number {
  if (revealEnd <= revealStart) return sceneProgress >= revealEnd ? 1 : 0;
  return Number(clampUnit((sceneProgress - revealStart) / (revealEnd - revealStart)).toFixed(6));
}

export function getPointerIntent(
  deltaX: number,
  deltaY: number,
  pointerCount = 1,
): PointerIntent {
  return getPointerIntentFromDisplacement(deltaX, deltaY, pointerCount);
}

export function getPointerIntentFromDisplacement(
  totalDeltaX: number,
  totalDeltaY: number,
  pointerCount = 1,
): PointerIntent {
  if (pointerCount >= 2) return 'pinch';
  const horizontalDistance = Math.abs(totalDeltaX);
  const verticalDistance = Math.abs(totalDeltaY);
  if (horizontalDistance >= 10 && horizontalDistance > verticalDistance * 1.2) {
    return 'rotate';
  }
  return 'scroll';
}

export function getEarthZoom(
  zoom: number,
  minZoom = MIN_EARTH_ZOOM,
  maxZoom = MAX_EARTH_ZOOM,
): number {
  return Math.min(maxZoom, Math.max(minZoom, Number.isFinite(zoom) ? zoom : 1));
}

export function getJellyTilt(
  pointerX: number,
  pointerY: number,
  rect: JellyTiltRect,
  reducedMotion = false,
): JellyTilt {
  if (
    reducedMotion ||
    !Number.isFinite(pointerX) ||
    !Number.isFinite(pointerY) ||
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.top) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return { x: 0, y: 0, scale: 1 };
  }

  const normalizedX = clampUnit((pointerX - (rect.left + rect.width / 2)) / (rect.width / 2) / 2 + 0.5) * 2 - 1;
  const normalizedY = clampUnit(((rect.top + rect.height / 2) - pointerY) / (rect.height / 2) / 2 + 0.5) * 2 - 1;
  return {
    x: Number((normalizedX * 6).toFixed(3)),
    y: Number((normalizedY * 5).toFixed(3)),
    scale: 1,
  };
}
