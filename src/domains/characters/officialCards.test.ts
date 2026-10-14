import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadOfficialCard, fetchOfficialCards } from './officialCards';

const catalogUrl = 'https://raw.githubusercontent.com/SillyTavern/SillyTavern-Content/main/index.json';
const cardUrl = 'https://raw.githubusercontent.com/SillyTavern/SillyTavern-Content/main/assets/character/default_Example.png';
const card = { type: 'character' as const, id: 'default_Example.png', name: 'Example', description: 'A sample role', url: cardUrl, highlight: true };
const pngHeader = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

afterEach(() => vi.unstubAllGlobals());

describe('SillyTavern official character source', () => {
  it('loads only character cards from the official catalog and downloads the selected PNG', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url === catalogUrl) return new Response(JSON.stringify([card, { ...card, type: 'extension', id: 'extension.js' },
        { ...card, id: 'unsafe.png', url: 'https://example.com/unsafe.png' }]));
      if (url === cardUrl) return new Response(pngHeader);
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const catalog = await fetchOfficialCards();
    expect(catalog).toEqual([card]);
    const file = await downloadOfficialCard(catalog[0]);
    expect(file.name).toBe('default_Example.png');
    expect(file.type).toBe('image/png');
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
    expect(bytes).toEqual(pngHeader);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([catalogUrl, cardUrl]);
  });

  it('rejects a changed download URL and oversized remote bytes', async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array(8 * 1024 * 1024 + 1)));
    vi.stubGlobal('fetch', fetcher);
    await expect(downloadOfficialCard({ ...card, url: 'https://example.com/unsafe.png' })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await expect(downloadOfficialCard(card)).rejects.toThrow(/8 MiB/);
  });
});
