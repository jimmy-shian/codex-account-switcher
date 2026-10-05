import type { QuotaViewMode, SavedAccount } from '@shared/types'
import type { ExpiryUrgency } from '@shared/quota-summary'

export type { QuotaViewMode }

/** 翻譯函式：輸入簡中，輸出目前語言的文案 */
export type TFn = (text: string) => string

export type QuotaFilterValue = 'all' | 'available' | 'empty' | 'blocked'

export type SortField = '5h' | '7d' | 'reset'
export type SortDir = 'asc' | 'desc'
export interface SortConfig {
  field: SortField
  dir: SortDir
}

export type WarmupConfirmTarget = { mode: 'row'; accountId: string; email: string } | { mode: 'batch' }

/** 全域額度作業狀態：同一時間只允許一個作業在跑 */
export type QuotaRefreshUi =
  | { mode: 'idle' }
  | { mode: 'all' }
  | { mode: 'warmup' }
  | { mode: 'row'; accountId: string }
  | { mode: 'rowWarmup'; accountId: string }

export interface QuotaFilterCounts {
  all: number
  available: number
  empty: number
  blocked: number
}

export interface DeleteTarget {
  id: string
  email: string
}

/** 清單畫面需要的衍生資料 */
export interface AccountRowView {
  account: SavedAccount
  isActive: boolean
  planText: string
  planBadgeClass: string
  pill: { cls: string; text: string }
  quotaLoading: boolean
  nearestResetTs: number | null
  nearestResetLabel: string | null
  urgency: ExpiryUrgency
  urgencyClass: string
}
