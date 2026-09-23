import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PublicationsTab from './PublicationsTab';

afterEach(() => vi.unstubAllGlobals());

describe('PublicationsTab', () => {
  it('requires inline confirmation before removing an active publication', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{
        publicationId: 'p1', publicTreeId: 't1', title: '社区树',
        publisherDisplayName: 'alice', state: 'active', publishedAt: '2026-09-24T00:00:00Z',
        endedAt: null, endedReason: null,
      }], total: 1 }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);
    render(<QueryClientProvider client={new QueryClient()}><PublicationsTab csrfToken="csrf" /></QueryClientProvider>);

    await userEvent.click(await screen.findByRole('button', { name: '下架' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: '确认下架' }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/publications/p1');
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toMatchObject({ 'X-CSRF-Token': 'csrf' });
  });
});
