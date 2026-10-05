export type AccountStatus =
  | 'ok'
  | 'unauthorized'
  | 'no_quota'
  | 'app_server_failed'
  | 'snapshot_corrupt'
  | 'idle'
  | 'refreshing'

export interface QuotaWindow {
  usedPercent: number | null
  resetsAt: number | null
  windowDurationMins?: number | null
}

/** 主动重置券（rate_limit_reset_credits）信息 */
export interface ResetCreditsInfo {
  /** 可用张数；null = 接口未返回 */
  availableCount: number | null
  /** 最近一张到期时间（Unix 秒）；null = 无数据 */
  nearestExpiresAt: number | null
}

export interface QuotaCredits {
  hasCredits?: boolean
  unlimited?: boolean
  balance?: number | null
  /** 第三方額外視窗資料，欄位為 snake_case，實際解析在 quota-map 內以寬鬆型別處理 */
  _codexmanager_extra_rate_limits?: unknown[]
}

export interface QuotaBucketRow {
  limitId: string
  limitName: string | null
  displayLabel: string
  primary: QuotaWindow | null
  secondary: QuotaWindow | null
}

export interface QuotaSnapshot {
  limitId: string
  limitName: string | null
  primary: QuotaWindow | null
  secondary: QuotaWindow | null
  credits: QuotaCredits | null
  planType: string | null
  refreshedAt: string
  buckets?: QuotaBucketRow[]
  /** 主动重置券（wham/usage 的 rate_limit_reset_credits） */
  resetCredits?: ResetCreditsInfo | null
}

export interface SavedAccount {
  id: string
  email: string
  planType: string | null
  nickname: string
  fingerprint: string
  /** 不含 token 的指纹，用于 Live 与列表匹配；旧数据可在 listAccounts 时补全 */
  stableFingerprint?: string
  encryptedAuthBlobRef: string
  lastQuotaSnapshot: QuotaSnapshot | null
  status: AccountStatus
  addedAt: string
  lastRefreshedAt: string | null
}

export interface SwitchResult {
  success: boolean
  activeAccountId: string | null
  backupPath: string | null
  warning: string
}

export interface AccountsStoreFile {
  version: 1
  accounts: SavedAccount[]
}

export interface ImportAuthJsonError {
  filePath: string
  message: string
}

export interface ImportAuthJsonSummary {
  files: number
  accounts: number
  imported: number
  updated: number
  skipped: number
  failed: number
  accountIds: string[]
  errors: ImportAuthJsonError[]
}

export interface ExportAuthJsonSummary {
  directoryPath: string
  accountCount: number
  filePaths: string[]
}

export type LiveSessionStatus =
  | 'ok'
  | 'no_live_file'
  | 'unauthorized'
  | 'no_quota'
  | 'app_server_failed'

export interface LiveSessionInfo {
  email: string | null
  planType: string | null
  lastQuotaSnapshot: QuotaSnapshot | null
  lastRefreshedAt: string | null
  status: LiveSessionStatus
  stderrHint?: string
}

/** 啟動 codex 使用的終端機；none 代表不經終端機，直接執行 */
export type CodexTerminal = 'auto' | 'wt' | 'cmd' | 'none'

export interface CodexProcessInfo {
  pid: number
  name: string
  /** 空字串代表無法取得路徑（例如權限不足） */
  exePath: string
}

/**
 * 路徑設定的唯一型別來源。
 * Override 是使用者自訂值（空字串＝自動偵測），Resolved 是實際生效路徑。
 * 所有 paths IPC 都回傳這份完整快照，renderer 只替換 state 即可。
 */
export interface PathsSnapshot {
  codexExePathOverride: string
  codexExePathResolved: string
  codexWorkDir: string
  /** 自訂啟動目錄覆寫值；空字串＝自動（使用者目錄）。保留以區分自動/自定義顯示。 */
  codexWorkDirOverride: string
  codexTerminal: CodexTerminal
  codexStopGraceMs: number
}

/** 路徑快照別名，與 PathsSnapshot 同步 */
export type CodexPathSnapshot = PathsSnapshot

/** 額度顯示模式：百分比 / 倒數 / 兩者並存 */
export type QuotaViewMode = 'percent' | 'countdown' | 'both'

export function isQuotaViewMode(value: unknown): value is QuotaViewMode {
  return value === 'percent' || value === 'countdown' || value === 'both'
}

export interface CodexStopResult {
  stopped: CodexProcessInfo[]
  /** 找不到或無法結束的 pid */
  remaining: number[]
}

export interface CodexLaunchResult {
  launched: boolean
  /** 實際使用的啟動方式 */
  via: CodexTerminal | 'bundled' | 'appx' | null
  exePath: string
  workDir: string
  pid: number | null
  message: string
}

export interface CodexRestartResult extends CodexLaunchResult {
  stopped: CodexProcessInfo[]
  remaining: number[]
}
