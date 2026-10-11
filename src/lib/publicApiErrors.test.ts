import { afterEach, expect, it, vi } from 'vitest';
import { fetchCapabilities } from '../features/identity/identityClient';
import { fetchPublicTrees } from '../features/tree-library/treeLibraryClient';
import { readUserModelCatalog } from '../features/tree-generation/treeGenerationClient';
import { readWallet } from '../features/wallet/walletClient';
import { getAnnouncements } from '../features/announcements/announcementsClient';
import { readCreditSummary } from '../features/credit/creditClient';

afterEach(() => vi.unstubAllGlobals());

it.each([
  ['identity', fetchCapabilities], ['maps', fetchPublicTrees], ['generation', readUserModelCatalog],
  ['wallet', readWallet], ['announcements', getAnnouncements], ['credits', readCreditSummary],
] as const)('does not expose unknown %s API diagnostics to the user', async (_area, request) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: {
    code: 'internal.unknown_failure', message: 'host=internal.example database_field=secret sk-private-secret', traceId: 'safe-request-1',
  } }), { status: 409 })));
  await expect(request()).rejects.toMatchObject({ message: '请求暂时失败，请稍后重试。' });
});
