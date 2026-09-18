const INITIAL_ZOOM_BOOST = 1.35;
const MAX_READABLE_INITIAL_ZOOM = 1.15;

export function getReadableInitialZoom(fittedZoom: number): number {
  if (!Number.isFinite(fittedZoom) || fittedZoom <= 0) return fittedZoom;
  return Math.min(
    MAX_READABLE_INITIAL_ZOOM,
    Math.max(fittedZoom, fittedZoom * INITIAL_ZOOM_BOOST),
  );
}
