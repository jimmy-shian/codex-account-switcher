import fs from 'fs'
import os from 'os'
import path from 'path'

/** CC-Switch 存放 Codex OAuth 帳號的檔名 */
export interface CcSwitchAccount {
  accountId: string
  email: string | null
  refreshToken: string
  idToken: string | null
  chatgptAccountId: string | null
}

export interface CcSwitchReadResult {
  filePath: string
  accounts: CcSwitchAccount[]
  /** 檔案不存在時為 true，其餘錯誤為 false，呼叫端自行決定要不要報錯 */
  missing: boolean
}

const AUTH_FILE_NAME = 'codex_oauth_auth.json'

/**
 * CC-Switch 各版本的資料位置不同，依序掃描候選路徑。
 * 環境變數 CCSWITCH_HOME 優先，方便自訂安裝位置。
 */
export function listCcSwitchAuthCandidates(): string[] {
  const home = os.homedir()
  const appData = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming')
  const localAppData = process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local')
  const envHome = (process.env.CCSWITCH_HOME ?? '').trim()
  const roots = [
    ...(envHome ? [envHome] : []),
    path.join(home, '.cc-switch'),
    path.join(appData, 'com.ccswitch.desktop'),
    path.join(localAppData, 'com.ccswitch.desktop'),
    path.join(appData, 'CC-Switch'),
    path.join(appData, 'cc-switch'),
    path.join(localAppData, 'CC-Switch'),
    path.join(home, '.config', 'cc-switch')
  ]
  const seen = new Set<string>()
  const result: string[] = []
  for (const root of roots) {
    if (!root || seen.has(root)) continue
    seen.add(root)
    result.push(path.join(root, AUTH_FILE_NAME))
  }
  return result
}

/** 自動偵測到的 CC-Switch 帳號檔；找不到時回傳 null */
export function detectCcSwitchAuthPath(): string | null {
  return listCcSwitchAuthCandidates().find((p) => fs.existsSync(p)) ?? null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/**
 * 把 CC-Switch 的一筆帳號轉成 codex auth.json 內容。
 * CC-Switch 只保存 refresh_token 與 id_token，沒有 access_token；
 * 由呼叫端補 access_token（refreshAuthContentAccessToken）後才能運作。
 */
export function toCodexAuthContent(account: CcSwitchAccount): string {
  return JSON.stringify(
    {
      auth_mode: 'chatgpt',
      OPENAI_API_KEY: null,
      tokens: {
        id_token: account.idToken,
        access_token: '',
        refresh_token: account.refreshToken,
        account_id: account.chatgptAccountId ?? account.accountId
      },
      last_refresh: new Date(0).toISOString()
    },
    null,
    2
  )
}

/** 解析 CC-Switch 的 codex_oauth_auth.json，格式不符的欄位直接略過 */
export function parseCcSwitchAuthContent(content: string): CcSwitchAccount[] {
  const root = asRecord(JSON.parse(content))
  const accounts = asRecord(root?.accounts)
  if (!accounts) return []

  const result: CcSwitchAccount[] = []
  for (const [key, value] of Object.entries(accounts)) {
    const entry = asRecord(value)
    if (!entry) continue
    const refreshToken = nonEmptyString(entry.refresh_token)
    if (!refreshToken) continue
    result.push({
      accountId: key,
      email: nonEmptyString(entry.email),
      refreshToken,
      idToken: nonEmptyString(entry.id_token),
      chatgptAccountId: nonEmptyString(entry.chatgpt_account_id)
    })
  }
  return result
}

/** 讀取 CC-Switch 已登入的所有 Codex 帳號；未指定路徑時自動偵測 */
export function readCcSwitchAccounts(overridePath?: string): CcSwitchReadResult {
  const filePath = overridePath?.trim() || detectCcSwitchAuthPath()
  if (!filePath || !fs.existsSync(filePath)) {
    return { filePath: filePath ?? '', accounts: [], missing: true }
  }
  const raw = fs.readFileSync(filePath, 'utf8')
  try {
    return { filePath, accounts: parseCcSwitchAuthContent(raw), missing: false }
  } catch (e) {
    throw new Error(`無法解析 CC-Switch 帳號檔：${e instanceof Error ? e.message : String(e)}`)
  }
}
