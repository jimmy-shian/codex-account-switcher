import type { ImportAuthJsonSummary, LiveSessionInfo, QuotaSnapshot, SavedAccount } from '@shared/types'
import type { UiLocale } from '@shared/i18n'
import { getQuotaDisplayWindows } from '@shared/quota-summary'
import type { QuotaFilterCounts, QuotaFilterValue, TFn } from '../types'

/** Electron 會把 IPC 例外包成 "Error invoking remote method ..."，顯示前先剝掉這層前綴 */
export function cleanErrorMessage(message: string): string {
  return message.replace(/^Error invoking remote method '[^']*',\s*/, '').replace(/^Error:\s*/, '')
}

/** 從未知例外取出乾淨訊息 */
export function messageFromUnknown(e: unknown): string {
  return cleanErrorMessage(e instanceof Error ? e.message : String(e))
}

export function planBadgeText(planType: string | null | undefined): string {
  const p = String(planType ?? '')
    .trim()
    .toUpperCase()
  return p || 'UNKNOWN'
}

export function planBadgeClass(planText: string): string {
  return planText === 'PLUS' ? 'plan-badge plan-badge-plus' : 'plan-badge'
}

export function statusPill(status: SavedAccount['status'], t: TFn): { cls: string; text: string } {
  switch (status) {
    case 'ok':
      return { cls: 'pill pill-ok', text: t('正常') }
    case 'refreshing':
      return { cls: 'pill pill-warn', text: t('刷新中') }
    case 'unauthorized':
      return { cls: 'pill pill-bad', text: t('未授权/过期') }
    case 'no_quota':
      return { cls: 'pill pill-warn', text: t('无额度数据') }
    case 'app_server_failed':
      return { cls: 'pill pill-bad', text: t('app-server 失败') }
    case 'snapshot_corrupt':
      return { cls: 'pill pill-bad', text: t('快照损坏') }
    default:
      return { cls: 'pill pill-neutral', text: t('待刷新') }
  }
}

export function liveStatusLabel(s: LiveSessionInfo['status'], t: TFn): string {
  switch (s) {
    case 'ok':
      return t('正常')
    case 'no_live_file':
      return t('无 auth.json')
    case 'unauthorized':
      return t('未授权/过期')
    case 'no_quota':
      return t('无额度数据')
    case 'app_server_failed':
      return t('app-server 失败')
    default:
      return s
  }
}

export function isBlockedAccount(status: SavedAccount['status']): boolean {
  return status === 'unauthorized' || status === 'app_server_failed' || status === 'snapshot_corrupt'
}

export function getWindowRemainingValues(snapshot: QuotaSnapshot | null, locale: UiLocale): number[] {
  const display = getQuotaDisplayWindows(snapshot, locale)
  return [display.fiveHour, display.sevenDay]
    .map((item) => (item.provided && item.remaining != null ? item.remaining : null))
    .filter((item): item is number => item != null)
}

export function matchesQuotaFilter(account: SavedAccount, filter: QuotaFilterValue, locale: UiLocale): boolean {
  if (filter === 'all') return true

  const remainingValues = getWindowRemainingValues(account.lastQuotaSnapshot, locale)
  const quotaExhausted = remainingValues.length > 0 && remainingValues.every((value) => value <= 0)
  const blocked = isBlockedAccount(account.status)

  if (filter === 'blocked') return blocked
  if (filter === 'empty') return account.status === 'no_quota' || (!blocked && quotaExhausted)
  return !blocked && account.status !== 'no_quota' && !quotaExhausted
}

export function countByQuotaFilter(accounts: SavedAccount[], locale: UiLocale): QuotaFilterCounts {
  return {
    all: accounts.length,
    available: accounts.filter((a) => matchesQuotaFilter(a, 'available', locale)).length,
    empty: accounts.filter((a) => matchesQuotaFilter(a, 'empty', locale)).length,
    blocked: accounts.filter((a) => matchesQuotaFilter(a, 'blocked', locale)).length
  }
}

export function fileNameOf(filePath: string): string {
  const parts = filePath.split(/[\\/]/)
  return parts[parts.length - 1] || filePath
}

export function importSummaryText(summary: ImportAuthJsonSummary, t: TFn): string {
  const parts: string[] = []
  if (summary.imported > 0) parts.push(t(`新增 ${summary.imported}`))
  if (summary.updated > 0) parts.push(t(`更新 ${summary.updated}`))
  if (summary.skipped > 0) parts.push(t(`跳过 ${summary.skipped}`))
  if (summary.failed > 0) parts.push(t(`失败 ${summary.failed}`))
  const head =
    parts.length > 0 ? t(`JSON 导入并刷新完成：${parts.join(t('，'))}`) : t('JSON 导入并刷新完成')
  if (summary.errors.length === 0) return head
  const details = summary.errors
    .slice(0, 3)
    .map((item) => `${fileNameOf(item.filePath)}：${cleanErrorMessage(item.message)}`)
    .join('；')
  return `${head}。${t('失败原因')}：${details}`
}
