import { Fragment, type ReactNode } from 'react';
import type { Utterance as PublicUtterance, WordToken } from '../../domains/englishWorld/types';

export function Utterance({ utterance, disabled, onWord }: { utterance: PublicUtterance; disabled: boolean; onWord: (word: WordToken) => void }) {
  const points = Array.from(utterance.textEn);
  const pieces: ReactNode[] = [];
  let cursor = 0;
  for (const token of utterance.tokens) {
    if (token.start > cursor) pieces.push(points.slice(cursor, token.start).join(''));
    const selected = utterance.translationUse?.selectedTokenId === token.tokenId;
    const available = utterance.speakerKind === 'npc' && token.canTranslate && !utterance.translationUse;
    pieces.push(available || selected ? <button key={token.tokenId} type="button" className={`ew-token${selected ? ' is-selected' : ''}`} aria-label={selected ? `查看 ${token.text} 的翻译` : `翻译 ${token.text}`} disabled={disabled && !selected} onClick={() => onWord(token)}>{token.text}</button> : <Fragment key={token.tokenId}>{token.text}</Fragment>);
    cursor = token.end;
  }
  if (cursor < points.length) pieces.push(points.slice(cursor).join(''));
  return <article className={`ew-utterance ew-utterance--${utterance.speakerKind}`} aria-label={`${utterance.speakerName}的台词`}>
    <header><span className="ew-speaker">{utterance.speakerName}</span><span>{utterance.speakerKind === 'npc' ? utterance.translationUse ? '本段已选词' : '本段可查 1 词' : '旁白'}</span></header>
    <p className="ew-english" lang="en">{pieces}</p>
    {utterance.translationUse && <p className="ew-gloss">{utterance.translationUse.status === 'ready' ? utterance.translationUse.glossZh : utterance.translationUse.status === 'outcome_unknown' ? '这个词已被选择，原查询结果待核对。' : utterance.translationUse.status === 'failed' ? '这个词已被选择，查询尚未完成。' : '这个词已被选择，正在查询…'}</p>}
  </article>;
}
