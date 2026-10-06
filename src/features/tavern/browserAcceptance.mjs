// Frontend browser smoke with a deterministic HTTP contract. This is NOT live backend/LLM acceptance.
// Usage: TAVERN_CARD_FIXTURE=/outside/repo/default_Seraphina.png node src/features/tavern/browserAcceptance.mjs
// Optional: TAVERN_BASE_URL, TAVERN_PLAYWRIGHT_MODULE (module URL), TAVERN_SCREENSHOTS (external directory).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const { chromium } = await import(process.env.TAVERN_PLAYWRIGHT_MODULE || 'playwright');
const baseUrl = process.env.TAVERN_BASE_URL || 'http://127.0.0.1:5186';
assert(['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname), 'Use a local frontend');
assert(process.env.TAVERN_CARD_FIXTURE, 'Provide the external pinned PNG path');
const fixturePath = resolve(process.env.TAVERN_CARD_FIXTURE);
const fixture = await readFile(fixturePath);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(fixture), '8a71e8270f54fafbccf905b1bdf053a6a55f57bea89c01fcd8c0e87ee76a2d52');
const screenshotDirectory = process.env.TAVERN_SCREENSHOTS;
if (screenshotDirectory) await mkdir(screenshotDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(10_000);
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
const characters = [];
const conversations = [];
const histories = new Map();
const attempts = [];
let signedIn = false;
let failNextTurn = false;
let streamRelease;
const account = { playerId: 'frontend-acceptance', username: 'Traveler', status: 'active', isAdmin: false };
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const event = (name, payload) => `event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`;
await page.route('**/api/**', async route => {
  try {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const method = request.method();
  if (path === '/api/auth/session') return json(route, signedIn ? { account, csrfToken: 'smoke-csrf' } : {}, signedIn ? 200 : 401);
  if (path === '/api/announcements') return json(route, { announcements: [] });
  if (path === '/api/auth/login') { signedIn = true; return json(route, { account, csrfToken: 'smoke-csrf' }); }
  if (path === '/api/capabilities') return json(route, { identity: { registrationEnabled: false }, generation: {
    enabled: true, platformFundedEnabled: true, models: ['deepseek-v4-flash', 'deepseek-v4-pro'], thinkingModes: ['disabled', 'enabled'], reasoningEfforts: ['low', 'high', 'max'],
  } });
  if (path === '/api/credit/me') return json(route, { balance: 10, signedInToday: true, freeRemaining: 0, pricePerTree: 1 });
  if (method === 'POST' || method === 'DELETE') assert.equal(request.headers()['x-csrf-token'], 'smoke-csrf');
  if (path === '/api/me/tavern/characters' && method === 'POST') {
    const form = await new Response(request.postDataBuffer(), { headers: request.headers() }).formData();
    const card = JSON.parse(form.get('normalized_card'));
    // CDP omits uploaded binary bytes from postData; the browser file bytes are checked below.
    assert.equal(form.get('source_file').name, 'default_Seraphina.png');
    assert.equal(card.schemaVersion, 1); assert.equal(card.name, 'Seraphina');
    assert.equal(card.lorebook.length, 4); assert(card.warnings.length <= 256);
    const character = { characterId: 'seraphina', card, sourceHash: hash(fixture), normalizedHash: hash(JSON.stringify(card)), avatarUrl: '/api/me/tavern/characters/seraphina/avatar', createdAt: '2026-09-22T00:00:00Z' };
    characters.push(character); return json(route, character);
  }
  if (path === '/api/me/tavern/characters') return json(route, { characters });
  if (path.endsWith('/avatar')) return route.fulfill({ contentType: 'image/png', body: fixture });
  if (path === '/api/me/tavern/conversations' && method === 'POST') {
    const input = request.postDataJSON();
    const card = characters[0].card;
    const opening = [card.firstMessage, ...card.alternateGreetings][input.greetingIndex || 0];
    const conversation = { conversationId: `conversation-${conversations.length + 1}`, characterId: 'seraphina', title: `Seraphina ${conversations.length + 1}`, userName: input.userName,
      persona: input.persona || '', vocabulary: input.vocabulary || null,
      openingMessage: opening.replace(/\{\{(char|user)\}\}/g, (_, token) => token === 'char' ? card.name : input.userName), createdAt: '2026-09-22T00:00:00Z' };
    conversations.push(conversation); histories.set(conversation.conversationId, []); return json(route, conversation);
  }
  if (path === '/api/me/tavern/conversations') return json(route, { conversations });
  const match = /^\/api\/me\/tavern\/conversations\/([^/]+)(\/turns)?$/.exec(path);
  if (match) {
    const conversation = conversations.find(item => item.conversationId === match[1]);
    const turns = histories.get(match[1]);
    if (method === 'GET') return json(route, { conversation, character: characters[0], turns });
    const input = request.postDataJSON(); attempts.push(input);
    if (failNextTurn) {
      failNextTurn = false;
      return route.fulfill({ contentType: 'text/event-stream', body: event('delta', { delta: 'Unconfirmed draft' }) + event('error', { code: 'tavern.runtime_unavailable', message: 'Temporary stream failure', httpStatus: 503, traceId: 'smoke-trace' }) });
    }
    if (streamRelease) await new Promise(resolveStream => { streamRelease = resolveStream; });
    const previous = turns.find(turn => turn.clientTurnId === input.clientTurnId);
    const turn = previous || { turnId: `${match[1]}-${turns.length + 1}`, clientTurnId: input.clientTurnId, userMessage: input.message,
      assistantMessage: `The forest canopy shelters the mossy path. Reply ${turns.length + 1}.`, usage: { inputTokens: 20, outputTokens: 10, cacheHitInputTokens: 0, cacheMissInputTokens: 20 }, chargedCreditUnits: 200, createdAt: '2026-09-22T00:01:00Z' };
    if (!previous) turns.push(turn);
    return route.fulfill({ contentType: 'text/event-stream', body: event('started', {}) + event('delta', { delta: turn.assistantMessage }) + event('completed', { turn, creditBalance: 9.9998, chargedCredits: 0.0002, idempotencyHit: !!previous }) });
  }
  throw new Error(`Unexpected smoke endpoint ${method} ${path}`);
  } catch (error) {
    pageErrors.push(error.message);
    console.error(error.message);
    await json(route, { error: { code: 'smoke.contract_failed', message: error.message } }, 500);
  }
});

async function screenshot(name) {
  if (screenshotDirectory) await page.screenshot({ path: resolve(screenshotDirectory, name), fullPage: true });
}
async function noOverflow(label) {
  const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
    main: document.querySelector('main')?.scrollWidth, mainWidth: document.querySelector('main')?.clientWidth,
    log: document.querySelector('[role=log]')?.scrollWidth, logWidth: document.querySelector('[role=log]')?.clientWidth }));
  assert(size.document <= size.viewport, `${label}: page overflow ${JSON.stringify(size)}`);
  assert(size.main <= size.mainWidth, `${label}: main overflow ${JSON.stringify(size)}`);
  if (size.log) assert(size.log <= size.logWidth, `${label}: message overflow ${JSON.stringify(size)}`);
}
try {
  await page.goto(`${baseUrl}/tavern`);
  await page.getByTestId('identity-gate').waitFor();
  await page.getByLabel('用户名', { exact: true }).fill('Traveler');
  await page.getByLabel('密码', { exact: true }).fill('smoke-password');
  await page.getByTestId('identity-gate').getByRole('button', { name: '登录', exact: true }).last().click();
  await page.getByRole('heading', { name: '酒馆', exact: true }).waitFor();
  console.log('Browser: authenticated /tavern');
  assert.equal(new URL(page.url()).pathname, '/tavern');
  await page.getByRole('button', { name: '导入角色卡', exact: true }).click();
  await page.getByLabel('选择 PNG 或 JSON 角色卡').setInputFiles(fixturePath);
  const selectedHash = await page.getByLabel('选择 PNG 或 JSON 角色卡').evaluate(async input => {
    const digest = await crypto.subtle.digest('SHA-256', await input.files[0].arrayBuffer());
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  });
  assert.equal(selectedHash, hash(fixture));
  const preview = page.getByRole('region', { name: '导入预览' });
  await preview.getByRole('heading', { name: 'Seraphina' }).waitFor();
  assert((await preview.innerText()).includes('4 条启用的基础世界书'));
  assert.equal(characters.length, 0);
  await page.waitForFunction(() => document.querySelector('[aria-label="导入预览"] img')?.naturalWidth > 0);
  await screenshot('tavern-seraphina-preview-desktop.png');
  console.log('Browser: real PNG preview, avatar and lore verified');
  await page.getByRole('button', { name: '确认导入' }).click();
  await page.getByRole('dialog', { name: '导入角色卡', exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '新建会话' }).click();
  await page.getByRole('button', { name: '开始对话' }).click();
  await page.getByLabel('消息', { exact: true }).waitFor();
  assert.equal(conversations[0].vocabulary, null);
  assert.equal(attempts.length, 0);
  await page.getByRole('button', { name: '新建会话' }).click();
  const words = ['forest', 'canopy', 'glade', 'moss', 'fern', 'brook', 'stream', 'root', 'branch', 'bark', 'leaf', 'grove', 'meadow', 'shelter', 'wildlife', 'deer', 'owl', 'dawn', 'dusk', 'moonlight', 'trail', 'clearing', 'bloom', 'whisper'];
  await page.getByLabel('学习词表（可选）').fill(words.join('\n'));
  await page.getByLabel('Persona（可选）').fill('A curious traveler exploring the forest with Seraphina.');
  await page.getByRole('button', { name: '开始对话' }).click();
  await page.getByLabel('消息', { exact: true }).waitFor();
  assert.equal(conversations[1].vocabulary.length, 24);
  console.log('Browser: ordinary and 24-word learning conversations created');
  for (let index = 1; index <= 5; index++) {
    failNextTurn = index === 1;
    await page.getByLabel('消息', { exact: true }).fill(`Tell me about this forest trail, step ${index}.`);
    await page.getByRole('button', { name: '发送', exact: true }).click();
    if (index === 1) {
      await page.getByRole('button', { name: '重试这条消息' }).waitFor();
      await page.reload();
      await page.getByRole('button', { name: '重试这条消息' }).click();
    }
    await page.getByText(`The forest canopy shelters the mossy path. Reply ${index}.`, { exact: true }).waitFor();
  }
  assert.deepEqual(attempts[0], attempts[1]);
  console.log('Browser: five completed turns and stable retry across reload');
  await page.reload();
  await page.getByText('The forest canopy shelters the mossy path. Reply 5.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('log').locator('article').count(), 11);
  await noOverflow('desktop');
  await screenshot('tavern-desktop-dark.png');
  for (const theme of ['light', 'ivory', 'blue-gray', 'dark']) {
    await page.getByLabel('选择主题').selectOption(theme);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.mapflowTheme), theme);
  }
  await page.getByLabel('选择主题').selectOption('ivory');
  await screenshot('tavern-desktop-ivory.png');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await noOverflow(`mobile ${width}`);
    await page.getByRole('button', { name: '打开角色列表' }).click();
    const drawer = page.getByRole('dialog', { name: '功能菜单' });
    await drawer.getByRole('button', { name: '选择角色 Seraphina' }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '打开会话详情' }).click();
    assert((await drawer.innerText()).includes('canopy'));
    await page.keyboard.press('Escape');
    await screenshot(`tavern-mobile-${width}-ivory.png`);
  }
  streamRelease = true;
  await page.getByLabel('消息', { exact: true }).fill('forest'.repeat(1000));
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await page.getByRole('button', { name: '生成中…', exact: true }).waitFor();
  await noOverflow('long unbroken mobile message');
  await screenshot('tavern-mobile-long-message.png');
  streamRelease(); streamRelease = null;
  await page.getByText('The forest canopy shelters the mossy path. Reply 6.', { exact: true }).waitFor();
  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({ status: 'passed', backend: 'deterministic HTTP fixture; no live model or billing', realPngBytes: fixture.length,
    normalizedBytes: Buffer.byteLength(JSON.stringify(characters[0].card)), warnings: characters[0].card.warnings.length,
    loreEntries: characters[0].card.lorebook.length, learningWords: words.length, completedLearningTurns: histories.get('conversation-2').length,
    stableRetryAcrossReload: true, viewportWidths: [1440, 390, 320], themes: ['dark', 'light', 'ivory', 'blue-gray'], pageErrors }, null, 2));
} catch (error) {
  await screenshot('tavern-browser-failure.png');
  throw error;
} finally {
  if (typeof streamRelease === 'function') streamRelease();
  await context.close(); await browser.close();
}
