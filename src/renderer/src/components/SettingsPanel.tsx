import { useEffect, useRef } from 'react'
import { UI_LOCALE_LABELS, UI_LOCALES, type UiLocale } from '@shared/i18n'
import { THEME_MODES, themeModeLabel, type ThemeMode } from '@shared/theme'
import type { TFn } from '../types'
import { AnimatedSelect, type AnimatedSelectOption } from './AnimatedSelect'
import './settings-panel.css'

export function SettingsPanel({
  open,
  themeMode,
  systemDark,
  resolved,
  locale,
  proxyUrl,
  proxySaving,
  t,
  onClose,
  onChangeTheme,
  onChangeLocale,
  onChangeProxy,
  onSaveProxy
}: {
  open: boolean
  themeMode: ThemeMode
  systemDark: boolean
  resolved: 'light' | 'dark'
  locale: UiLocale
  proxyUrl: string
  proxySaving: boolean
  t: TFn
  onClose: () => void
  onChangeTheme: (mode: ThemeMode) => void
  onChangeLocale: (value: UiLocale) => void
  onChangeProxy: (value: string) => void
  onSaveProxy: () => void
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // 聚焦首個選項，關閉後焦點由呼叫端處理
    try {
      panelRef.current?.querySelector<HTMLElement>('input, button')?.focus()
    } catch {
      /* 忽略 */
    }
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const localeOptions: AnimatedSelectOption<UiLocale>[] = UI_LOCALES.map((item) => ({
    value: item,
    label: UI_LOCALE_LABELS[item]
  }))

  return (
    <div className="modal-back" onClick={(e) => {
      if (e.target === e.currentTarget) onClose()
    }}>
      <div ref={panelRef} className="modal modal-settings" role="dialog" aria-modal="true" aria-label={t('设置')}>
        <div className="modal-settings-head">
          <h3>{t('设置')}</h3>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} aria-label={t('关闭')}>
            ✕
          </button>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">{t('外观')}</div>
          <div className="settings-theme-group" role="radiogroup" aria-label={t('主题')}>
            {THEME_MODES.map((m) => (
              <label key={m} className={`settings-theme-option${themeMode === m ? ' is-checked' : ''}`}>
                <input
                  type="radio"
                  name="theme-mode"
                  value={m}
                  checked={themeMode === m}
                  onChange={() => onChangeTheme(m)}
                />
                <span>{themeModeLabel(m, locale)}</span>
              </label>
            ))}
          </div>
          <div className="settings-hint">
            {t('目前系统为')} {systemDark ? t('深色') : t('浅色')}，{t('实际显示')} {resolved === 'dark' ? t('深色') : t('浅色')}
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">{t('界面语言')}</div>
          <AnimatedSelect
            className="animated-select-settings-locale"
            ariaLabel={t('界面语言')}
            value={locale}
            options={localeOptions}
            onChange={onChangeLocale}
          />
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Proxy</div>
          <div className="settings-proxy-row">
            <input
              className="proxy-input settings-proxy-input"
              type="text"
              value={proxyUrl}
              placeholder={t('Proxy（留空＝直连）')}
              aria-label={t('Proxy 地址')}
              onChange={(e) => onChangeProxy(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveProxy()
              }}
            />
            <button type="button" className="btn btn-sm btn-toolbar" disabled={proxySaving} onClick={onSaveProxy}>
              {proxySaving ? t('保存中…') : t('保存 Proxy')}
            </button>
          </div>
          <div className="settings-hint">{t('留空表示直连，不使用 Proxy')}</div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('完成')}
          </button>
        </div>
      </div>
    </div>
  )
}
