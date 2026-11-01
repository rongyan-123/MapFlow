const INITIAL_ZOOM_BOOST = 1.35;
const MAX_READABLE_INITIAL_ZOOM = 1.15;
type CanvasSize = {width:number;height:number};
type Point = {x:number;y:number};
type MapViewport = Point & {zoom:number};
type Bounds = Point & {width:number;height:number};

export function getFocusedNodeViewport(canvas:CanvasSize, position:Point, currentZoom:number) {
  const zoom = Math.min(Math.max(currentZoom, .85), 1.15, Math.max(1, canvas.width-48)/240, Math.max(1, canvas.height-80)/104);
  return {x:canvas.width/2-(position.x+120)*zoom,y:canvas.height/2-(position.y+52)*zoom,zoom};
}

export function getGroupViewport(canvas:CanvasSize, bounds:Bounds, current:MapViewport):MapViewport {
  const padding=32;
  const zoom=Math.min(Math.max(current.zoom,.85),1.15,
    Math.max(1,canvas.width-padding*2)/bounds.width,
    Math.max(.85,(canvas.height-padding*2)/bounds.height));
  const visible=zoom===current.zoom && bounds.x*zoom+current.x>=padding && bounds.y*zoom+current.y>=padding
    && (bounds.x+bounds.width)*zoom+current.x<=canvas.width-padding
    && (bounds.y+bounds.height)*zoom+current.y<=canvas.height-padding;
  if(visible)return current;
  return {x:canvas.width/2-(bounds.x+bounds.width/2)*zoom,
    y:bounds.height*zoom>canvas.height-padding*2?padding-bounds.y*zoom:canvas.height/2-(bounds.y+bounds.height/2)*zoom,zoom};
}

export function getStartingViewport(canvas:{width:number;height:number},position:{x:number;y:number},zoom:number){return {x:canvas.width/2-(position.x+120)*zoom,y:52-position.y*zoom,zoom};}

export function getReadableInitialZoom(fittedZoom: number): number {
  if (!Number.isFinite(fittedZoom) || fittedZoom <= 0) return fittedZoom;
  return Math.min(
    MAX_READABLE_INITIAL_ZOOM,
    Math.max(fittedZoom, fittedZoom * INITIAL_ZOOM_BOOST),
  );
}
