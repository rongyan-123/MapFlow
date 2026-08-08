import { useEffect } from 'react';
import type { SkillNode } from '../../types/learning';

interface CompletionFlashProps {
  node: SkillNode;
  onComplete: () => void;
}

const VERDICT_CHARS = ['此', '间', '事', '了'];

export default function CompletionFlash({ node, onComplete }: CompletionFlashProps) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 2600);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="completion-flash fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      <div className="completion-flash__glow" />
      <div className="completion-flash__slash" />
      <div className="completion-flash__slash-diag" />
      <div className="completion-flash__content text-center">
        <span className="completion-flash__kicker">{node.category} · Node Complete</span>
        <div className="completion-flash__verdict" aria-hidden>
          {VERDICT_CHARS.map((char, index) => (
            <span key={char} className={`completion-flash__verdict-char verdict-${index + 1}`}>
              {char}
            </span>
          ))}
        </div>
        <h2 className="completion-flash__title">{node.title}</h2>
      </div>
    </div>
  );
}
