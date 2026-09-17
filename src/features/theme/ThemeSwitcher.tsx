import { useEffect, useState } from 'react';

export const THEME_STORAGE_KEY = 'mapflow.theme';

export const THEME_OPTIONS = [
  { value: 'dark', label: '深色' },
  { value: 'light', label: '浅色' },
  { value: 'ivory', label: '米色' },
  { value: 'blue-gray', label: '蓝灰' },
] as const;

export type MapFlowTheme = (typeof THEME_OPTIONS)[number]['value'];

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<MapFlowTheme>(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.mapflowTheme = theme;
    document.documentElement.style.colorScheme =
      theme === 'dark' || theme === 'blue-gray' ? 'dark' : 'light';
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Theme still applies for this page when storage is unavailable.
    }
  }, [theme]);

  return (
    <label className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-2 py-1.5 text-xs text-slate-400">
      <span aria-hidden="true">◐</span>
      <span className="sr-only">选择主题</span>
      <select
        aria-label="选择主题"
        value={theme}
        onChange={(event) => setTheme(parseTheme(event.target.value))}
        className="max-w-16 cursor-pointer bg-transparent text-xs font-semibold text-slate-300 outline-none"
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} className="bg-slate-900 text-slate-100">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function readStoredTheme(): MapFlowTheme {
  try {
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'dark';
  }
}

function parseTheme(value: string | null): MapFlowTheme {
  return THEME_OPTIONS.some((option) => option.value === value)
    ? (value as MapFlowTheme)
    : 'dark';
}
