import { useEffect, useRef } from 'react'

export type HotkeyHandler = () => void

/**
 * 註冊 Ctrl+Shift+<key> 快捷鍵。
 * handler 以 ref 保存，避免每次 render 重新綁定；輸入框內的按鍵不觸發，避免打字誤觸。
 */
export function useHotkeys(map: Record<string, HotkeyHandler>): void {
  const handlersRef = useRef(map)
  handlersRef.current = map

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      const handler = handlersRef.current[e.key.toLowerCase()]
      if (!handler) return
      e.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
