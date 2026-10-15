import { memo } from 'react'
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
import type { AccountRowView, QuotaRefreshUi, SortConfig, SortField, TFn } from '../types'
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

function dotClassForPill(pillCls: string): string {
  if (pillCls.includes('pill-ok')) return 'status-dot dot-ok'
  if (pillCls.includes('pill-warn')) return 'status-dot dot-warn'
  if (pillCls.includes('pill-bad')) return 'status-dot dot-bad'
  return 'status-dot dot-neutral'
}

function OpIcon({ kind }: { kind: 'switch' | 'refresh' | 'warmup' | 'delete' }) {
  const common = {
    width: 13,
    height: 13,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  } as const
  if (kind === 'switch') {
    return (
      <svg {...common}>
        <path d="M8 3 4 7l4 4" />
        <path d="M4 7h16" />
        <path d="m16 21 4-4-4-4" />
        <path d="M20 17H4" />
      </svg>
    )
  }
  if (kind === 'refresh') {
    return (
      <svg {...common}>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
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
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m6 6 1 14h10l1-14" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export const AccountTable = memo(function AccountTable({
  rows,
  locale,
  sortConfig,
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
    <table className="account-table">
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
            label={t('7d / 30d 额度')}
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
          const fiveHourCountdown =
            display.fiveHour.provided && display.fiveHour.resetsAt != null
              ? formatCountdown(display.fiveHour.resetsAt, nowSec, locale)
              : null
          const rowCls = ['row-expiry-host', row.isActive ? 'row-active' : '', row.urgencyClass]
            .filter(Boolean)
            .join(' ')
          const sevenDayPercent =
            display.sevenDay.provided && display.sevenDay.remaining != null
              ? `${display.sevenDay.remaining}%`
              : t('未提供')
          return (
            <tr key={a.id} className={rowCls || undefined}>
              <td className="cell-account">
                <div
                  className="account-primary account-copy"
                  title={t('点击复制账号')}
                  role="button"
                  tabIndex={0}
                  onClick={() => onCopyEmail(a.email)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onCopyEmail(a.email)
                    }
                  }}
                >
                  {row.quotaLoading ? null : (
                    <span className={dotClassForPill(row.pill.cls)} title={row.pill.text} aria-label={row.pill.text} />
                  )}
                  <span className="account-email" title={a.email}>
                    {a.email}
                  </span>
                  {row.isActive ? <span className="plan-badge plan-badge-active">{t('当前')}</span> : null}
                  <span className={row.planBadgeClass}>{row.planText}</span>
                </div>
                <div className="account-sub">AUTH | {(a.stableFingerprint ?? a.fingerprint).slice(0, 12).toUpperCase()}</div>
                {resetCredits ? <div className="account-sub reset-credits-badge">{resetCredits}</div> : null}
              </td>
              <td className="cell-5h">
                <QuotaProgressBlock
                  label={display.fiveHour.label}
                  q={display.fiveHour}
                  tone="green"
                  t={t}
                  countdownText={fiveHourCountdown}
                />
              </td>
              <td className="cell-7d">
                <QuotaProgressBlock label={display.sevenDay.label} q={display.sevenDay} tone="blue" t={t} />
                {display.extras.map((e) => (
                  <QuotaProgressBlock
                    key={e.key}
                    label={e.label}
                    q={{ provided: e.remaining != null, remaining: e.remaining, resetsAt: e.resetsAt }}
                    tone="blue"
                    t={t}
                  />
                ))}
                {/* 窄螢幕合併列：7d/30d 百分比 + 到期倒數同一行，取代獨立到期欄 */}
                <div className="quota-merged-expiry" title={row.nearestResetLabel ?? ''}>
                  <span className="quota-merged-percent">
                    {display.sevenDay.label} {sevenDayPercent}
                  </span>
                  <span className="quota-merged-sep" aria-hidden>
                    ·
                  </span>
                  <span className="quota-merged-countdown">{countdown}</span>
                  {row.nearestResetLabel ? (
                    <span className="quota-merged-source">{row.nearestResetLabel}</span>
                  ) : null}
                </div>
              </td>
              <td className="cell-expiry expiry-cell" title={row.nearestResetLabel ?? ''}>
                <div className="expiry-countdown">{countdown}</div>
                {row.nearestResetLabel ? <div className="expiry-source">{row.nearestResetLabel}</div> : null}
              </td>
              <td className="cell-status status-cell">
                {row.quotaLoading ? (
                  <span className="quota-cell-loading quota-cell-loading-inline" aria-label={t('刷新中')}>
                    <span className="quota-spinner" aria-hidden />
                  </span>
                ) : (
                  <span className={row.pill.cls} title={row.pill.text}>
                    {row.pill.text}
                  </span>
                )}
              </td>
              <td className="cell-ops">
                <div className="row-actions">
                  {row.isActive ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary btn-action-primary"
                      disabled
                      title={t('当前使用中')}
                      aria-label={t('当前使用中')}
                    >
                      <OpIcon kind="switch" />
                      <span className="btn-label">{t('使用中')}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary btn-action-primary"
                      onClick={() => onSwitch(a.id)}
                      title={t('切换')}
                      aria-label={t('切换')}
                    >
                      <OpIcon kind="switch" />
                      <span className="btn-label">{t('切换')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => onRefreshRow(a.id)}
                    title={t('刷新')}
                    aria-label={t('刷新')}
                  >
                    <OpIcon kind="refresh" />
                    <span className="btn-label">{t('刷新')}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-warmup"
                    onClick={() => onWarmupRow(a.id, a.email)}
                    title={t('预热')}
                    aria-label={t('预热')}
                  >
                    <OpIcon kind="warmup" />
                    <span className="btn-label">{t('预热')}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => onDelete(a.id, a.email)}
                    title={t('删除')}
                    aria-label={t('删除')}
                  >
                    <OpIcon kind="delete" />
                    <span className="btn-label">{t('删除')}</span>
                  </button>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
})

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
