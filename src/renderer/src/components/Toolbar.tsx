import type { QuotaViewMode } from '@shared/types'
import type { QuotaFilterCounts, QuotaFilterValue, TFn } from '../types'
import { AnimatedSelect, type AnimatedSelectOption } from './AnimatedSelect'

export function Toolbar({
  quotaFilter,
  filterCounts,
  hasAccounts,
  busy,
  quotaViewMode,
  t,
  onChangeFilter,
  onChangeViewMode,
  onOpenSettings,
  onAdd,
  onSync,
  onImportAuthJson,
  onExportAuthJson,
  onWarmup
}: {
  quotaFilter: QuotaFilterValue
  filterCounts: QuotaFilterCounts
  hasAccounts: boolean
  busy: boolean
  quotaViewMode: QuotaViewMode
  t: TFn
  onChangeFilter: (value: QuotaFilterValue) => void
  onChangeViewMode: (value: QuotaViewMode) => void
  onOpenSettings: () => void
  onAdd: () => void
  onSync: () => void
  onImportAuthJson: () => void
  onExportAuthJson: () => void
  onWarmup: () => void
}) {
  const filterOptions: AnimatedSelectOption<QuotaFilterValue>[] = [
    { value: 'all', label: t(`全部（${filterCounts.all}）`) },
    { value: 'available', label: t(`可用（${filterCounts.available}）`) },
    { value: 'empty', label: t(`无额度（${filterCounts.empty}）`) },
    { value: 'blocked', label: t(`封禁（${filterCounts.blocked}）`) }
  ]

  const viewOptions: AnimatedSelectOption<QuotaViewMode>[] = [
    { value: 'both', label: t('百分比+倒数') },
    { value: 'percent', label: t('百分比') },
    { value: 'countdown', label: t('倒数') }
  ]

  return (
    <header className="toolbar">
      <span className="toolbar-title">{t('Codex 切号器')}</span>
      <AnimatedSelect
        className="animated-select-filter"
        ariaLabel={t('额度筛选')}
        value={quotaFilter}
        options={filterOptions}
        onChange={onChangeFilter}
      />
      <AnimatedSelect
        className="animated-select-view"
        ariaLabel={t('显示模式')}
        value={quotaViewMode}
        options={viewOptions}
        onChange={onChangeViewMode}
      />
      <button type="button" className="btn btn-toolbar" onClick={onAdd}>
        {t('添加账号')}
      </button>
      <button type="button" className="btn btn-toolbar btn-sync" onClick={onSync} disabled={busy} title={t('抓取当前 Live 与 CC-Switch 已登录账号，并刷新全部额度')}>
        {t('同步账号')}
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
    </header>
  )
}
