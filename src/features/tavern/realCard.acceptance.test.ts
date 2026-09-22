import { expect, it, vi } from 'vitest';
import { normalizeCharacterCard } from './cardImport';

// Opt in locally. Third-party card content is intentionally never copied into this repository.
const { env } = await vi.importActual<{ env: Record<string, string | undefined> }>('node:process');
const fixturePath = env.TAVERN_CARD_FIXTURE;
it.skipIf(!fixturePath)('normalizes the pinned official Seraphina PNG and its V2/V3 JSON without claiming regex support', async () => {
  const { readFileSync } = await vi.importActual<{ readFileSync(path: string): Uint8Array }>('node:fs');
  const { createHash } = await vi.importActual<{ createHash(algorithm: string): { update(bytes: Uint8Array): { digest(format: string): string } } }>('node:crypto');
  const bytes = readFileSync(fixturePath!);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('8a71e8270f54fafbccf905b1bdf053a6a55f57bea89c01fcd8c0e87ee76a2d52');
  const png = await normalizeCharacterCard(new File([new Uint8Array(bytes)], 'default_Seraphina.png', { type: 'image/png' }));
  expect(png).toMatchObject({ schemaVersion: 1, sourceFormat: 'png', name: 'Seraphina' });
  expect(png.lorebook).toHaveLength(4);
  expect(png.lorebook[0]).toMatchObject({ keys: ['eldoria', 'wood', 'forest', 'magical forest'], selective: true, secondaryKeys: [] });
  expect(png.description).not.toBe('');
  expect(png.firstMessage).not.toBe('');
  expect(png.warnings.length).toBeGreaterThan(0);
  expect(png.warnings.length).toBeLessThanOrEqual(256);
  expect(new TextEncoder().encode(JSON.stringify(png)).length).toBeLessThanOrEqual(512 * 1024);
  expect(png.warnings.filter(warning => warning.code === 'unsupported_regex')).toHaveLength(0);
  const embeddedVersions: string[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decode = (value: Uint8Array) => new TextDecoder().decode(value);
  for (let cursor = 8; cursor < bytes.length;) {
    const length = view.getUint32(cursor);
    if (decode(bytes.subarray(cursor + 4, cursor + 8)) === 'tEXt') {
      const payload = bytes.subarray(cursor + 8, cursor + 8 + length);
      const separator = payload.indexOf(0);
      if (['chara', 'ccv3'].includes(decode(payload.subarray(0, separator)))) {
        const source = decode(Uint8Array.from(atob(decode(payload.subarray(separator + 1))), character => character.charCodeAt(0)));
        embeddedVersions.push(JSON.parse(source).spec);
        const json = await normalizeCharacterCard(new File([source], 'equivalent.json'));
        expect(json).toEqual({ ...png, sourceFormat: 'json' });
      }
    }
    cursor += length + 12;
  }
  expect(embeddedVersions).toEqual(['chara_card_v2', 'chara_card_v3']);
  console.info(`Seraphina: ${bytes.length} source bytes; ${new TextEncoder().encode(JSON.stringify(png)).length} normalized bytes; ${png.warnings.length} warnings; 4 plain-key lore entries retained.`);
});
