import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import './animated-select.css'

export interface AnimatedSelectOption<T extends string> {
  value: T
  label: string
}

/**
 * 自訂下拉選單：套用「點擊延展」過度效果（trigger 變色 + 陰影、箭頭旋轉、選單 scaleY 展開）。
 * 點擊外部或 Esc 關閉，鍵盤可用上下鍵切換、Enter 選取。
 */
export function AnimatedSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  align = 'left',
  disabled = false
}: {
  value: T
  options: AnimatedSelectOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
  align?: 'left' | 'right'
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)))
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (selectedIndex >= 0) setActiveIndex(selectedIndex)
  }, [selectedIndex])

  const pick = useCallback(
    (index: number) => {
      const option = options[index]
      if (!option) return
      onChange(option.value)
      setOpen(false)
    },
    [onChange, options]
  )

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    if (e.key === 'Escape') {
      if (!open) return
      e.preventDefault()
      close()
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((prev) => (prev + delta + options.length) % options.length)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      pick(activeIndex)
    }
  }

  const triggerCls = ['animated-select-trigger', className, open ? 'is-open' : '', disabled ? 'is-disabled' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={rootRef}
      className={['animated-select', open ? 'is-open' : '', disabled ? 'is-disabled' : ''].filter(Boolean).join(' ')}
      onKeyDown={onKeyDown}
    >
      <div
        className={triggerCls}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => {
          if (disabled) return
          setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
          setOpen((prev) => !prev)
        }}
      >
        <span className="animated-select-value">{selected?.label ?? ''}</span>
        <span className="animated-select-arrow" aria-hidden />
      </div>
      <div
        id={listId}
        role="listbox"
        className={['animated-select-options', align === 'right' ? 'align-right' : ''].filter(Boolean).join(' ')}
        aria-hidden={!open}
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            role="option"
            aria-selected={option.value === value}
            tabIndex={-1}
            className={[
              'animated-select-option',
              option.value === value ? 'is-selected' : '',
              open && index === activeIndex ? 'is-active' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => pick(index)}
            onMouseEnter={() => setActiveIndex(index)}
          >
            {option.label}
          </div>
        ))}
      </div>
    </div>
  )
}
