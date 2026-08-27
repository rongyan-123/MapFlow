export type NodeDimensions = [width: number, height: number, depth: number];
export type NodePosition = [x: number, y: number, z: number];

export function getNodeBodyDimensions(size: number): NodeDimensions {
  const safeSize = Math.max(size, 0.01);
  return [safeSize * 2.5, safeSize * 1.32, safeSize * 0.72];
}

export function getNodePlateDimensions(size: number): NodeDimensions {
  const [bodyWidth, bodyHeight, bodyDepth] = getNodeBodyDimensions(size);
  return [bodyWidth * 1.08, bodyHeight * 0.9, Math.max(bodyDepth * 0.42, 0.045)];
}

export function getNodeLabelPosition(size: number): NodePosition {
  const [, bodyHeight, bodyDepth] = getNodeBodyDimensions(size);
  return [0, -bodyHeight * 1.15, bodyDepth * 0.62];
}
