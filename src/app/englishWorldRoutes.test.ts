import { expect, it } from 'vitest';
import { resolveRoute } from './routes';

const worldId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';

it('opens each English World address and preserves its explicit branch', () => {
  expect(resolveRoute('/english-world')).toMatchObject({ page: 'english-world', englishWorld: { view: 'home' } });
  expect(resolveRoute('/english-world/prepare/' + worldId)).toMatchObject({ page: 'english-world', englishWorld: { view: 'prepare', taskId: worldId } });
  expect(resolveRoute('/english-world/worlds/' + worldId)).toMatchObject({ page: 'english-world', englishWorld: { view: 'world', worldId } });
  expect(resolveRoute(`/english-world/play/${worldId}?branch=${branchId}`)).toMatchObject({ page: 'english-world', englishWorld: { view: 'play', playthroughId: worldId, branchId } });
  for (const view of ['words', 'review']) expect(resolveRoute('/english-world/' + view)).toMatchObject({ page: 'english-world', englishWorld: { view } });
});

it('keeps malformed English World addresses inside a safe unavailable view', () => {
  for (const address of ['/english-world/play/not-an-id', `/english-world/play/${worldId}?branch=%00`, '/english-world/unknown']) {
    expect(resolveRoute(address)).toMatchObject({ page: 'english-world', englishWorld: { view: 'not-found' } });
  }
  expect(resolveRoute('/english-world-other').page).toBe('assistant');
});
