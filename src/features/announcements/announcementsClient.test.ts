import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAnnouncements, markAnnouncementRead } from './announcementsClient';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('announcementsClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses announcements with unread ids', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          items: [
            {
              announcementId: 'ann-1',
              title: '新功能',
              content: '内容',
              createdAt: '2026-08-19T00:00:00Z',
              isRead: false,
            },
          ],
          unreadIds: ['ann-1'],
        }),
      ),
    );

    const data = await getAnnouncements();
    expect(data.items).toHaveLength(1);
    expect(data.unreadIds).toEqual(['ann-1']);
  });

  it('marks an announcement read via POST with CSRF', async () => {
    // 204 不允许带响应体，Response 构造器会拒绝，因此直接构造 null body。
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(markAnnouncementRead('ann-1', 'csrf-9')).resolves.toBeUndefined();
    const [path, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/announcements/ann-1/read');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'X-CSRF-Token': 'csrf-9' });
  });
});
