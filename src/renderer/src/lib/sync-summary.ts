import type { SyncSummary } from '../vite-env'
import type { TFn } from '../types'
import { cleanErrorMessage } from './account-view'

/** 把同步統計組成一句可讀訊息，錯誤最多顯示 3 筆 */
export function syncSummaryText(summary: SyncSummary, t: TFn): string {
  const parts: string[] = []

  if (summary.liveImported) {
    parts.push(t('已匯入 Live'))
  } else if (summary.liveMissing) {
    parts.push(t('没有 Live auth.json'))
  }

  if (summary.ccSwitchFound > 0) {
    parts.push(t(`CC-Switch 账号 ${summary.ccSwitchImported}/${summary.ccSwitchFound}`))
    if (summary.ccSwitchSkipped > 0) parts.push(t(`跳过 ${summary.ccSwitchSkipped}`))
    if (summary.ccSwitchFailed > 0) parts.push(t(`失败 ${summary.ccSwitchFailed}`))
  } else if (summary.ccSwitchPath) {
    parts.push(t('没有 CC-Switch 已登录账号'))
  }

  parts.push(t('已刷新全部'))

  const head = t(`同步完成：${parts.join(t('，'))}`)
  if (summary.errors.length === 0) return head
  const details = summary.errors
    .slice(0, 3)
    .map((item) => `${item.source}：${cleanErrorMessage(item.message)}`)
    .join('；')
  return `${head}。${t('失败原因')}：${details}`
}
