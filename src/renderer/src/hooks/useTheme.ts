import { useCallback, useEffect, useState } from 'react'
import { isThemeMode, resolveTheme, type ResolvedTheme, type ThemeMode } from '@shared/theme'

function getSystemDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

export function useTheme(): {
  mode: ThemeMode
  resolved: ResolvedTheme
  systemDark: boolean
  setTheme: (next: ThemeMode) => void
} {
  const [mode, setMode] = useState<ThemeMode>('system')
  const [systemDark, setSystemDark] = useState<boolean>(() => getSystemDark())
  const resolved = resolveTheme(mode, systemDark)

  useEffect(() => {
    void (async () => {
      try {
        const saved = await window.codexSwitcher.getTheme()
        if (isThemeMode(saved)) setMode(saved)
      } catch {
        /* 讀不到設定時維持跟隨系統 */
      }
    })()
  }, [])

  useEffect(() => {
    let mql: MediaQueryList | null = null
    try {
      mql = window.matchMedia('(prefers-color-scheme: dark)')
    } catch {
      return
    }
    setSystemDark(mql.matches)
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    try {
      mql.addEventListener('change', handler)
      return () => mql?.removeEventListener('change', handler)
    } catch {
      // 舊版 Electron/Chromium fallback
      const legacy = mql as unknown as { addListener: (h: (e: never) => void) => void; removeListener: (h: (e: never) => void) => void }
      try {
        legacy.addListener(handler as never)
        return () => legacy.removeListener(handler as never)
      } catch {
        return
      }
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
    try {
      document.documentElement.style.colorScheme = resolved
    } catch {
      /* 忽略 */
    }
  }, [resolved])

  const setTheme = useCallback((next: ThemeMode) => {
    setMode(next)
    void (async () => {
      try {
        const saved = await window.codexSwitcher.setTheme(next)
        if (isThemeMode(saved)) setMode(saved)
      } catch {
        /* 寫入失敗時畫面仍使用已切換的主題 */
      }
    })()
  }, [])

  return { mode, resolved, systemDark, setTheme }
}
