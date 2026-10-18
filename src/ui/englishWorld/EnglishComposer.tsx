import { useRef } from 'react';
import { Button } from '../Button';
import { Icon } from '../Icon';

export function EnglishComposer({ draft, onChange, onSend, disabled, waiting }: { draft: string; onChange: (text: string) => void; onSend: () => void; disabled: boolean; waiting: boolean }) {
  const composing = useRef(false);
  function send() { if (!composing.current && !disabled && draft.trim()) onSend(); }
  return <div className="ew-composer-area"><form className="ew-composer" onSubmit={event => { event.preventDefault(); send(); }}>
    <label htmlFor="ew-action">用英文回答</label><textarea id="ew-action" aria-label="用英文回答" rows={2} maxLength={8000} disabled={disabled} value={draft} placeholder="What will you say or do?" lang="en" onChange={event => onChange(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !composing.current && event.keyCode !== 229 && window.innerWidth >= 768) { event.preventDefault(); send(); } }} />
    <div className="ew-composer-bottom"><small>{waiting ? '正在核对本次行动，请稍候。' : '世界会根据你实际表达的意思判断行动。'}</small><Button type="submit" variant="primary" aria-label="发送行动" disabled={disabled || !draft.trim()}><Icon name="arrow" /><span>{waiting ? '处理中' : '发送'}</span></Button></div>
  </form></div>;
}
