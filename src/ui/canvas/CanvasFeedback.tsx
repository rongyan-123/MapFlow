import { Button } from '../Button';

export interface CanvasFeedbackProps {
  error?: unknown;
  errorKind?: 'read' | 'save' | null;
  saving: boolean;
  readOnly?: boolean;
  onRetrySave?: () => Promise<void>;
  onReload?: () => Promise<void>;
}

export function CanvasFeedback({ error, errorKind, saving, readOnly, onRetrySave, onReload }: CanvasFeedbackProps) {
  if (!error) return null;
  const failedSave = errorKind === 'save';
  const retry = failedSave ? onRetrySave : onReload;
  return <div role="alert" className="mf-canvas-feedback">
    <p>{failedSave ? '画布尚未保存。你的修改仍保留在本次会话中。' : '暂时无法读取画布，请重试。'}</p>
    {retry && <Button disabled={saving || (failedSave && readOnly)} onClick={() => void retry().catch(() => undefined)}>{failedSave ? '重试保存' : '重新读取'}</Button>}
  </div>;
}

export function PendingTeachingCanvas({ onClose, ...feedback }: CanvasFeedbackProps & { onClose: () => void }) {
  return <section aria-label="教学画布" className="mf-teaching-canvas">
    <div className="mf-canvas-toolbar"><strong>教学画布</strong><Button className="mf-canvas-close" variant="quiet" onClick={onClose}>收起画布</Button></div>
    <CanvasFeedback {...feedback} />
    {!feedback.error && <p role="status" className="mf-status">正在打开教学画布…</p>}
  </section>;
}
