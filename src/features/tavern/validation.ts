import { TavernApiError } from './types';

export const RAW_FILE_BYTES = 8 * 1024 * 1024;
export const NORMALIZED_CARD_BYTES = 512 * 1024;
export const FIELD_BYTES = 64 * 1024;
export const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const hasControls = (text: string) => /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text);
export function tooLarge(message: string): never {
  throw new TavernApiError(400, 'tavern.input_too_large', message);
}
