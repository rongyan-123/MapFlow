const connectionSelector = '.mapflow-block-connection';
const visibilityAttribute = 'data-mapflow-flow-visible';

export interface MapAnimationController {
  setMoving: (moving: boolean, source?: 'viewport' | 'node') => void;
  setPanning: (panning: boolean) => void;
  dispose: () => void;
}

/** Keep animation scheduling outside React's per-frame viewport updates. */
export function observeMapAnimations(canvas: HTMLElement): MapAnimationController {
  let disposed = false;
  let panning = false;
  const ownerDocument = canvas.ownerDocument;
  const ownerWindow = ownerDocument.defaultView;
  const observed = new Set<Element>();
  const movingSources = new Set<'viewport' | 'node'>();
  let intersections: IntersectionObserver | undefined;
  let mutations: MutationObserver | undefined;

  function setPanning(next: boolean) {
    if (disposed || next === panning) return;
    panning = next;
    if (panning) canvas.setAttribute('data-mapflow-panning', 'true');
    else canvas.removeAttribute('data-mapflow-panning');
  }

  const finishPan = () => setPanning(false);
  const finishPanWhenHidden = () => { if (ownerDocument.hidden) finishPan(); };
  ownerDocument.addEventListener('pointerup', finishPan, true);
  ownerDocument.addEventListener('pointercancel', finishPan, true);
  ownerDocument.addEventListener('visibilitychange', finishPanWhenHidden);
  ownerWindow?.addEventListener('blur', finishPan);

  function forEachConnection(root: Node, visit: (connection: Element) => void) {
    if (!(root instanceof Element)) return;
    if (root.matches(connectionSelector)) visit(root);
    root.querySelectorAll(connectionSelector).forEach(visit);
  }

  function observe(connection: Element) {
    if (observed.has(connection)) return;
    observed.add(connection);
    intersections?.observe(connection);
  }

  function unobserve(connection: Element) {
    if (!observed.delete(connection)) return;
    intersections?.unobserve(connection);
    connection.removeAttribute(visibilityAttribute);
  }

  if (typeof IntersectionObserver !== 'undefined' && typeof MutationObserver !== 'undefined') {
    intersections = new IntersectionObserver(entries => {
      if (disposed) return;
      for (const entry of entries) {
        if (observed.has(entry.target)) {
          entry.target.setAttribute(visibilityAttribute, String(entry.isIntersecting));
        }
      }
    }, { root: canvas });
    canvas.setAttribute('data-mapflow-flow-visibility', 'observed');
    mutations = new MutationObserver(records => {
      if (disposed) return;
      for (const record of records) {
        record.removedNodes.forEach(node => forEachConnection(node, unobserve));
        record.addedNodes.forEach(node => forEachConnection(node, observe));
      }
    });
    mutations.observe(canvas, { childList: true, subtree: true });
    forEachConnection(canvas, observe);
  }

  return {
    setPanning,
    setMoving(moving, source = 'viewport') {
      if (disposed) return;
      if (moving) movingSources.add(source);
      else movingSources.delete(source);
      if (movingSources.size) canvas.setAttribute('data-mapflow-moving', 'true');
      else canvas.removeAttribute('data-mapflow-moving');
    },
    dispose() {
      disposed = true;
      ownerDocument.removeEventListener('pointerup', finishPan, true);
      ownerDocument.removeEventListener('pointercancel', finishPan, true);
      ownerDocument.removeEventListener('visibilitychange', finishPanWhenHidden);
      ownerWindow?.removeEventListener('blur', finishPan);
      mutations?.disconnect();
      intersections?.disconnect();
      observed.forEach(connection => connection.removeAttribute(visibilityAttribute));
      observed.clear();
      movingSources.clear();
      canvas.removeAttribute('data-mapflow-flow-visibility');
      canvas.removeAttribute('data-mapflow-moving');
      canvas.removeAttribute('data-mapflow-panning');
    },
  };
}
