const INITIAL_ZOOM_BOOST = 1.35;
const MAX_READABLE_INITIAL_ZOOM = 1.15;
export function getStartingViewport(canvas:{width:number;height:number},position:{x:number;y:number},zoom:number){return {x:canvas.width/2-(position.x+120)*zoom,y:52-position.y*zoom,zoom};}

export function getReadableInitialZoom(fittedZoom: number): number {
  if (!Number.isFinite(fittedZoom) || fittedZoom <= 0) return fittedZoom;
  return Math.min(
    MAX_READABLE_INITIAL_ZOOM,
    Math.max(fittedZoom, fittedZoom * INITIAL_ZOOM_BOOST),
  );
}
