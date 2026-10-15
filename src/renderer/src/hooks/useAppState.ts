import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UiLocale } from '@shared/i18n'
import { localize } from '@shared/i18n'
import { cleanErrorMessage } from '../lib/account-view'
import type { QuotaRefreshUi, TFn } from '../types'

const TOAST_MS = 4500
const TOAST_MAX = 3

export interface ToastItem {
  id: number
  message: string
}

/** 語言與翻譯函式，locale 變動時自動重算 */
export function useTranslate(locale: UiLocale): TFn {
  return useCallback((text: string) => localize(text, locale), [locale])
}

/** 右下角堆叠通知：最多保留 3 则，新通知把旧通知往上推挤 */
export function useToast(): {
  toasts: ToastItem[]
  toast: string | null
  showToast: (msg: string) => void
  showError: (e: unknown) => void
} {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef(new Map<number, number>())
  const seqRef = useRef(0)

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer))
      timersRef.current.clear()
    },
    []
  )

  const showToast = useCallback((msg: string) => {
    const id = ++seqRef.current
    setToasts((prev) => {
      const evicted = prev.length >= TOAST_MAX ? prev.slice(0, prev.length - TOAST_MAX + 1) : []
      evicted.forEach((item) => {
        const timer = timersRef.current.get(item.id)
        if (timer != null) window.clearTimeout(timer)
        timersRef.current.delete(item.id)
      })
      return [...prev.slice(-(TOAST_MAX - 1)), { id, message: msg }]
    })
    const timer = window.setTimeout(() => {
      timersRef.current.delete(id)
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, TOAST_MS)
    timersRef.current.set(id, timer)
  }, [])

  const showError = useCallback(
    (e: unknown) => {
      showToast(cleanErrorMessage(e instanceof Error ? e.message : String(e)))
    },
    [showToast]
  )

  return { toasts, toast: toasts.length > 0 ? toasts[toasts.length - 1].message : null, showToast, showError }
}

/**
 * 額度作業狀態機：同時只允許一個作業，用 operationId 讓舊作業的回應不會覆蓋新作業。
 */
export function useQuotaOperation(blocked: boolean): {
  ui: QuotaRefreshUi
  running: () => boolean
  enter: (ui: Exclude<QuotaRefreshUi, { mode: 'idle' }>, opts?: { force?: boolean }) => number | null
  isActive: (operationId: number) => boolean
  exit: (operationId: number) => void
} {
  const [ui, setUi] = useState<QuotaRefreshUi>({ mode: 'idle' })
  const runningRef = useRef(false)
  const seqRef = useRef(0)
  const activeRef = useRef(0)
  const blockedRef = useRef(blocked)
  blockedRef.current = blocked

  const running = useCallback(() => runningRef.current, [])

  const enter = useCallback(
    (next: Exclude<QuotaRefreshUi, { mode: 'idle' }>, opts?: { force?: boolean }): number | null => {
      if (blockedRef.current) return null
      if (runningRef.current && !opts?.force) return null
      const operationId = ++seqRef.current
      activeRef.current = operationId
      runningRef.current = true
      setUi(next)
      return operationId
    },
    []
  )

  const isActive = useCallback((operationId: number) => activeRef.current === operationId, [])

  const exit = useCallback((operationId: number) => {
    if (activeRef.current !== operationId) return
    runningRef.current = false
    setUi({ mode: 'idle' })
  }, [])

  // 穩定引用：ui 沒變時回傳同一物件，避免 App 內依賴 quota 的 effect / callback 每 render 重建
  return useMemo(
    () => ({ ui, running, enter, isActive, exit }),
    [ui, running, enter, isActive, exit]
  )
}
