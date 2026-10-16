interface ThemeSnapshotTransition {
  ready: Promise<void>;
  finished: Promise<void>;
  skipTransition: () => void;
}
type TransitionDocument = Document & { startViewTransition?: (update: () => void) => ThemeSnapshotTransition };
let activeMotion: { cancel: () => void } | undefined;

export function cancelThemeTransition() { activeMotion?.cancel(); }

/** Reveal the new theme underneath a shrinking snapshot of the old page. */
export function transitionTheme(update: () => void, source?: HTMLElement) {
  cancelThemeTransition();
  const root = document.documentElement;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { update(); return; }
  const snapshotDocument = document as TransitionDocument;
  let animation: Animation | undefined;
  let snapshot: ThemeSnapshotTransition | undefined;
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
  const motion = { cancel: () => {
    if (activeMotion === motion) { delete root.dataset.mapflowThemeTransition; activeMotion = undefined; }
    snapshot?.skipTransition(); animation?.cancel(); clearTimeout(fallbackTimer);
  } };
  activeMotion = motion;
  let updated = false;
  const commit = () => { if (activeMotion === motion && !updated) { updated = true; update(); } };
  const finish = () => {
    animation?.cancel(); clearTimeout(fallbackTimer);
    if (activeMotion === motion) { delete root.dataset.mapflowThemeTransition; activeMotion = undefined; }
  };
  const fade = () => {
    root.dataset.mapflowThemeTransition = 'fade';
    // Establish the transition rules before changing the color variables.
    void root.offsetWidth;
    commit(); fallbackTimer = setTimeout(finish, 360);
  };
  if (!snapshotDocument.startViewTransition || !root.animate) { fade(); return; }
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  const bounds = (source ?? focused)?.getBoundingClientRect();
  const x = bounds?.width ? Math.max(0, Math.min(innerWidth, bounds.left + bounds.width / 2)) : innerWidth / 2;
  const y = bounds?.height ? Math.max(0, Math.min(innerHeight, bounds.top + bounds.height / 2)) : innerHeight / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.dataset.mapflowThemeTransition = 'spotlight';
  try { snapshot = snapshotDocument.startViewTransition(commit); }
  catch { fade(); return; }
  void snapshot.ready.then(() => {
    if (activeMotion !== motion) return;
    animation = root.animate({ clipPath: [`circle(${radius}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`] },
      { duration: 600, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards', pseudoElement: '::view-transition-old(root)' });
    void animation.finished.catch(() => undefined);
  }).catch(() => { if (activeMotion === motion) { commit(); snapshot?.skipTransition(); } });
  void snapshot.finished.then(finish, finish);
}
