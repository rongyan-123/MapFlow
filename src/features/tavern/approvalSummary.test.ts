import { expect, it } from 'vitest';
import { approvalSummary } from './approvalSummary';

it('previews the exact note and version with a separate overwrite confirmation', () => {
  const summary = approvalSummary({ approvalRequestId: 'note-1', action: '覆盖节点笔记', target: '当前个人树', mapTitle: 'Python', destructive: true,
    proposal: { operation: 'save_note', targetId: 'node-1', revision: 3, patch: { expectedVersion: 2, markdown: '完整的新内容\n包括第二行' } } });
  expect(summary).toContain('请单独确认');
  expect(summary).toContain('笔记版本：2');
  expect(summary).toContain('笔记内容：完整的新内容\n包括第二行');
  expect(summary).toContain('修改目标：node-1');
});

it('previews the observed progress and proposed value separately', () => {
  const summary = approvalSummary({ approvalRequestId: 'progress-1', action: '修改节点进度', target: 'Python', destructive: false,
    proposal: { operation: 'set_progress', targetId: 'node-1', revision: 3, patch: { expectedPercent: 30, progressPercent: 65 } } });
  expect(summary).toContain('原进度：30');
  expect(summary).toContain('新进度：65');
});
