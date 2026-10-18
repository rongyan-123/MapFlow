import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { IdentityProvider, SESSION_QUERY_KEY } from '../domains/identity/IdentityContext';
import { AgentModelProvider } from '../domains/models/AgentModelContext';
import { ModelSelectionProvider } from '../domains/models/ModelSelectionContext';
import type { EnglishWorldRoute } from '../app/routes';
import { ewAccepted, ewIds, ewWorldList, ewWorldDetail, ewTask, ewPlay, ewHistory, ewTranslation, ewCheckpoints, ewDebrief, ewWords, ewWordDetail, ewDue, ewReviewItem, ewReviewResult } from '../domains/englishWorld/testFixtures';
import EnglishWorldPage from './EnglishWorldPage';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });
const profile = { profileId: ewIds.version, profileVersion: 2, modelId: 'live-cash-model', displayName: '真实目录模型', contextWindow: 128000, maxOutputTokens: 8000 };
type Handler = (path: string, options?: RequestInit) => Response | Promise<Response> | undefined;
function mount(route: EnglishWorldRoute, handler: Handler = () => undefined) {
  const requests: { path: string; options?: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (address: string, options?: RequestInit) => {
    const path = String(address); requests.push({ path, options });
    const override = await handler(path, options); if (override) return override;
    if (path === '/api/me/agent-models') return Response.json({ cash: [profile], defaultCash: profile, points: null });
    if (path === '/api/me/english-world/worlds') return Response.json(options?.method === 'POST' ? ewAccepted : ewWorldList);
    return Response.json({}, { status: 503 });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(SESSION_QUERY_KEY, { account: { playerId: 'english-player', username: '玩家', status: 'active', isAdmin: false }, csrfToken: 'csrf' });
  const navigate = vi.fn();
  function Providers({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={client}><IdentityProvider><AgentModelProvider accountId="english-player"><ModelSelectionProvider accountId="english-player">{children}</ModelSelectionProvider></AgentModelProvider></IdentityProvider></QueryClientProvider>; }
  const view = render(<Providers><EnglishWorldPage route={route} navigate={navigate} /></Providers>);
  return { ...view, requests, navigate, client };
}

it('opens the live world catalogue and creates a preparation task using the real selected model', async () => {
  const page = mount({ view: 'home' });
  await screen.findByRole('heading', { name: '博物馆之夜' });
  fireEvent.click(screen.getByRole('button', { name: '创建世界' }));
  const dialog = screen.getByRole('dialog', { name: '创建英语世界' });
  fireEvent.change(within(dialog).getByLabelText('世界题材'), { target: { value: 'An original lighthouse mystery' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '确认并开始准备' }));
  await waitFor(() => expect(page.navigate).toHaveBeenCalledWith('/english-world/prepare/' + ewIds.task));
  const creation = page.requests.find(request => request.path === '/api/me/english-world/worlds' && request.options?.method === 'POST');
  expect(JSON.parse(String(creation?.options?.body))).toMatchObject({ topic: 'An original lighthouse mystery', funding: 'cash', profileId: ewIds.version, profileVersion: 2, targetWordCount: 8 });
  expect(page.requests.some(request => /tavern|learning-areas|agent-executions|canvas/.test(request.path))).toBe(false);
});

it('restores preparation by GET and stops the same task without creating another world', async () => {
  const page = mount({ view: 'prepare', taskId: ewIds.task }, (path, options) => {
    if (path === `/api/me/english-world/tasks/${ewIds.task}`) return Response.json(ewTask);
    if (path === `/api/me/english-world/tasks/${ewIds.task}/stop`) return Response.json({ ...ewTask, state: 'stopped', allowedActions: { canCheck: true, canStop: false, canResume: false, needsCredential: false } });
    return undefined;
  });
  const progress = await screen.findByRole('progressbar', { name: '任务进度' });
  expect(progress).toHaveAttribute('value', '0.4');
  expect(page.requests.filter(request => request.options?.method === 'POST')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: '停止任务' }));
  await screen.findByText('任务已停止');
  const writes = page.requests.filter(request => request.options?.method === 'POST');
  expect(writes).toHaveLength(1);
  expect(writes[0].path).toBe(`/api/me/english-world/tasks/${ewIds.task}/stop`);
});

it('starts a saved ready version as a separate playthrough with the chosen funding', async () => {
  const page = mount({ view: 'world', worldId: ewIds.world }, (path, options) => {
    if (path === `/api/me/english-world/worlds/${ewIds.world}`) return Response.json(ewWorldDetail);
    if (path === `/api/me/english-world/worlds/${ewIds.world}/playthroughs` && options?.method === 'POST') return Response.json({ ...ewAccepted, playthroughId: ewIds.play, branchId: ewIds.branch });
    return undefined;
  });
  fireEvent.click(await screen.findByRole('button', { name: '开始游玩' }));
  await waitFor(() => expect(page.navigate).toHaveBeenCalledWith(`/english-world/play/${ewIds.play}?branch=${ewIds.branch}`));
  const start = page.requests.find(request => request.path.endsWith('/playthroughs'));
  expect(JSON.parse(String(start?.options?.body))).toMatchObject({ worldVersionId: ewIds.version, funding: 'cash', profileVersion: 2 });
});

it('confirms a server token before lookup and retains its one-word choice', async () => {
  let translated = false;
  const page = mount({ view: 'play', playthroughId: ewIds.play, branchId: ewIds.branch }, (path, options) => {
    if (path.includes('/history')) return Response.json({ ...ewHistory, utterances: ewHistory.utterances.map(utterance => ({ ...utterance, translationUse: translated ? { selectedTokenId: ewIds.token, status: 'ready', glossZh: '封住的' } : null })) });
    if (path.split('?')[0] === `/api/me/english-world/playthroughs/${ewIds.play}`) return Response.json(ewPlay);
    if (path.endsWith('/translations') && options?.method === 'POST') { translated = true; return Response.json(ewTranslation); }
    return undefined;
  });
  fireEvent.click(await screen.findByRole('button', { name: '翻译 sealed' }));
  expect(page.requests.filter(request => request.options?.method === 'POST')).toHaveLength(0);
  const confirmation = screen.getByRole('dialog', { name: '查这个词' });
  expect(within(confirmation).getByText('本段还可翻译 1 个词。确认后不能换词。')).toBeVisible();
  fireEvent.click(within(confirmation).getByRole('button', { name: '确认翻译' }));
  await screen.findByText('封住的');
  const lookup = page.requests.find(request => request.path.endsWith('/translations'));
  expect(JSON.parse(String(lookup?.options?.body))).toMatchObject({ branchId: ewIds.branch, utteranceId: ewIds.utterance, tokenId: ewIds.token });
  expect(page.requests.filter(request => request.options?.method === 'POST')).toHaveLength(1);
});

it('does not send during IME composition and keeps a model failure separate from player death', async () => {
  const page = mount({ view: 'play', playthroughId: ewIds.play, branchId: ewIds.branch }, (path, options) => {
    if (path.includes('/history')) return Response.json(ewHistory);
    if (path.split('?')[0] === `/api/me/english-world/playthroughs/${ewIds.play}`) return Response.json(ewPlay);
    if (path.endsWith('/turns') && options?.method === 'POST') return Response.json({ ...ewAccepted, turnId: ewIds.turn, playthroughId: ewIds.play, branchId: ewIds.branch });
    if (path === `/api/me/english-world/tasks/${ewIds.task}`) return Response.json({ ...ewTask, state: 'failed', publicError: { code: 'server.network_unavailable', message: 'PRIVATE HOST OUTPUT' }, allowedActions: { canCheck: true, canStop: false, canResume: false, needsCredential: false } });
    return undefined;
  });
  const input = await screen.findByRole('textbox', { name: '用英文回答' });
  await screen.findByRole('button', { name: '翻译 sealed' });
  fireEvent.change(input, { target: { value: 'I inspect the envelope.' } });
  fireEvent.compositionStart(input);
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  fireEvent.submit(input.closest('form')!);
  expect(page.requests.filter(request => request.options?.method === 'POST')).toHaveLength(0);
  fireEvent.compositionEnd(input);
  fireEvent.click(screen.getByRole('button', { name: '发送行动' }));
  await screen.findByText('任务未完成');
  expect(screen.queryByText('本条路线已死亡')).not.toBeInTheDocument();
  expect(screen.queryByText('PRIVATE HOST OUTPUT')).not.toBeInTheDocument();
  expect(input).toBeEnabled();
  const turn = page.requests.find(request => request.path.endsWith('/turns'));
  expect(JSON.parse(String(turn?.options?.body))).toMatchObject({ text: 'I inspect the envelope.', branchId: ewIds.branch, expectedRevision: 1 });
});

it('locks a dead route, reads its debrief and restores into the returned new branch', async () => {
  const page = mount({ view: 'play', playthroughId: ewIds.play, branchId: ewIds.branch }, (path, options) => {
    if (path.includes('/history')) return Response.json(ewHistory);
    if (path.includes('/debrief')) return Response.json(ewDebrief);
    if (path.endsWith('/checkpoints')) return Response.json(ewCheckpoints);
    if (path.endsWith('/restores') && options?.method === 'POST') return Response.json({ schemaVersion: 1, operationId: ewIds.operation, branchId: ewIds.restoredBranch, revision: 0 });
    if (path.split('?')[0] === `/api/me/english-world/playthroughs/${ewIds.play}`) return Response.json({ ...ewPlay, branchStatus: 'dead', allowedActions: { canAct: false, canRestore: true, canReadDebrief: true } });
    return undefined;
  });
  await screen.findByText('你违反了封门规则。');
  expect(screen.getByRole('textbox', { name: '用英文回答' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '从存档继续' }));
  const dialog = await screen.findByRole('dialog', { name: '存档与回档' });
  expect(within(dialog).getByText(/回档会创建新分支/)).toBeVisible();
  fireEvent.click(await within(dialog).findByRole('button', { name: '从这里继续' }));
  await waitFor(() => expect(page.navigate).toHaveBeenCalledWith(`/english-world/play/${ewIds.play}?branch=${ewIds.restoredBranch}`));
  const restore = page.requests.find(request => request.path.endsWith('/restores'));
  expect(JSON.parse(String(restore?.options?.body))).toMatchObject({ checkpointId: ewIds.checkpoint, expectedBranchId: ewIds.branch, expectedRevision: 1 });
});

it('keeps locked word meanings hidden and links only to the server-provided occurrence route', async () => {
  const lockedWord = { ...ewWords.words[0], glossZh: null };
  const page = mount({ view: 'words' }, path => {
    if (path === `/api/me/english-world/words/${ewIds.word}`) return Response.json({ ...ewWordDetail, word: lockedWord });
    if (path.startsWith('/api/me/english-world/words?')) return Response.json({ ...ewWords, words: [lockedWord] });
    return undefined;
  });
  await screen.findByRole('heading', { name: 'sealed' });
  expect(screen.queryByText('封住的')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '查看词条 sealed' }));
  const dialog = screen.getByRole('dialog', { name: 'sealed' });
  fireEvent.click(await within(dialog).findByRole('button', { name: '回到故事出处' }));
  expect(page.navigate).toHaveBeenCalledWith(`/english-world/play/${ewIds.play}?branch=${ewIds.branch}`);
  expect(screen.queryByText('封住的')).not.toBeInTheDocument();
});

it('issues a review only on request, saves self-rating and hint use, and does not score again on refresh', async () => {
  const handler: Handler = (path, options) => {
    if (path === '/api/me/english-world/reviews/due') return Response.json(ewDue);
    if (path === '/api/me/english-world/reviews/items' && options?.method === 'POST') return Response.json(ewReviewItem);
    if (path === '/api/me/english-world/reviews' && options?.method === 'POST') return Response.json(ewReviewResult);
    return undefined;
  };
  const page = mount({ view: 'review' }, handler);
  fireEvent.click(await screen.findByRole('button', { name: '选择阅读识别' }));
  fireEvent.click(await screen.findByRole('button', { name: '开始阅读复习 sealed' }));
  await screen.findByText(ewReviewItem.prompt);
  expect(screen.queryByText('封住的')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '你的回忆' }), { target: { value: 'Something closed tightly.' } });
  fireEvent.click(screen.getByRole('checkbox', { name: '本次看过提示或词义' }));
  fireEvent.click(screen.getByRole('radio', { name: '想起来了' }));
  fireEvent.click(screen.getByRole('button', { name: '提交本次回忆' }));
  await screen.findByText('封住的');
  const writes = page.requests.filter(request => request.options?.method === 'POST');
  expect(writes).toHaveLength(2);
  expect(JSON.parse(String(writes[1].options?.body))).toMatchObject({ reviewItemId: ewIds.review, answer: 'Something closed tightly.', rating: 3, usedHint: true });
  page.unmount();
  const refreshed = mount({ view: 'review' }, handler);
  await screen.findByText('封住的');
  expect(refreshed.requests.filter(request => request.options?.method === 'POST')).toHaveLength(0);
});

it('chooses a review direction before showing candidates and never passively reveals a writing answer', async () => {
  const writing = { ...ewReviewItem, modality: 'writing', lemma: null, prompt: '请写出表示“封住的”的英语单词，再自评。' };
  const page = mount({ view: 'review' }, (path, options) => {
    if (path === '/api/me/english-world/reviews/due') return Response.json({ ...ewDue, items: [ewDue.items[0], { ...ewDue.items[0], modality: 'writing', lemma: null }], dueCount: 2 });
    if (path === '/api/me/english-world/reviews/items' && options?.method === 'POST') return Response.json(writing);
    if (path === '/api/me/english-world/reviews' && options?.method === 'POST') return Response.json(ewReviewResult);
    return undefined;
  });
  await screen.findByRole('heading', { name: '待复习词语 · 2' });
  expect(screen.queryByText('sealed')).not.toBeInTheDocument();
  expect(page.requests.some(request => request.options?.method === 'POST')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '选择主动表达' }));
  expect(screen.queryByText('sealed')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /开始阅读复习/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '开始表达复习 第 1 题' }));
  await screen.findByText(writing.prompt);
  expect(screen.getByRole('heading', { name: '回忆英文表达' })).toBeVisible();
  expect(screen.queryByText('sealed')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /sealed/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /待复习词语/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '你的回忆' }), { target: { value: 'sealed' } });
  fireEvent.click(screen.getByRole('button', { name: '提交本次回忆' }));
  await screen.findByText('封住的');
  const writes = page.requests.filter(request => request.options?.method === 'POST');
  expect(writes).toHaveLength(2);
  expect(JSON.parse(String(writes[0].options?.body))).toMatchObject({ learnerWordId: ewIds.word, modality: 'writing' });
  expect(JSON.parse(String(writes[1].options?.body))).toMatchObject({ reviewItemId: ewIds.review, answer: 'sealed', rating: 3, usedHint: false });
});

it('reveals a reserved translation only after the original task commits it', async () => {
  let ready = false;
  const page = mount({ view: 'play', playthroughId: ewIds.play, branchId: ewIds.branch }, (path, options) => {
    if (path.includes('/history')) return Response.json({ ...ewHistory, utterances: ewHistory.utterances.map(utterance => ({ ...utterance, translationUse: ready ? { selectedTokenId: ewIds.token, status: 'ready', glossZh: '封住的' } : null })) });
    if (path.split('?')[0] === `/api/me/english-world/playthroughs/${ewIds.play}`) return Response.json(ewPlay);
    if (path.endsWith('/translations') && options?.method === 'POST') return Response.json({ ...ewTranslation, status: 'reserved', glossZh: null, taskId: ewIds.task });
    if (path === `/api/me/english-world/tasks/${ewIds.task}`) { ready = true; return Response.json({ ...ewTask, state: 'completed', progress: 1, allowedActions: { canCheck: true, canStop: false, canResume: false, needsCredential: false } }); }
    return undefined;
  });
  fireEvent.click(await screen.findByRole('button', { name: '翻译 sealed' }));
  fireEvent.click(screen.getByRole('button', { name: '确认翻译' }));
  await screen.findByText('封住的');
  expect(page.requests.filter(request => request.options?.method === 'POST')).toHaveLength(1);
});

it.each(['pending_evidence', 'unknown'])('invalidates real wallet and credit data while keeping %s fees pending', async status => {
  const page = mount({ view: 'prepare', taskId: ewIds.task }, path => path === `/api/me/english-world/tasks/${ewIds.task}` ? Response.json({ ...ewTask, state: 'completed', progress: 1, settlement: { status, cashMicros: null, pointUnits: null, balanceMicros: null } }) : undefined);
  const walletKey = ['me', 'english-player', 'wallet'];
  const creditKey = ['me', 'english-player', 'credit'];
  page.client.setQueryData(walletKey, { balanceMicros: 1230000 });
  page.client.setQueryData(creditKey, { balance: 7 });
  await screen.findByText('结果已保存，费用待核账。');
  await waitFor(() => expect(page.client.getQueryState(creditKey)?.isInvalidated).toBe(true));
  expect(page.client.getQueryState(walletKey)?.isInvalidated).toBe(true);
  expect(page.client.getQueryData(creditKey)).toEqual({ balance: 7 });
  expect(page.client.getQueryData(walletKey)).toEqual({ balanceMicros: 1230000 });
});

it('keeps a historical branch read-only while allowing return to the active route', async () => {
  const page = mount({ view: 'play', playthroughId: ewIds.play, branchId: ewIds.branch }, path => {
    if (path.includes('/history')) return Response.json(ewHistory);
    if (path.split('?')[0] === `/api/me/english-world/playthroughs/${ewIds.play}`) return Response.json({ ...ewPlay, activeBranchId: ewIds.restoredBranch, branchStatus: 'abandoned', allowedActions: { canAct: false, canRestore: false, canReadDebrief: false } });
    return undefined;
  });
  expect(await screen.findByRole('button', { name: '翻译 sealed' })).toBeDisabled();
  expect(screen.getByRole('textbox', { name: '用英文回答' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '回到当前路线' }));
  expect(page.navigate).toHaveBeenCalledWith(`/english-world/play/${ewIds.play}?branch=${ewIds.restoredBranch}`);
  expect(page.requests.filter(request => request.options?.method === 'POST')).toHaveLength(0);
});

it('refreshes real funding data when a stopped task has a settlement', async () => {
  const page = mount({ view: 'prepare', taskId: ewIds.task }, path => path === `/api/me/english-world/tasks/${ewIds.task}` ? Response.json({ ...ewTask, state: 'stopped', allowedActions: { canCheck: true, canStop: false, canResume: false, needsCredential: false }, settlement: { status: 'settled', cashMicros: 1000000, pointUnits: null, balanceMicros: null } }) : undefined);
  const walletKey = ['me', 'english-player', 'wallet'];
  page.client.setQueryData(walletKey, { balanceMicros: 1230000 });
  await screen.findByText('任务已停止');
  await waitFor(() => expect(page.client.getQueryState(walletKey)?.isInvalidated).toBe(true));
  expect(page.client.getQueryData(walletKey)).toEqual({ balanceMicros: 1230000 });
});

it('keeps the server chronology when inherited and new branches reuse local sequence numbers', async () => {
  mount({ view: 'play', playthroughId: ewIds.play, branchId: ewIds.branch }, path => {
    if (path.includes('/history')) return Response.json({ ...ewHistory, utterances: [{ ...ewHistory.utterances[0], utteranceId: ewIds.world, sequence: 5, textEn: 'Before the checkpoint.', tokens: [] }, { ...ewHistory.utterances[0], sequence: 1, textEn: 'After the checkpoint.', tokens: [] }] });
    if (path.split('?')[0] === `/api/me/english-world/playthroughs/${ewIds.play}`) return Response.json(ewPlay);
    return undefined;
  });
  await screen.findByText('After the checkpoint.');
  const lines = screen.getAllByRole('article', { name: 'Mara的台词' });
  expect(lines[0]).toHaveTextContent('Before the checkpoint.');
  expect(lines[1]).toHaveTextContent('After the checkpoint.');
});
