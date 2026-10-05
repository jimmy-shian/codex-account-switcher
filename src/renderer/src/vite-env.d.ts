/// <reference types="vite/client" />

import type { UiLocale } from '@shared/i18n'
import type { ThemeMode } from '@shared/theme'
import type {
  CodexLaunchResult,
  CodexProcessInfo,
  CodexRestartResult,
  CodexStopResult,
  CodexTerminal,
  ExportAuthJsonSummary,
  ImportAuthJsonSummary,
  LiveSessionInfo,
  PathsSnapshot,
  QuotaViewMode,
  SavedAccount,
  SwitchResult
} from '@shared/types'

export type { PathsSnapshot }

export interface ListResult {
  accounts: SavedAccount[]
  activeAccountId: string | null
  liveAuthPresent: boolean
}

export interface RefreshLiveResult extends ListResult {
  live: LiveSessionInfo
}

export interface SwitchResponse extends SwitchResult, ListResult {}

export interface ImportAuthJsonResponse extends ListResult {
  importSummary: ImportAuthJsonSummary
}

export interface WarmupResult extends ListResult {
  attempted: number
  warmed: number
  failed: number
  lastMessage: string | null
}

export interface WarmupOneResponse extends ListResult {
  warmupMode: 'warmed' | 'refreshed' | 'failed'
  warmupMessage: string
}

declare global {
  interface Window {
    codexSwitcher: {
      listAccounts: () => Promise<ListResult>
      addViaLogin: (mode?: 'embedded') => Promise<ListResult>
      addViaLoginCancel: () => Promise<void>
      clearLoginSession: () => Promise<void>
      importAuthJsonFile: () => Promise<ImportAuthJsonResponse>
      exportAuthJsonFile: () => Promise<ExportAuthJsonSummary>
      switchAccount: (accountId: string) => Promise<SwitchResponse>
      refreshOne: (accountId: string) => Promise<ListResult>
      refreshAll: () => Promise<ListResult>
      warmupNeverRefreshed: () => Promise<WarmupResult>
      warmupOne: (accountId: string) => Promise<WarmupOneResponse>
      refreshLive: () => Promise<RefreshLiveResult>
      importLive: () => Promise<ListResult>
      updateNickname: (accountId: string, nickname: string) => Promise<ListResult>
      deleteAccount: (accountId: string) => Promise<ListResult>
      reorderAccounts: (accountIds: string[]) => Promise<ListResult>
      getLocale: () => Promise<UiLocale>
      setLocale: (locale: UiLocale) => Promise<UiLocale>
      getTheme: () => Promise<ThemeMode>
      setTheme: (theme: ThemeMode) => Promise<ThemeMode>
      getQuotaViewMode: () => Promise<QuotaViewMode>
      setQuotaViewMode: (mode: QuotaViewMode) => Promise<QuotaViewMode>
      getProxyUrl: () => Promise<string>
      setProxyUrl: (proxyUrl: string) => Promise<string>
      getPaths: () => Promise<PathsSnapshot>
      setCodexExePath: (filePath: string) => Promise<PathsSnapshot>
      pickCodexExe: () => Promise<PathsSnapshot>
      setCodexWorkDir: (dir: string) => Promise<PathsSnapshot>
      setCodexTerminal: (terminal: CodexTerminal) => Promise<PathsSnapshot>
      listCodexProcesses: () => Promise<CodexProcessInfo[]>
      stopCodex: () => Promise<CodexStopResult>
      startCodex: () => Promise<CodexLaunchResult>
      restartCodex: () => Promise<CodexRestartResult>
    }
  }
}

export {}
