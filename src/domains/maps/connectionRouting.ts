import type { ConnectionRect } from './blockConnections';

interface Point { x: number; y: number }
const CLEARANCE = 20;
const PADDING = 12;
const BEND_COST = 12;

function polyline(vertices: Point[]) {
  const points: Point[] = [];
  for (const point of vertices) {
    const last = points[points.length - 1], before = points[points.length - 2];
    if (last && last.x === point.x && last.y === point.y) continue;
    if (before && last && (before.x === last.x && last.x === point.x || before.y === last.y && last.y === point.y)) points.pop();
    points.push(point);
  }
  const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  let length = points.slice(1).reduce((sum, point, index) => sum + distance(point, points[index]), 0);
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1], corner = points[index], next = points[index + 1];
    const before = distance(previous, corner), after = distance(corner, next), radius = Math.min(6, before / 2, after / 2);
    const entry = { x: corner.x + (previous.x - corner.x) / before * radius, y: corner.y + (previous.y - corner.y) / before * radius };
    const exit = { x: corner.x + (next.x - corner.x) / after * radius, y: corner.y + (next.y - corner.y) / after * radius };
    path += ` L ${entry.x} ${entry.y} Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`;
    // Exact arc length of this equal-radius quadratic corner, used by the flow.
    length -= (1 - Math.SQRT1_2 * Math.log(1 + Math.SQRT2)) * radius;
  }
  const end = points[points.length - 1];
  path += ` L ${end.x} ${end.y}`;
  return { points, start: points[0], end, path, length };
}

function intersects(points: Point[], rectangles: ConnectionRect[]) {
  return points.slice(1).some((end, index) => {
    const start = points[index];
    return rectangles.some(rect => start.x === end.x
      ? start.x > rect.x && start.x < rect.x + rect.width && Math.max(start.y, end.y) > rect.y && Math.min(start.y, end.y) < rect.y + rect.height
      : start.y > rect.y && start.y < rect.y + rect.height && Math.max(start.x, end.x) > rect.x && Math.min(start.x, end.x) < rect.x + rect.width);
  });
}

function lowerBound(values: number[], target: number) {
  let left = 0, right = values.length;
  while (left < right) {
    const middle = (left + right) >>> 1;
    if (values[middle] < target) left = middle + 1;
    else right = middle;
  }
  return left;
}

interface SearchEntry { state: number; cost: number; estimate: number }
class SearchQueue {
  private entries: SearchEntry[] = [];
  private precedes(first: SearchEntry, second: SearchEntry) {
    return first.estimate < second.estimate || first.estimate === second.estimate && first.cost > second.cost;
  }
  push(entry: SearchEntry) {
    let index = this.entries.length;
    this.entries.push(entry);
    while (index > 0) {
      const parent = (index - 1) >>> 1;
      if (!this.precedes(entry, this.entries[parent])) break;
      this.entries[index] = this.entries[parent]; index = parent;
    }
    this.entries[index] = entry;
  }
  pop() {
    const first = this.entries[0], last = this.entries.pop();
    if (this.entries.length && last) {
      let index = 0;
      while (index * 2 + 1 < this.entries.length) {
        let child = index * 2 + 1;
        if (child + 1 < this.entries.length && this.precedes(this.entries[child + 1], this.entries[child])) child++;
        if (!this.precedes(this.entries[child], last)) break;
        this.entries[index] = this.entries[child]; index = child;
      }
      this.entries[index] = last;
    }
    return first;
  }
}

function createGrid(cards: ConnectionRect[], blockers: ConnectionRect[]) {
  const xs = [...new Set(cards.flatMap(card => [card.x - CLEARANCE, card.x + card.width / 2, card.x + card.width + CLEARANCE]))].sort((a, b) => a - b);
  const ys = [...new Set(cards.flatMap(card => [card.y - CLEARANCE, card.y + card.height + CLEARANCE]))].sort((a, b) => a - b);
  const columns = xs.length, count = columns * ys.length;
  const blocked = new Uint8Array(count), horizontal = new Uint8Array(count), vertical = new Uint8Array(count);
  for (const rect of blockers) {
    const firstX = Math.max(0, lowerBound(xs, rect.x) - 1), lastX = Math.min(columns - 1, lowerBound(xs, rect.x + rect.width));
    const firstY = Math.max(0, lowerBound(ys, rect.y) - 1), lastY = Math.min(ys.length - 1, lowerBound(ys, rect.y + rect.height));
    for (let y = firstY; y <= lastY; y++) for (let x = firstX; x <= lastX; x++) {
      const insideX = xs[x] > rect.x && xs[x] < rect.x + rect.width;
      const insideY = ys[y] > rect.y && ys[y] < rect.y + rect.height;
      const index = y * columns + x;
      if (insideX && insideY) blocked[index] = 1;
      if (insideY && x + 1 < columns && xs[x + 1] > rect.x && xs[x] < rect.x + rect.width) horizontal[index] = 1;
      if (insideX && y + 1 < ys.length && ys[y + 1] > rect.y && ys[y] < rect.y + rect.height) vertical[index] = 1;
    }
  }
  const pointAt = (index: number): Point => ({ x: xs[index % columns], y: ys[Math.floor(index / columns)] });
  const connections = (point: Point) => {
    const y = lowerBound(ys, point.y), x = lowerBound(xs, point.x);
    if (ys[y] !== point.y) return [];
    return [...new Set([x - 1, x])].filter(column => column >= 0 && column < columns).map(column => y * columns + column)
      .filter(index => !blocked[index] && !intersects([point, pointAt(index)], blockers));
  };
  return (start: Point, end: Point) => {
    const starts = connections(start), targets = new Map(connections(end).map(index => [index, Math.abs(pointAt(index).x - end.x)]));
    const costs = new Float64Array(count * 2).fill(Infinity), parents = new Int32Array(count * 2).fill(-1);
    const queue = new SearchQueue();
    const estimate = (index: number) => { const point = pointAt(index); return Math.abs(point.x - end.x) + Math.abs(point.y - end.y); };
    for (const index of starts) {
      const distance = Math.abs(pointAt(index).x - start.x), direction = distance ? 0 : 1;
      const state = index * 2 + direction, cost = distance + (distance ? BEND_COST : 0);
      costs[state] = cost; queue.push({ state, cost, estimate: cost + estimate(index) });
    }
    let bestCost = Infinity, bestState = -1;
    for (let entry = queue.pop(); entry; entry = queue.pop()) {
      if (entry.cost !== costs[entry.state]) continue;
      if (entry.estimate >= bestCost) break;
      const index = Math.floor(entry.state / 2), direction = entry.state % 2;
      const goalDistance = targets.get(index);
      if (goalDistance !== undefined) {
        const goalCost = entry.cost + goalDistance + (goalDistance ? BEND_COST + (direction === 1 ? BEND_COST : 0) : direction === 0 ? BEND_COST : 0);
        if (goalCost < bestCost) { bestCost = goalCost; bestState = entry.state; }
      }
      const column = index % columns, row = Math.floor(index / columns);
      const neighbours: Array<[number, number, number]> = [];
      if (column > 0 && !horizontal[index - 1]) neighbours.push([index - 1, 0, xs[column] - xs[column - 1]]);
      if (column + 1 < columns && !horizontal[index]) neighbours.push([index + 1, 0, xs[column + 1] - xs[column]]);
      if (row > 0 && !vertical[index - columns]) neighbours.push([index - columns, 1, ys[row] - ys[row - 1]]);
      if (row + 1 < ys.length && !vertical[index]) neighbours.push([index + columns, 1, ys[row + 1] - ys[row]]);
      for (const [next, nextDirection, distance] of neighbours) {
        if (blocked[next]) continue;
        const state = next * 2 + nextDirection, cost = entry.cost + distance + (direction !== nextDirection ? BEND_COST : 0);
        if (cost >= costs[state]) continue;
        costs[state] = cost; parents[state] = entry.state;
        queue.push({ state, cost, estimate: cost + estimate(next) });
      }
    }
    if (bestState === -1) return null;
    const path: Point[] = [];
    for (let state = bestState; state !== -1; state = parents[state]) path.push(pointAt(Math.floor(state / 2)));
    return [start, ...path.reverse(), end];
  };
}

/** One obstacle grid per node geometry, shared by every visible edge. */
export function createConnectionRouter(cards: ConnectionRect[]) {
  const blockers = cards.map(card => ({ x: card.x - PADDING, y: card.y - PADDING, width: card.width + PADDING * 2, height: card.height + PADDING * 2 }));
  let grid: ReturnType<typeof createGrid> | undefined;
  const cache = new Map<string, ReturnType<typeof polyline>>();
  const occupied: Array<{ vertical: boolean; axis: number; low: number; high: number }> = [];
  const spread = (vertices: Point[], sourceIndex: number, targetIndex: number) => {
    const points = polyline(vertices).points;
    const clearSegment = (index: number) => !intersects([points[index], points[index + 1]],
      index === 0 ? blockers.filter((_, card) => card !== sourceIndex) : index === points.length - 2 ? blockers.filter((_, card) => card !== targetIndex) : blockers);
    for (let index = 1; index < points.length - 2; index++) {
      const first = points[index], last = points[index + 1], vertical = first.x === last.x;
      const axis = vertical ? first.x : first.y, low = Math.min(vertical ? first.y : first.x, vertical ? last.y : last.x), high = Math.max(vertical ? first.y : first.x, vertical ? last.y : last.x);
      const neighbours = occupied.filter(segment => segment.vertical === vertical && segment.low < high && segment.high > low && Math.abs(segment.axis - axis) <= 70);
      if (!neighbours.some(segment => Math.abs(segment.axis - axis) < 6)) continue;
      const candidates = Array.from({ length: 17 }, (_, offset) => axis + (offset === 0 ? 0 : Math.ceil(offset / 2) * (offset % 2 ? -8 : 8)))
        .map(value => ({ value, score: neighbours.reduce((cost, segment) => cost + Math.max(0, 6 - Math.abs(segment.axis - value)) * (Math.min(high, segment.high) - Math.max(low, segment.low)), 0) * 10 + Math.abs(value - axis) }))
        .sort((a, b) => a.score - b.score);
      for (const candidate of candidates) {
        if (vertical) first.x = last.x = candidate.value;
        else first.y = last.y = candidate.value;
        if (clearSegment(index - 1) && clearSegment(index) && clearSegment(index + 1)) break;
        if (vertical) first.x = last.x = axis;
        else first.y = last.y = axis;
      }
    }
    const routed = polyline(points);
    for (let index = 1; index < routed.points.length; index++) {
      const first = routed.points[index - 1], last = routed.points[index], vertical = first.x === last.x;
      occupied.push({ vertical, axis: vertical ? first.x : first.y,
        low: Math.min(vertical ? first.y : first.x, vertical ? last.y : last.x), high: Math.max(vertical ? first.y : first.x, vertical ? last.y : last.x) });
    }
    return routed;
  };
  return {
    route(source: ConnectionRect, target: ConnectionRect, lane = 0, ports: { source?: number; target?: number } = {}) {
      const key = [source.x, source.y, source.width, source.height, target.x, target.y, target.width, target.height, lane, ports.source, ports.target].join(',');
      const cached = cache.get(key);
      if (cached) return cached;
      const sameRow = Math.abs(source.y - target.y) < Math.min(source.height, target.height) / 2;
      const down = target.y >= source.y, sourceDirection = sameRow || down ? 1 : -1, targetDirection = sameRow || !down ? 1 : -1;
      const start = { x: source.x + source.width * (ports.source ?? .5), y: source.y + (sourceDirection === 1 ? source.height : 0) };
      const end = { x: target.x + target.width * (ports.target ?? .5), y: target.y + (targetDirection === 1 ? target.height : 0) };
      const sourceStub = { x: start.x, y: start.y + sourceDirection * CLEARANCE }, targetStub = { x: end.x, y: end.y + targetDirection * CLEARANCE };
      const offset = ports.source === undefined && ports.target === undefined ? lane * 4 : 0;
      const sourceExit = { x: start.x + offset, y: sourceStub.y }, targetExit = { x: end.x + offset, y: targetStub.y };
      const middleY = sameRow ? Math.max(sourceExit.y, targetExit.y) + 32 + lane * 4 : (sourceExit.y + targetExit.y) / 2;
      const direct = [sourceExit, { x: sourceExit.x, y: middleY }, { x: targetExit.x, y: middleY }, targetExit];
      const sourceIndex = cards.indexOf(source), targetIndex = cards.indexOf(target);
      const blockedExit = intersects([start, sourceStub, sourceExit], blockers.filter((_, index) => index !== sourceIndex))
        || intersects([targetExit, targetStub, end], blockers.filter((_, index) => index !== targetIndex));
      let inner: Point[] | null = null;
      if (!blockedExit) {
        if (!intersects(direct, blockers)) inner = direct;
        else { grid ??= createGrid(cards, blockers); inner = grid(sourceExit, targetExit); }
      }
      // Overlapping dragged cards can block every exit; retain the real relation.
      const route = spread([start, sourceStub, ...(inner ?? direct), targetStub, end], sourceIndex, targetIndex);
      cache.set(key, route);
      return route;
    },
  };
}
