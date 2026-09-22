import { describe, expect, it } from 'vitest';
import { normalizeCharacterCard, readCardImport } from './cardImport';

const encoder = new TextEncoder();
const role = {
  name: '旅人 🌙', description: '你好，{{user}}。', personality: '友善', scenario: '茶馆',
  first_mes: '我是 {{char}}。', mes_example: '<START>\n{{user}}: hi', system_prompt: '角色设定',
  post_history_instructions: '自然交谈', creator_notes: '作者说明', alternate_greetings: ['晚上好'],
  character_book: { entries: [{ id: 7, keys: ['tea'], secondary_keys: ['茶'], constant: false,
    enabled: true, selective: true, content: '热茶', priority: 4, insertion_order: 2 }] },
};

function jsonFile(content: unknown, name = 'role.json') {
  return new File([JSON.stringify(content)], name, { type: 'application/json' });
}
function chunk(kind: string, payload: Uint8Array) {
  const bytes = new Uint8Array(payload.length + 12);
  new DataView(bytes.buffer).setUint32(0, payload.length);
  bytes.set(encoder.encode(kind), 4);
  bytes.set(payload, 8);
  let crc = 0xffffffff;
  for (const byte of bytes.slice(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  new DataView(bytes.buffer).setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0);
  return bytes;
}
export function cardPng(entries: [string, unknown][], international = false) {
  const header = new Uint8Array(13);
  new DataView(header.buffer).setUint32(0, 1);
  new DataView(header.buffer).setUint32(4, 1);
  header.set([8, 6], 8);
  const blocks = entries.map(([key, content]) => {
    const base64 = btoa(Array.from(encoder.encode(JSON.stringify(content)), byte => String.fromCharCode(byte)).join(''));
    return chunk(international ? 'iTXt' : 'tEXt', encoder.encode(`${key}\0${international ? '\0\0\0\0' : ''}${base64}`));
  });
  return new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    ...blocks, chunk('IDAT', new Uint8Array([120, 156, 99, 0, 1, 0, 0, 5, 0, 1])), chunk('IEND', new Uint8Array())],
    'role.png', { type: 'image/png' });
}

describe('local card normalization', () => {
  it.each([1, 2, 3])('normalizes ordinary V%s JSON and PNG with identical text and actual source container', async version => {
    const source = version === 1 ? role : { spec: `chara_card_v${version}`, spec_version: `${version}.0`, data: role };
    const json = await normalizeCharacterCard(jsonFile(source));
    const png = await normalizeCharacterCard(cardPng([[version === 3 ? 'ccv3' : 'chara', source]]));
    expect(json).toMatchObject({ schemaVersion: 1, sourceFormat: 'json', name: '旅人 🌙',
      firstMessage: '我是 {{char}}。', exampleDialogue: '<START>\n{{user}}: hi',
      alternateGreetings: ['晚上好'], lorebook: [{ id: '7', keys: ['tea'], secondaryKeys: ['茶'],
        constant: false, enabled: true, selective: true, content: '热茶', priority: 4, order: 2 }] });
    expect(png).toEqual({ ...json, sourceFormat: 'png' });
  });

  it('prefers ccv3 over chara regardless of order and decodes Unicode iTXt', async () => {
    const card = await normalizeCharacterCard(cardPng([
      ['ccv3', { spec: 'chara_card_v3', data: { name: '优先 🌙' } }], ['chara', { name: '旧版' }],
    ], true));
    expect(card.name).toBe('优先 🌙');
  });

  it('keeps the exact original source file and reports actual container despite misleading MIME', async () => {
    const original = new File([JSON.stringify(role)], 'role.json', { type: 'image/png' });
    const preview = await readCardImport(original);
    expect(preview.sourceFile).toBe(original);
    expect(preview.sourceInfo).toMatchObject({ sourceFormat: 'json', fileName: 'role.json', fileSize: original.size });
  });

  it('safely ignores extensions, scripts, unknown fields and advanced lore with structured paths', async () => {
    const card = await normalizeCharacterCard(jsonFile({ spec: 'chara_card_v3', data: {
      ...role, extensions: { regex_scripts: [{ script: 'alert(1)' }], tavern_helper: { js: 'execute()' } },
      custom_panel: '<script>bad()</script>', character_book: { entries: [{ keys: ['/x/i'], content: 'ok',
        extensions: { probability: 25 }, use_regex: true }] },
    } }));
    expect(card.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unsupported_extension', field: 'data.extensions.regex_scripts', message: expect.any(String) }),
      expect.objectContaining({ code: 'unsupported_field', field: 'data.custom_panel' }),
      expect.objectContaining({ code: 'unsupported_regex', field: 'data.character_book.entries.0.keys.0' }),
    ]));
    expect(JSON.stringify(card)).not.toContain('alert(1)');
    expect(JSON.stringify(card)).not.toContain('execute()');
    expect(card.lorebook).toEqual([]);
  });

  it.each([{}, [], { name: ' ' }, { name: 2 }, { name: 'a', description: {} },
    { name: 'a\u0000' }, { spec: 'chara_card_v9', data: role }])('rejects invalid/unsupported card %j', async source => {
    await expect(normalizeCharacterCard(jsonFile(source))).rejects.toMatchObject({ code: expect.stringMatching(/^tavern\.card_(invalid|unsupported)$/) });
  });

  it('rejects malformed JSON, false PNG magic, truncated chunks and bad CRC', async () => {
    const files = [new File(['{'], 'bad.json'), new File(['not png'], 'bad.png')];
    const valid = cardPng([['chara', role]]);
    const bytes = new Uint8Array(await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.readAsArrayBuffer(valid);
    }));
    files.push(new File([bytes.slice(0, -5)], 'bad.png'));
    bytes[29] ^= 1;
    files.push(new File([bytes], 'bad.png'));
    for (const file of files) await expect(normalizeCharacterCard(file)).rejects.toMatchObject({ code: 'tavern.card_invalid' });
  });

  it('rejects PNG without card metadata', async () => {
    await expect(normalizeCharacterCard(cardPng([]))).rejects.toMatchObject({ code: 'tavern.card_unsupported' });
  });

  it('bounds compatibility warnings at 256 with an explicit summary of omitted warning details', async () => {
    const extensions = Object.fromEntries(Array.from({ length: 300 }, (_, index) => [`extension_${index}`, true]));
    const card = await normalizeCharacterCard(jsonFile({ name: 'Many extensions', extensions }));
    expect(card.warnings).toHaveLength(256);
    expect(card.warnings[254].field).toBe('extensions.extension_254');
    expect(card.warnings[255]).toMatchObject({ code: 'warnings_truncated', field: 'warnings', message: expect.stringContaining('45') });
  });

  it('retains plain lore keys under use_regex, ignores only actual regex keys and reports the affected paths', async () => {
    const card = await normalizeCharacterCard(jsonFile({ name: 'Guardian', character_book: { entries: [
      { keys: ['forest', '/grove/i'], secondary_keys: ['moon', '/night/i'], selective: true, content: 'Hidden grove', use_regex: true },
      { keys: ['river'], secondary_keys: [], selective: true, content: 'Hidden stream', extensions: { use_regex: true } },
      { keys: ['/glade/i'], content: 'Regex-only lore', use_regex: true },
      { keys: ['forest'], secondary_keys: ['/moon/i'], selective: true, content: 'Requires regex filter' },
      { keys: ['/glade/i'], constant: true, content: 'Always active lore' },
    ] } }));
    expect(card.lorebook).toHaveLength(3);
    expect(card.lorebook[0]).toMatchObject({ keys: ['forest'], secondaryKeys: ['moon'], selective: true, content: 'Hidden grove' });
    expect(card.lorebook[1]).toMatchObject({ keys: ['river'], secondaryKeys: [], selective: true, content: 'Hidden stream' });
    expect(card.lorebook[2]).toMatchObject({ keys: [], constant: true, content: 'Always active lore' });
    expect(card.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unsupported_regex', field: 'character_book.entries.0.keys.1' }),
      expect.objectContaining({ code: 'unsupported_regex', field: 'character_book.entries.0.secondary_keys.1' }),
      expect.objectContaining({ code: 'unsupported_lore', field: 'character_book.entries.2', message: expect.stringContaining('整条世界书') }),
      expect.objectContaining({ code: 'unsupported_lore', field: 'character_book.entries.3', message: expect.stringContaining('整条世界书') }),
    ]));
    expect(card.warnings.some(warning => warning.field.endsWith('.use_regex'))).toBe(false);
  });

  it('keeps warning paths safe and within the server UTF-8 field budget', async () => {
    const card = await normalizeCharacterCard(jsonFile({ name: 'Unknown fields', extensions: { ['中'.repeat(300)]: true, ['bad\u0000field']: true } }));
    expect(card.warnings).toHaveLength(2);
    for (const warning of card.warnings) {
      expect(encoder.encode(warning.field).length).toBeLessThanOrEqual(256);
      expect(warning.field).not.toContain('\u0000');
    }
    expect(card.warnings[0].field).toMatch(/…$/u);
    expect(card.warnings[1].field).toContain('bad\\u0000field');
  });

  it.each([
    { name: 'a'.repeat(201) },
    { alternate_greetings: Array.from({ length: 65 }, () => 'hello') },
    { character_book: { entries: [{ keys: Array.from({ length: 129 }, () => 'forest') }] } },
    { character_book: { entries: [{ keys: ['中'.repeat(342)] }] } },
    { character_book: { entries: [{ id: '中'.repeat(67) }] } },
    { character_book: { entries: [{ priority: 2147483648 }] } },
    { character_book: { entries: [{ id: 'duplicate' }, { id: 'duplicate' }] } },
  ])('rejects cards outside the server schema limits before showing an importable preview: %j', async fields => {
    await expect(normalizeCharacterCard(jsonFile({ name: 'Guardian', ...fields }))).rejects.toMatchObject({ code: expect.stringMatching(/^tavern\.(input_too_large|card_invalid)$/u) });
  });

  it('enforces raw size before reading, UTF-8 field size, lore count and normalized size', async () => {
    const tooLarge = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'big.json');
    for (const file of [tooLarge, jsonFile({ name: 'a', description: '中'.repeat(21846) }),
      jsonFile({ name: 'a', character_book: { entries: Array.from({ length: 257 }, () => ({ content: 'x' })) } }),
      jsonFile({ name: 'a', alternate_greetings: Array.from({ length: 9 }, () => 'x'.repeat(65536)) })]) {
      await expect(normalizeCharacterCard(file)).rejects.toMatchObject({ code: 'tavern.input_too_large' });
    }
  });
});
