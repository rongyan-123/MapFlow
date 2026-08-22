import { useEffect, useRef } from 'react';
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
} from 'react';

export const DEFAULT_CHAT_WIDTH = 460;
export const MIN_CHAT_WIDTH = 360;
export const MAX_CHAT_WIDTH = 720;
const KEYBOARD_RESIZE_STEP = 16;

interface ResizableChatPaneProps {
  width: number;
  onWidthChange: (width: number) => void;
  children: ReactNode;
  className?: string;
  hidden?: boolean;
  testId?: string;
}

interface DragState {
  startX: number;
  startWidth: number;
}

export default function ResizableChatPane({
  width,
  onWidthChange,
  children,
  className = '',
  hidden = false,
  testId,
}: ResizableChatPaneProps) {
  const dragStateRef = useRef<DragState | null>(null);

  useEffect(() => {
    function handlePointerMove(event: globalThis.PointerEvent) {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      updateWidth(event.clientX);
    }

    function handleMouseMove(event: globalThis.MouseEvent) {
      updateWidth(event.clientX);
    }

    function updateWidth(clientX: number) {
      const dragState = dragStateRef.current;
      if (!dragState || !Number.isFinite(clientX)) return;

      onWidthChange(clampChatWidth(dragState.startWidth - (clientX - dragState.startX)));
    }

    function stopDragging() {
      dragStateRef.current = null;
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
    };
  }, [onWidthChange]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== undefined && event.button !== 0) return;
    if (!Number.isFinite(event.clientX)) return;
    event.preventDefault();
    dragStateRef.current = { startX: event.clientX, startWidth: width };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (!Number.isFinite(event.clientX)) return;
    event.preventDefault();
    dragStateRef.current = { startX: event.clientX, startWidth: width };
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let nextWidth: number | null = null;
    if (event.key === 'ArrowLeft') nextWidth = width + KEYBOARD_RESIZE_STEP;
    if (event.key === 'ArrowRight') nextWidth = width - KEYBOARD_RESIZE_STEP;
    if (event.key === 'Home') nextWidth = MIN_CHAT_WIDTH;
    if (event.key === 'End') nextWidth = MAX_CHAT_WIDTH;
    if (nextWidth === null) return;

    event.preventDefault();
    onWidthChange(clampChatWidth(nextWidth));
  }

  const style = {
    '--knowledge-chat-width': `${width}px`,
  } as CSSProperties;

  return (
    <div
      data-testid={testId}
      hidden={hidden}
      style={style}
      className={`relative min-h-0 w-full flex-1 lg:flex-none lg:flex-row lg:[width:var(--knowledge-chat-width)] ${className}`}
    >
      <div
        role="separator"
        aria-label="调整聊天面板宽度"
        aria-orientation="vertical"
        aria-valuemin={MIN_CHAT_WIDTH}
        aria-valuemax={MAX_CHAT_WIDTH}
        aria-valuenow={Math.round(width)}
        aria-valuetext={`${Math.round(width)}px`}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        className="hidden w-2 shrink-0 cursor-col-resize items-center justify-center border-l border-slate-800 bg-slate-950/60 transition hover:bg-cyan-400/10 focus:bg-cyan-400/10 focus:outline-none lg:flex"
      >
        <span aria-hidden="true" className="h-10 w-px rounded-full bg-slate-700" />
      </div>
      {children}
    </div>
  );
}

function clampChatWidth(width: number): number {
  return Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, Math.round(width)));
}
