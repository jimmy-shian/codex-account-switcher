import type { UiLocale } from '@shared/i18n'
import {
  expiryUrgencyClass,
  formatCountdown,
  getExpiryUrgency,
  getNearestResetDetail,
  getQuotaDisplayWindows,
  resetCreditsText
} from '@shared/quota-summary'
import type { SavedAccount } from '@shared/types'
import type { AccountRowView, QuotaRefreshUi, QuotaViewMode, SortConfig, SortField, TFn } from '../types'
import { planBadgeClass, planBadgeText, statusPill } from '../lib/account-view'
import { QuotaProgressBlock } from './QuotaProgressBlock'

function SortableHeader({
  label,
  field,
  sortConfig,
  title,
  t,
  onSort
}: {
  label: string
  field: SortField
  sortConfig: SortConfig | null
  title: string
  t: TFn
  onSort: (field: SortField) => void
}) {
  const active = sortConfig?.field === field
  return (
    <th onClick={() => onSort(field)} style={{ cursor: 'pointer' }} title={title}>
      {label} {active ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )
}

export function AccountTable({
  rows,
  locale,
  sortConfig,
  quotaViewMode,
  nowSec,
  t,
  onSort,
  onSwitch,
  onRefreshRow,
  onWarmupRow,
  onDelete,
  onCopyEmail
}: {
  rows: AccountRowView[]
  locale: UiLocale
  sortConfig: SortConfig | null
  quotaViewMode: QuotaViewMode
  nowSec: number
  t: TFn
  onSort: (field: SortField) => void
  onSwitch: (id: string) => void
  onRefreshRow: (id: string) => void
  onWarmupRow: (id: string, email: string) => void
  onDelete: (id: string, email: string) => void
  onCopyEmail: (email: string) => void
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>{t('账号信息')}</th>
          <SortableHeader
            label={t('5h 额度')}
            field="5h"
            sortConfig={sortConfig}
            title={t('点击按额度比例排序')}
            t={t}
            onSort={onSort}
          />
          <SortableHeader
            label={t('7d 额度')}
            field="7d"
            sortConfig={sortConfig}
            title={t('点击按额度比例排序')}
            t={t}
            onSort={onSort}
          />
          <SortableHeader
            label={t('到期倒数')}
            field="reset"
            sortConfig={sortConfig}
            title={t('点击按到期时间排序')}
            t={t}
            onSort={onSort}
          />
          <th>{t('状态')}</th>
          <th>{t('操作')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const a = row.account
          const q = a.lastQuotaSnapshot
          const display = getQuotaDisplayWindows(q, locale)
          const resetCredits = resetCreditsText(q, locale)
          const countdown = row.nearestResetTs != null ? formatCountdown(row.nearestResetTs, nowSec, locale) : t('无资料')
          const rowCls = ['row-expiry-host', row.isActive ? 'row-active' : '', row.urgencyClass]
            .filter(Boolean)
            .join(' ')
          return (
            <tr key={a.id} className={rowCls || undefined}>
              <td>
                <div className="account-primary account-copy" title={t('点击复制账号')} onClick={() => onCopyEmail(a.email)}>
                  <span className="account-email" title={a.email}>
                    {a.email}
                  </span>
                  {row.isActive ? <span className="plan-badge plan-badge-active">{t('当前')}</span> : null}
                  <span className={row.planBadgeClass}>{row.planText}</span>
                </div>
                <div className="account-sub">AUTH | {(a.stableFingerprint ?? a.fingerprint).slice(0, 12).toUpperCase()}</div>
                {resetCredits ? <div className="account-sub reset-credits-badge">{resetCredits}</div> : null}
              </td>
              <td>
                <QuotaProgressBlock label={t('5小时')} q={display.fiveHour} tone="green" viewMode={quotaViewMode} t={t} />
              </td>
              <td>
                <QuotaProgressBlock label={t('7天')} q={display.sevenDay} tone="blue" viewMode={quotaViewMode} t={t} />
                {quotaViewMode !== 'countdown'
                  ? display.extras.map((e) => (
                      <QuotaProgressBlock
                        key={e.key}
                        label={e.label}
                        q={{ provided: e.remaining != null, remaining: e.remaining, resetsAt: e.resetsAt }}
                        tone="blue"
                        viewMode={quotaViewMode}
                        t={t}
                      />
                    ))
                  : null}
              </td>
              <td className="expiry-cell" title={row.nearestResetLabel ?? ''}>
                <div className="expiry-countdown">{countdown}</div>
                {row.nearestResetLabel ? <div className="expiry-source">{row.nearestResetLabel}</div> : null}
              </td>
              <td className="status-cell">
                {row.quotaLoading ? (
                  <span className="quota-cell-loading quota-cell-loading-inline" aria-label={t('刷新中')}>
                    <span className="quota-spinner" aria-hidden />
                  </span>
                ) : (
                  <span className={row.pill.cls}>{row.pill.text}</span>
                )}
              </td>
              <td>
                <div className="row-actions">
                  {row.isActive ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled
                      title={t('当前使用中')}
                    >
                      {t('使用中')}
                    </button>
                  ) : (
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => onSwitch(a.id)}>
                      {t('切换')}
                    </button>
                  )}
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => onRefreshRow(a.id)}>
                    {t('刷新')}
                  </button>
                  <button type="button" className="btn btn-sm btn-warmup" onClick={() => onWarmupRow(a.id, a.email)}>
                    {t('预热')}
                  </button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(a.id, a.email)}>
                    {t('删除')}
                  </button>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** 依 activeId 與刷新狀態組出表格列所需的衍生資料（含最早到期與緊急度） */
export function buildAccountRows(
  accounts: SavedAccount[],
  activeId: string | null,
  refreshUi: QuotaRefreshUi,
  t: TFn,
  locale: UiLocale = 'zh-CN',
  nowSec?: number
): AccountRowView[] {
  const now = nowSec ?? Math.floor(Date.now() / 1000)
  return accounts.map((account) => {
    const q = account.lastQuotaSnapshot
    const planText = planBadgeText(q?.planType ?? account.planType)
    const quotaLoading =
      refreshUi.mode === 'all' ||
      ((refreshUi.mode === 'row' || refreshUi.mode === 'rowWarmup') && refreshUi.accountId === account.id)
    const detail = getNearestResetDetail(q, locale, now)
    const urgency = detail.ts != null && !detail.isExpired ? getExpiryUrgency(detail.ts, now) : 0
    return {
      account,
      isActive: account.id === activeId,
      planText,
      planBadgeClass: planBadgeClass(planText),
      pill: statusPill(account.status, t),
      quotaLoading,
      nearestResetTs: detail.ts,
      nearestResetLabel: detail.sourceLabel,
      urgency,
      urgencyClass: expiryUrgencyClass(urgency)
    }
  })
}
