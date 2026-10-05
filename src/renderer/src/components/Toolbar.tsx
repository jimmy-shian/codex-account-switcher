import { memo, useMemo } from 'react'
import type { QuotaFilterCounts, QuotaFilterValue, TFn } from '../types'
import { AnimatedSelect, type AnimatedSelectOption } from './AnimatedSelect'

export const Toolbar = memo(function Toolbar({
  quotaFilter,
  filterCounts,
  hasAccounts,
  busy,
  t,
  onChangeFilter,
  onOpenSettings,
  onAdd,
  onImportLive,
  onImportAuthJson,
  onExportAuthJson,
  onWarmup
}: {
  quotaFilter: QuotaFilterValue
  filterCounts: QuotaFilterCounts
  hasAccounts: boolean
  busy: boolean
  t: TFn
  onChangeFilter: (value: QuotaFilterValue) => void
  onOpenSettings: () => void
  onAdd: () => void
  onImportLive: () => void
  onImportAuthJson: () => void
  onExportAuthJson: () => void
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
        <button type="button" className="btn btn-toolbar" onClick={onAdd}>
          {t('添加账号')}
        </button>
        <button type="button" className="btn btn-toolbar btn-sync" onClick={onImportLive} disabled={busy} title={t('汇入当前 Live auth.json，并刷新全部额度')}>
          {t('汇入 Live')}
        </button>
        <button type="button" className="btn btn-toolbar" onClick={onImportAuthJson}>
          {t('从 JSON 导入')}
        </button>
        <button type="button" className="btn btn-toolbar" onClick={onExportAuthJson} disabled={!hasAccounts}>
          {t('导出 JSON')}
        </button>
        <button type="button" className="btn btn-toolbar" onClick={onWarmup}>
          {t('一键预热')}
        </button>
        <button
          type="button"
          className="btn btn-toolbar btn-settings"
          onClick={onOpenSettings}
          title={t('打开设置（主题/语言/Proxy）')}
          aria-label={t('打开设置')}
        >
          {t('⚙ 设置')}
        </button>
      </div>
    </header>
  )
})
