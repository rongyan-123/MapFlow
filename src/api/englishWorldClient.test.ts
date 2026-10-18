import { afterEach, expect, it, vi } from 'vitest';
import { fetchWorlds, fetchWorldDetail, fetchTask, fetchPlaythrough, fetchHistory, fetchCheckpoints, fetchDebrief, fetchWords, fetchWordDetail, fetchDueReviews, submitWorldMutation } from './englishWorldClient';
import { ewIds, ewWorldList, ewWorldDetail, ewTask, ewPlay, ewHistory, ewCheckpoints, ewDebrief, ewWords, ewWordDetail, ewDue, ewReviewItem, ewTranslation, ewReviewResult } from '../domains/englishWorld/testFixtures';

afterEach(() => vi.unstubAllGlobals());
const operationId = '11111111-1111-4111-8111-111111111111';
const taskId = '22222222-2222-4222-8222-222222222222';
const worldId = '33333333-3333-4333-8333-333333333333';

it('sends one real world creation request with the original action ID, CSRF and no-store', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ operationId, taskId, worldId }));
  vi.stubGlobal('fetch', fetch);
  const input = { clientActionId: operationId, topic: 'An original museum mystery', difficulty: 'intermediate', targetWordCount: 8, funding: 'cash', profileId: worldId, profileVersion: 2 };
  expect(await submitWorldMutation('/worlds', input, 'accepted', 'csrf')).toEqual({ operationId, taskId, worldId });
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledWith('/api/me/english-world/worlds', expect.objectContaining({
    method: 'POST', cache: 'no-store', credentials: 'same-origin',
    headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf' }), body: JSON.stringify(input),
  }));
});

it('reads public worlds and resumable tasks without caching or displaying private diagnostic fields', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json(ewWorldList)).mockResolvedValueOnce(Response.json(ewTask)).mockResolvedValueOnce(Response.json({ ...ewWorldList, content_private: { murderer: 'secret' } }));
  vi.stubGlobal('fetch', fetch);
  expect(await fetchWorlds()).toEqual(ewWorldList);
  expect(await fetchTask(ewIds.task)).toEqual(ewTask);
  await expect(fetchWorlds()).rejects.toThrow('响应无效');
  for (const call of fetch.mock.calls) expect(call[1]).toMatchObject({ cache: 'no-store', credentials: 'same-origin' });
});

it('preserves server word positions and rejects offsets that do not match Unicode code points', async () => {
  const utterance = { ...ewHistory.utterances[0], textEn: '🕯 sealed', tokens: [{ tokenId: ewIds.token, text: 'sealed', start: 2, end: 8, canTranslate: true }] };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ ...ewHistory, utterances: [utterance] })).mockResolvedValueOnce(Response.json({ ...ewHistory, utterances: [{ ...utterance, tokens: [{ ...utterance.tokens[0], start: 3, end: 9 }] }] })));
  expect((await fetchHistory(ewIds.play, ewIds.branch)).utterances[0].tokens[0].start).toBe(2);
  await expect(fetchHistory(ewIds.play, ewIds.branch)).rejects.toThrow('响应无效');
});

it('issues an answer-free server review item and sanitizes closed service failures', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json(ewReviewItem)).mockResolvedValueOnce(Response.json({ ...ewReviewItem, answer: 'secret answer' })).mockResolvedValueOnce(Response.json({ error: { code: 'english_world.disabled', message: 'PRIVATE provider key' } }, { status: 503 }));
  vi.stubGlobal('fetch', fetch);
  expect(await submitWorldMutation('/reviews/items', { clientActionId: operationId, learnerWordId: ewIds.word, modality: 'reading' }, 'reviewItem', 'csrf')).toEqual(ewReviewItem);
  await expect(submitWorldMutation('/reviews/items', { clientActionId: operationId }, 'reviewItem', 'csrf')).rejects.toThrow('响应无效');
  await expect(fetchWorlds()).rejects.toThrow('英语世界暂未开放');
});

it('reads only the English World public endpoints and keeps each mutation result typed', async () => {
  const responses = [ewWorldDetail, ewPlay, ewCheckpoints, ewDebrief, ewWords, ewWordDetail, ewDue, ewTask, ewTranslation, { schemaVersion: 1, operationId, branchId: ewIds.restoredBranch, revision: 2 }, ewReviewResult];
  const fetch = vi.fn().mockImplementation(async () => Response.json(responses.shift()));
  vi.stubGlobal('fetch', fetch);
  expect(await fetchWorldDetail(ewIds.world)).toEqual(ewWorldDetail);
  expect(await fetchPlaythrough(ewIds.play, ewIds.branch)).toEqual(ewPlay);
  expect(await fetchCheckpoints(ewIds.play)).toEqual(ewCheckpoints);
  expect(await fetchDebrief(ewIds.play, ewIds.branch)).toEqual(ewDebrief);
  expect(await fetchWords({ q: 'sealed', filter: 'lookup' })).toEqual(ewWords);
  expect(await fetchWordDetail(ewIds.word)).toEqual(ewWordDetail);
  expect(await fetchDueReviews()).toEqual(ewDue);
  expect(await submitWorldMutation(`/tasks/${ewIds.task}/stop`, { clientActionId: operationId }, 'task', 'csrf')).toEqual(ewTask);
  expect(await submitWorldMutation(`/playthroughs/${ewIds.play}/translations`, { clientActionId: operationId }, 'translation', 'csrf')).toEqual(ewTranslation);
  expect(await submitWorldMutation(`/playthroughs/${ewIds.play}/restores`, { clientActionId: operationId }, 'restore', 'csrf')).toMatchObject({ branchId: ewIds.restoredBranch, revision: 2 });
  expect(await submitWorldMutation('/reviews', { clientActionId: operationId }, 'reviewResult', 'csrf')).toEqual(ewReviewResult);
  expect(fetch.mock.calls.every(([path]) => String(path).startsWith('/api/me/english-world/'))).toBe(true);
  expect(fetch.mock.calls[4][0]).toBe('/api/me/english-world/words?q=sealed&filter=lookup');
});

it('rejects a result bound to a different token, task or review item', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ ...ewTranslation, selectedTokenId: 'a-different-token' }))
    .mockResolvedValueOnce(Response.json({ ...ewTask, taskId: ewIds.world }))
    .mockResolvedValueOnce(Response.json({ ...ewReviewResult, reviewItemId: ewIds.world })));
  await expect(submitWorldMutation(`/playthroughs/${ewIds.play}/translations`, { clientActionId: operationId, tokenId: ewIds.token }, 'translation', 'csrf')).rejects.toThrow('响应无效');
  await expect(submitWorldMutation(`/tasks/${ewIds.task}/stop`, { clientActionId: operationId }, 'task', 'csrf')).rejects.toThrow('响应无效');
  await expect(submitWorldMutation('/reviews', { clientActionId: operationId, reviewItemId: ewIds.review }, 'reviewResult', 'csrf')).rejects.toThrow('响应无效');
});

it('accepts writing review candidates and issued items only with a hidden target lemma', async () => {
  const due = { ...ewDue, items: [{ ...ewDue.items[0], modality: 'writing', lemma: null }] };
  const item = { ...ewReviewItem, modality: 'writing', lemma: null, prompt: '请写出表示“封住的”的英语单词，再自评。' };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(due)).mockResolvedValueOnce(Response.json(item)));
  expect(await fetchDueReviews()).toEqual(due);
  expect(await submitWorldMutation('/reviews/items', { clientActionId: operationId, learnerWordId: ewIds.word, modality: 'writing' }, 'reviewItem', 'csrf')).toEqual(item);
});

it.each(['due', 'item'])('rejects a writing %s response that exposes the target English lemma', async endpoint => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(endpoint === 'due'
    ? { ...ewDue, items: [{ ...ewDue.items[0], modality: 'writing' }] }
    : { ...ewReviewItem, modality: 'writing' })));
  if (endpoint === 'due') await expect(fetchDueReviews()).rejects.toThrow('响应无效');
  else await expect(submitWorldMutation('/reviews/items', { clientActionId: operationId, learnerWordId: ewIds.word, modality: 'writing' }, 'reviewItem', 'csrf')).rejects.toThrow('响应无效');
});

it('keeps the target lemma mandatory for reading review candidates and issued items', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ ...ewDue, items: [{ ...ewDue.items[0], lemma: null }] }))
    .mockResolvedValueOnce(Response.json({ ...ewReviewItem, lemma: null })));
  await expect(fetchDueReviews()).rejects.toThrow('响应无效');
  await expect(submitWorldMutation('/reviews/items', { clientActionId: operationId, learnerWordId: ewIds.word, modality: 'reading' }, 'reviewItem', 'csrf')).rejects.toThrow('响应无效');
});
