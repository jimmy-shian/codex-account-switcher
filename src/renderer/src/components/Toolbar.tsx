import { memo, useMemo } from 'react'
import type { QuotaFilterCounts, QuotaFilterValue, TFn } from '../types'
import { AnimatedSelect, type AnimatedSelectOption } from './AnimatedSelect'

function ToolbarIcon({ kind }: { kind: 'add' | 'import' | 'warmup' | 'settings' }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  } as const
  if (kind === 'add') {
    return (
      <svg {...common}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    )
  }
  if (kind === 'import') {
    return (
      <svg {...common}>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M4 21h16" />
      </svg>
    )
  }
  if (kind === 'warmup') {
    return (
      <svg {...common}>
        <path d="M12 22c4 0 7-2.9 7-7 0-3-2-5.5-3.5-7C14 6.5 13 5 13 2c-3 2-5 4.5-5 8-1-1-1.5-2.5-1.5-4C4.5 8 3 10.5 3 14c0 4.5 4 8 9 8Z" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  )
}

export const Toolbar = memo(function Toolbar({
  quotaFilter,
  filterCounts,
  busy,
  t,
  onChangeFilter,
  onOpenSettings,
  onAdd,
  onImportLive,
  onWarmup
}: {
  quotaFilter: QuotaFilterValue
  filterCounts: QuotaFilterCounts
  busy: boolean
  t: TFn
  onChangeFilter: (value: QuotaFilterValue) => void
  onOpenSettings: () => void
  onAdd: () => void
  onImportLive: () => void
  onWarmup: () => void
}) {
  const filterOptions: AnimatedSelectOption<QuotaFilterValue>[] = useMemo(
    () => [
      { value: 'all', label: t(`全部（${filterCounts.all}）`) },
      { value: 'available', label: t(`可用（${filterCounts.available}）`) },
      { value: 'empty', label: t(`无额度（${filterCounts.empty}）`) },
      { value: 'blocked', label: t(`封禁（${filterCounts.blocked}）`) }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterCounts.all, filterCounts.available, filterCounts.empty, filterCounts.blocked]
  )

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-title">{t('Codex 切号器')}</span>
        <AnimatedSelect
          className="animated-select-filter"
          ariaLabel={t('额度筛选')}
          value={quotaFilter}
          options={filterOptions}
          onChange={onChangeFilter}
        />
      </div>
      <div className="toolbar-actions">
        <button type="button" className="btn btn-toolbar" onClick={onAdd} title={t('添加账号')} aria-label={t('添加账号')}>
          <ToolbarIcon kind="add" />
          <span className="btn-label">{t('添加账号')}</span>
        </button>
        <button type="button" className="btn btn-toolbar btn-sync" onClick={onImportLive} disabled={busy} title={t('汇入当前 Live auth.json，并刷新全部额度')} aria-label={t('汇入 Live')}>
          <ToolbarIcon kind="import" />
          <span className="btn-label">{t('汇入 Live')}</span>
        </button>
        <button type="button" className="btn btn-toolbar" onClick={onWarmup} title={t('一键预热')} aria-label={t('一键预热')}>
          <ToolbarIcon kind="warmup" />
          <span className="btn-label">{t('一键预热')}</span>
        </button>
        <button
          type="button"
          className="btn btn-toolbar btn-settings"
          onClick={onOpenSettings}
          title={t('打开设置（主题/语言/Proxy/JSON 备份）')}
          aria-label={t('打开设置')}
        >
          <ToolbarIcon kind="settings" />
          <span className="btn-label">{t('设置')}</span>
        </button>
      </div>
    </header>
  )
})
