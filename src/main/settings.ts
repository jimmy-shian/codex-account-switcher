import fs from 'fs'
import os from 'os'
import path from 'path'
import { app } from 'electron'
import { isUiLocale, localize, type UiLocale } from '@shared/i18n'
import { isThemeMode, type ThemeMode } from '@shared/theme'
import { isQuotaViewMode, type CodexTerminal, type QuotaViewMode } from '@shared/types'

export type { CodexTerminal }

interface SettingsFile {
  version: 1
  locale: UiLocale
  theme?: ThemeMode
  quotaViewMode?: QuotaViewMode
  /** 空字串代表直連，不經 proxy */
  proxyUrl?: string
  /** 自訂 codex 執行檔路徑；空字串代表自動偵測 */
  codexExePath?: string
  /** 啟動 codex 的工作目錄；空字串代表使用者 home */
  codexWorkDir?: string
  /** 啟動 codex 使用的終端機 */
  codexTerminal?: CodexTerminal
  /** 重啟 codex 前等待的毫秒數，讓舊程序優雅退出 */
  codexStopGraceMs?: number
}

const DEFAULT_LOCALE: UiLocale = 'zh-CN'
const DEFAULT_PROXY_URL = ''
const DEFAULT_THEME: ThemeMode = 'system'
const DEFAULT_QUOTA_VIEW: QuotaViewMode = 'both'

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

function readSettings(): Partial<SettingsFile> {
  try {
    const p = getSettingsPath()
    if (!fs.existsSync(p)) return {}
    return JSON.parse(fs.readFileSync(p, 'utf8')) as Partial<SettingsFile>
  } catch {
    return {}
  }
}

const CODEX_TERMINALS: CodexTerminal[] = ['auto', 'wt', 'cmd', 'none']

export function isCodexTerminal(value: unknown): value is CodexTerminal {
  return typeof value === 'string' && CODEX_TERMINALS.includes(value as CodexTerminal)
}

function writeSettings(patch: Partial<SettingsFile>): void {
  const current = readSettings()
  const content: SettingsFile = {
    version: 1,
    locale: isUiLocale(current.locale) ? current.locale : DEFAULT_LOCALE,
    theme: isThemeMode(current.theme) ? current.theme : DEFAULT_THEME,
    quotaViewMode: isQuotaViewMode(current.quotaViewMode) ? current.quotaViewMode : DEFAULT_QUOTA_VIEW,
    proxyUrl: typeof current.proxyUrl === 'string' ? current.proxyUrl : DEFAULT_PROXY_URL,
    codexExePath: typeof current.codexExePath === 'string' ? current.codexExePath : '',
    codexWorkDir: typeof current.codexWorkDir === 'string' ? current.codexWorkDir : '',
    codexTerminal: isCodexTerminal(current.codexTerminal) ? current.codexTerminal : 'auto',
    codexStopGraceMs: typeof current.codexStopGraceMs === 'number' ? current.codexStopGraceMs : 1500,
    ...patch
  }
  try {
    fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true })
    fs.writeFileSync(getSettingsPath(), `${JSON.stringify(content, null, 2)}\n`, 'utf8')
  } catch {
    /* 設定寫入失敗時保留目前設定，不中斷操作 */
  }
}

export function getLocale(): UiLocale {
  const parsed = readSettings()
  return isUiLocale(parsed?.locale) ? parsed.locale : DEFAULT_LOCALE
}

export function setLocale(locale: UiLocale): void {
  if (!isUiLocale(locale)) return
  writeSettings({ locale })
}

export function getTheme(): ThemeMode {
  const parsed = readSettings()
  return isThemeMode(parsed?.theme) ? parsed.theme : DEFAULT_THEME
}

export function setTheme(mode: ThemeMode): ThemeMode {
  if (!isThemeMode(mode)) return getTheme()
  writeSettings({ theme: mode })
  return mode
}

export function getQuotaViewMode(): QuotaViewMode {
  const parsed = readSettings()
  return isQuotaViewMode(parsed?.quotaViewMode) ? parsed.quotaViewMode : DEFAULT_QUOTA_VIEW
}

export function setQuotaViewMode(mode: QuotaViewMode): QuotaViewMode {
  if (!isQuotaViewMode(mode)) return getQuotaViewMode()
  writeSettings({ quotaViewMode: mode })
  return mode
}

/** 取得 proxy 位址；空字串代表直連 */
export function getProxyUrl(): string {
  const parsed = readSettings()
  return typeof parsed.proxyUrl === 'string' ? parsed.proxyUrl.trim() : DEFAULT_PROXY_URL
}

/** 設定 proxy 位址；傳入空字串代表直連 */
export function setProxyUrl(proxyUrl: string): string {
  const normalized = proxyUrl.trim()
  writeSettings({ proxyUrl: normalized })
  return normalized
}

/** 自訂 codex 執行檔路徑；空字串代表自動偵測 */
export function getCodexExePathOverride(): string {
  const parsed = readSettings()
  return typeof parsed.codexExePath === 'string' ? parsed.codexExePath.trim() : ''
}

export function setCodexExePath(value: string): string {
  const normalized = value.trim()
  writeSettings({ codexExePath: normalized })
  return normalized
}

export function getCodexWorkDir(): string {
  const override = getCodexWorkDirOverride()
  return override || os.homedir()
}

/** 未正規化的覆寫值；空字串＝自動。供 UI 區分自動/自定義顯示。 */
export function getCodexWorkDirOverride(): string {
  const parsed = readSettings()
  const value = typeof parsed.codexWorkDir === 'string' ? parsed.codexWorkDir.trim() : ''
  return value
}

export function setCodexWorkDir(value: string): string {
  const normalized = value.trim()
  writeSettings({ codexWorkDir: normalized })
  return normalized
}

export function getCodexTerminal(): CodexTerminal {
  const parsed = readSettings()
  return isCodexTerminal(parsed.codexTerminal) ? parsed.codexTerminal : 'auto'
}

export function setCodexTerminal(value: CodexTerminal): CodexTerminal {
  if (!isCodexTerminal(value)) return getCodexTerminal()
  writeSettings({ codexTerminal: value })
  return value
}

export function getCodexStopGraceMs(): number {
  const parsed = readSettings()
  const value = typeof parsed.codexStopGraceMs === 'number' ? parsed.codexStopGraceMs : 1500
  return value >= 0 && value <= 10000 ? value : 1500
}

/** 一次取齊路徑與啟動設定，讓 IPC 回傳一致的快照 */
export interface LaunchSettings {
  codexExePath: string
  codexWorkDir: string
  codexTerminal: CodexTerminal
  codexStopGraceMs: number
}

export function getLaunchSettings(): LaunchSettings {
  return {
    codexExePath: getCodexExePathOverride(),
    codexWorkDir: getCodexWorkDir(),
    codexTerminal: getCodexTerminal(),
    codexStopGraceMs: getCodexStopGraceMs()
  }
}

/** main process 直接顯示的文案（視窗標題、系統對話框）走這裡 */
export function mainText(text: string): string {
  return localize(text, getLocale())
}