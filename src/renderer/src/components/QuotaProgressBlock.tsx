import { formatReset } from '@shared/quota-summary'
import type { QuotaViewMode, TFn } from '../types'

export interface QuotaWindowView {
  provided: boolean
  remaining: number | null
  resetsAt: number | null
}

export function QuotaProgressBlock({
  label,
  q,
  tone,
  viewMode,
  countdownText,
  t
}: {
  label: string
  q: QuotaWindowView
  tone: 'green' | 'blue'
  viewMode?: QuotaViewMode
  countdownText?: string | null
  t: TFn
}) {
  const mode: QuotaViewMode = viewMode ?? 'both'
  const percentText = q.provided ? (q.remaining == null ? '--' : `${q.remaining}%`) : t('未提供')
  const width = q.provided && q.remaining != null ? Math.max(0, Math.min(100, q.remaining)) : 0
  const resetText = q.provided ? t('重置：') + formatReset(q.resetsAt) : t('重置：未提供')
  const trackCls = tone === 'green' ? 'quota-track quota-track-green' : 'quota-track quota-track-blue'
  const fillCls = tone === 'green' ? 'quota-fill quota-fill-green' : 'quota-fill quota-fill-blue'

  if (mode === 'countdown') {
    return (
      <div className="quota-block">
        <div className="quota-block-head">
          <span>{label}</span>
          {countdownText ? (
            <span className="quota-countdown" title={resetText}>
              {countdownText}
            </span>
          ) : (
            <span className="quota-reset-text" title={resetText}>
              {resetText}
            </span>
          )}
        </div>
        {countdownText ? <div className="quota-reset-text" title={resetText}>{resetText}</div> : null}
      </div>
    )
  }

  return (
    <div className="quota-block">
      <div className="quota-block-head">
        <span>{label}</span>
        <span className="quota-value">
          <strong>{percentText}</strong>
          {mode === 'both' && countdownText ? (
            <span className="quota-countdown" title={resetText}>
              {countdownText}
            </span>
          ) : null}
        </span>
      </div>
      <div className={trackCls}>
        <div className={fillCls} style={{ width: `${width}%` }} />
      </div>
      <div className="quota-reset-text" title={resetText}>{resetText}</div>
    </div>
  )
}
