import { quotaSummaryText } from '@shared/quota-summary'
import type { UiLocale } from '@shared/i18n'
import type { LiveSessionInfo } from '@shared/types'
import { liveStatusLabel } from '../lib/account-view'
import type { QuotaRefreshUi, TFn } from '../types'

export function LiveBanner({
  liveInfo,
  locale,
  refreshUi,
  t
}: {
  liveInfo: LiveSessionInfo
  locale: UiLocale
  refreshUi: QuotaRefreshUi
  t: TFn
}) {
  return (
    <div className="path-hint live-banner">
      <strong>{t('Live 会话')}</strong> {liveInfo.email ?? '—'} · {liveInfo.planType ?? '—'} ·{' '}
      {liveStatusLabel(liveInfo.status, t)}
      {refreshUi.mode === 'all' ? (
        <>
          {' · '}
          <span className="quota-cell-loading quota-cell-loading-inline" aria-label={t('刷新中')}>
            <span className="quota-spinner" aria-hidden />
          </span>
        </>
      ) : liveInfo.lastQuotaSnapshot ? (
        ` · ${quotaSummaryText(liveInfo.lastQuotaSnapshot, locale)}`
      ) : null}
    </div>
  )
}

export function LoginWaitHint({ onCancel, t }: { onCancel: () => void; t: TFn }) {
  const hint = t('已清除旧登录记录并在内建窗口打开登录页，完成登录后会自动加入账号；未完成可点「取消登录」结束等待。')
  return (
    <div className="path-hint login-wait-hint">
      {hint}
      <button type="button" className="btn btn-sm btn-ghost login-cancel-btn" onClick={onCancel}>
        {t('取消登录')}
      </button>
    </div>
  )
}
