import type { UiLocale } from './i18n'

export type ThemeMode = 'system' | 'light' | 'dark'

export const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark']

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

export type ResolvedTheme = 'light' | 'dark'

export function resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (mode === 'light') return 'light'
  if (mode === 'dark') return 'dark'
  return systemDark ? 'dark' : 'light'
}

export function themeModeLabel(mode: ThemeMode, locale: UiLocale): string {
  if (locale === 'zh-TW') {
    if (mode === 'system') return '跟隨系統'
    if (mode === 'light') return '淺色'
    return '深色'
  }
  if (mode === 'system') return '跟随系统'
  if (mode === 'light') return '浅色'
  return '深色'
}
