import type { TavernModelSelection } from './types';

interface ModelPreferences {
  provider: TavernModelSelection['provider'];
  historyBytes: TavernModelSelection['historyBytes'];
  custom: { model: string; baseUrl: string };
  platform: { model: string };
}

const preferenceKey = (accountId: string) => `mapflow.tavern.model-preferences.v1.${accountId}`;
const defaultPreferences = (): ModelPreferences => ({
  provider: 'custom', historyBytes: 32768, custom: { model: '', baseUrl: '' }, platform: { model: '' },
});
const modelName = (value: unknown) => typeof value === 'string' && value.length <= 256 ? value.trim() : '';

function publicApiUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      && /\/v1\/?$/u.test(url.pathname) ? url.href : '';
  } catch { return ''; }
}

function readPreferences(accountId: string): ModelPreferences {
  const defaults = defaultPreferences();
  try {
    const saved = JSON.parse(window.localStorage.getItem(preferenceKey(accountId)) ?? 'null');
    if (!saved || typeof saved !== 'object') return defaults;
    return {
      provider: saved.provider === 'platform' ? 'platform' : 'custom',
      historyBytes: [8192, 16384, 32768].includes(saved.historyBytes) ? saved.historyBytes : defaults.historyBytes,
      custom: { model: modelName(saved.custom?.model), baseUrl: publicApiUrl(saved.custom?.baseUrl) },
      platform: { model: modelName(saved.platform?.model) },
    };
  } catch { return defaults; }
}

export function readModelSelection(accountId: string, provider?: TavernModelSelection['provider']): TavernModelSelection {
  const preferences = readPreferences(accountId);
  const selectedProvider = provider ?? preferences.provider;
  return {
    provider: selectedProvider, historyBytes: preferences.historyBytes, apiKey: '', settings: {},
    model: preferences[selectedProvider].model,
    baseUrl: selectedProvider === 'custom' ? preferences.custom.baseUrl : '',
  };
}

export function saveModelSelection(accountId: string, selection: TavernModelSelection): void {
  const preferences = readPreferences(accountId);
  preferences.provider = selection.provider;
  preferences.historyBytes = selection.historyBytes;
  if (selection.provider === 'custom') {
    preferences.custom = { model: modelName(selection.model), baseUrl: publicApiUrl(selection.baseUrl) };
  } else preferences.platform = { model: modelName(selection.model) };
  try { window.localStorage.setItem(preferenceKey(accountId), JSON.stringify(preferences)); }
  catch { /* The current page remains usable when browser storage is unavailable. */ }
}
