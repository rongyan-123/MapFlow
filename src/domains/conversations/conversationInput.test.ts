import { describe, expect, it } from 'vitest';
import { parseVocabulary, prepareConversationInput } from './conversationInput';

describe('conversation input budgets', () => {
  it('keeps vocabulary optional and parses one term / optional meaning per line', () => {
    expect(parseVocabulary(' \n')).toBeUndefined();
    expect(parseVocabulary('tea\t茶\nquiet — 安静\nby the way')).toEqual([
      { term: 'tea', meaning: '茶' }, { term: 'quiet', meaning: '安静' }, { term: 'by the way' },
    ]);
    expect(prepareConversationInput({ characterId: 'c', userName: ' 小明 ', vocabulary: [] })).toEqual({ characterId: 'c', userName: '小明' });
  });
  it('rejects excess entries, individual fields and the full 2 KiB UTF-8 vocabulary without truncation', () => {
    for (const vocabulary of [Array.from({ length: 51 }, () => ({ term: 'tea' })), [{ term: 'x'.repeat(81) }],
      [{ term: 'tea', meaning: 'x'.repeat(501) }], Array.from({ length: 3 }, () => ({ term: 'tea', meaning: '中'.repeat(300) }))]) {
      expect(() => prepareConversationInput({ characterId: 'c', userName: '小明', vocabulary })).toThrow(expect.objectContaining({ code: 'tavern.input_too_large' }));
    }
  });
  it('rejects blank names, invalid greeting indexes, excessive persona and counts astral characters correctly', () => {
    for (const input of [{ userName: ' ' }, { userName: 'x'.repeat(81) }, { greetingIndex: -1 }, { greetingIndex: 0.5 }, { persona: '中'.repeat(4001) }]) {
      expect(() => prepareConversationInput({ characterId: 'c', userName: '小明', ...input })).toThrow(expect.objectContaining({ code: expect.stringMatching(/^tavern\./) }));
    }
    expect(prepareConversationInput({ characterId: 'c', userName: '🌙'.repeat(80), persona: '🌙'.repeat(4000) }).persona?.length).toBe(8000);
  });
});
