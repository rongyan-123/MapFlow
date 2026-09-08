export const SKILL_TREE_DESKTOP_BREAKPOINT = 1024;

const SIGNIFICANT_SIZE_DELTA = 128;
const SIGNIFICANT_SIZE_RATIO = 0.18;
const MOBILE_ANCHOR_RATIO = 0.33;
const MOBILE_GRAPH_MARGIN = 24;

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

export interface FlowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function shouldRefitViewport(
  previous: ViewportSize | null,
  next: ViewportSize,
): boolean {
  if (!isValidViewportSize(next)) return false;
  if (!previous || !isValidViewportSize(previous)) return true;

  const crossedDesktopBreakpoint =
    (previous.width < SKILL_TREE_DESKTOP_BREAKPOINT) !==
    (next.width < SKILL_TREE_DESKTOP_BREAKPOINT);
  if (crossedDesktopBreakpoint) return true;

  return [
    [previous.width, next.width],
    [previous.height, next.height],
  ].some(([before, after]) => {
    const delta = Math.abs(after - before);
    const ratio = delta / Math.max(before, after);
    return delta >= SIGNIFICANT_SIZE_DELTA || ratio >= SIGNIFICANT_SIZE_RATIO;
  });
}

export function getMobileViewportAdjustment(
  viewport: ViewportTransform,
  graphBounds: FlowBounds,
  anchorBounds: FlowBounds,
  size: ViewportSize,
): ViewportTransform {
  const graphTop = graphBounds.y * viewport.zoom + viewport.y;
  const graphBottom =
    (graphBounds.y + graphBounds.height) * viewport.zoom + viewport.y;
  const anchorTop = anchorBounds.y * viewport.zoom + viewport.y;
  const anchorBottom =
    (anchorBounds.y + anchorBounds.height) * viewport.zoom + viewport.y;
  const anchorCenter =
    (anchorBounds.y + anchorBounds.height / 2) * viewport.zoom + viewport.y;
  const desiredAnchorCenter = size.height * MOBILE_ANCHOR_RATIO;
  const desiredDelta = desiredAnchorCenter - anchorCenter;
  const graphFitsInViewport =
    graphBounds.height * viewport.zoom <=
    size.height - MOBILE_GRAPH_MARGIN * 2;
  const top = graphFitsInViewport ? graphTop : anchorTop;
  const bottom = graphFitsInViewport ? graphBottom : anchorBottom;
  const minDelta = MOBILE_GRAPH_MARGIN - top;
  const maxDelta = size.height - MOBILE_GRAPH_MARGIN - bottom;
  const delta =
    minDelta <= maxDelta
      ? Math.min(maxDelta, Math.max(minDelta, desiredDelta))
      : desiredDelta;

  return { ...viewport, y: roundToHundredth(viewport.y + delta) };
}

function isValidViewportSize(size: ViewportSize): boolean {
  return (
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width > 0 &&
    size.height > 0
  );
}

function roundToHundredth(value: number): number {
  return Math.round(value * 100) / 100;
}
