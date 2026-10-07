import { memo, useEffect, useRef, useState } from 'react';
import { Excalidraw, convertToExcalidrawElements, restoreElements } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import '@excalidraw/excalidraw/index.css';
import type { TeachingCanvasState } from './types';

(window as Window & { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = '/excalidraw/';

function materialize(elements: Record<string, unknown>[]) {
  const saved = new Map(elements.filter(element => typeof element.version === 'number' && typeof element.seed === 'number').map(element => [element.id, element]));
  if (saved.size === elements.length) return restoreElements(elements as unknown as ExcalidrawElement[], null, { repairBindings: true });
  const constructed = convertToExcalidrawElements(elements.filter(element => !element.isDeleted).map(element => ({
    ...element,
    ...(element.label ? { label: { ...(element.label as Record<string, unknown>), ...((element.id as string).length <= 90 ? { id: `${element.id}-label` } : {}) } } : {}),
  })) as ExcalidrawElementSkeleton[], { regenerateIds: false });
  const restored = constructed.map(element => saved.get(element.id) ?? element);
  restored.push(...elements.filter(element => element.isDeleted));
  return restoreElements(restored as unknown as ExcalidrawElement[], null, { repairBindings: true });
}

function sceneFingerprint(elements: readonly ExcalidrawElement[]) {
  return JSON.stringify(elements.map(({ version: _version, versionNonce: _nonce, updated: _updated, index: _index, ...element }) => element), (_key, value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) : value);
}

function canvasTheme(): 'dark' | 'light' {
  return ['light', 'ivory'].includes(window.document.documentElement.dataset.mapflowTheme ?? '') ? 'light' : 'dark';
}

function TeachingCanvasPanel({ document, busy, saving, wide, onSave, onChange, onClose, onWidth }: {
  document: TeachingCanvasState; busy: boolean; saving: boolean; wide: boolean;
  onSave: (elements?: Record<string, unknown>[], enabled?: boolean) => Promise<void>;
  onChange: (elements: Record<string, unknown>[]) => void;
  onClose: () => void; onWidth: () => void;
}) {
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const fittedInitialScene = useRef(false);
  const initial = useRef(materialize(document.elements));
  const incoming = useRef(JSON.stringify(document.elements));
  const lastScene = useRef(sceneFingerprint(initial.current));
  const userEditing = useRef(false);
  const [theme, setTheme] = useState(canvasTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(canvasTheme()));
    observer.observe(window.document.documentElement, { attributes: true, attributeFilter: ['data-mapflow-theme'] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!api.current) return;
    const signature = JSON.stringify(document.elements);
    if (incoming.current === signature) return;
    incoming.current = signature;
    // A save receipt already describes the live editor. Keep its viewport and undo history.
    if (sceneFingerprint(document.elements as unknown as ExcalidrawElement[]) === lastScene.current) return;
    const elements = materialize(document.elements);
    lastScene.current = sceneFingerprint(elements); userEditing.current = false;
    api.current.updateScene({ elements });
    if (elements.length) api.current.scrollToContent(elements, { fitToContent: true, animate: true });
  }, [document]);
  return <section aria-label="教学画布" className={`flex min-h-0 min-w-0 flex-1 flex-col border-r border-slate-800 ${wide ? 'md:basis-[58%]' : 'md:basis-[35%]'} md:flex-none`}>
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2 text-xs">
      <span className="font-semibold">教学画布</span>
      <span role="status" className="text-slate-500">{busy ? 'AI 正在讲解 · 画布暂为只读' : saving ? '保存中…' : '自动保存'}</span>
      <label className="ml-auto flex items-center gap-1.5"><input type="checkbox" aria-label="允许 AI 绘图" checked={document.enabled} disabled={busy || saving}
        onChange={event => void onSave(undefined, event.target.checked)} />允许 AI 绘图</label>
      <button type="button" className="hidden rounded-lg px-2 py-1 hover:bg-slate-800 md:block" onClick={onWidth}>{wide ? '收窄画布' : '放宽画布'}</button>
      <button type="button" className="rounded-lg px-2 py-1 hover:bg-slate-800" onClick={onClose}>收起画布</button>
    </div>
    <div className="min-h-0 flex-1" onPointerDownCapture={() => { userEditing.current = !busy; }} onKeyDownCapture={() => { userEditing.current = !busy; }}>
      <Excalidraw excalidrawAPI={instance => { api.current = instance; }} langCode="zh-CN" theme={theme} viewModeEnabled={busy}
        initialData={{ elements: initial.current, scrollToContent: true, appState: { viewBackgroundColor: '#ffffff' } }}
        UIOptions={{ tools: { image: false }, canvasActions: { loadScene: false, saveToActiveFile: false, export: false, toggleTheme: false } }}
        onChange={(elements, appState) => {
          // The API arrives before initialData. Fit only after the scene and viewport are ready.
          if (!fittedInitialScene.current && api.current && appState?.isLoading === false && appState.width > 0 && appState.height > 0) {
            fittedInitialScene.current = true;
            const instance = api.current;
            if (elements.length) requestAnimationFrame(() => { if (api.current === instance) instance.scrollToContent(elements, { fitToContent: true, animate: false }); });
          }
          const serialized = sceneFingerprint(elements);
          if (serialized === lastScene.current || busy) return;
          lastScene.current = serialized;
          if (!userEditing.current) return;
          onChange(elements.map(element => ({ ...element })));
        }} />
    </div>
  </section>;
}

// Text streaming must not rerender the whiteboard. These callbacks use the same story's stable refs/setters.
export default memo(TeachingCanvasPanel, (previous, next) => previous.document === next.document
  && previous.busy === next.busy && previous.saving === next.saving && previous.wide === next.wide);
