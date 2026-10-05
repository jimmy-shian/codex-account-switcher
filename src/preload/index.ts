import { contextBridge, ipcRenderer } from 'electron'
import type { CodexTerminal, QuotaViewMode } from '@shared/types'
import type { ThemeMode } from '@shared/theme'

contextBridge.exposeInMainWorld('codexSwitcher', {
  listAccounts: () => ipcRenderer.invoke('accounts:list'),
  addViaLogin: () => ipcRenderer.invoke('accounts:addViaLogin'),
  addViaLoginCancel: () => ipcRenderer.invoke('accounts:addViaLoginCancel'),
  importAuthJsonFile: () => ipcRenderer.invoke('accounts:importAuthJsonFile'),
  exportAuthJsonFile: () => ipcRenderer.invoke('accounts:exportAuthJsonFile'),
  switchAccount: (accountId: string) => ipcRenderer.invoke('accounts:switch', accountId),
  refreshOne: (accountId: string) => ipcRenderer.invoke('accounts:refreshOne', accountId),
  refreshAll: () => ipcRenderer.invoke('accounts:refreshAll'),
  warmupNeverRefreshed: () => ipcRenderer.invoke('accounts:warmupNeverRefreshed'),
  warmupOne: (accountId: string) => ipcRenderer.invoke('accounts:warmupOne', accountId),
  refreshLive: () => ipcRenderer.invoke('accounts:refreshLive'),
  importLive: () => ipcRenderer.invoke('accounts:importLive'),
  syncAccounts: () => ipcRenderer.invoke('accounts:sync'),
  updateNickname: (accountId: string, nickname: string) =>
    ipcRenderer.invoke('accounts:updateNickname', accountId, nickname),
  deleteAccount: (accountId: string) => ipcRenderer.invoke('accounts:delete', accountId),
  reorderAccounts: (accountIds: string[]) => ipcRenderer.invoke('accounts:reorder', accountIds),
  getLocale: () => ipcRenderer.invoke('settings:getLocale'),
  setLocale: (locale: string) => ipcRenderer.invoke('settings:setLocale', locale),
  getTheme: () => ipcRenderer.invoke('settings:getTheme'),
  setTheme: (theme: ThemeMode) => ipcRenderer.invoke('settings:setTheme', theme),
  getQuotaViewMode: () => ipcRenderer.invoke('settings:getQuotaViewMode'),
  setQuotaViewMode: (mode: QuotaViewMode) => ipcRenderer.invoke('settings:setQuotaViewMode', mode),
  getProxyUrl: () => ipcRenderer.invoke('settings:getProxyUrl'),
  setProxyUrl: (proxyUrl: string) => ipcRenderer.invoke('settings:setProxyUrl', proxyUrl),
  getPaths: () => ipcRenderer.invoke('paths:get'),
  setCcSwitchAuthPath: (filePath: string) => ipcRenderer.invoke('paths:setCcSwitchAuthPath', filePath),
  pickCcSwitchAuthPath: () => ipcRenderer.invoke('paths:pickCcSwitchAuthPath'),
  setCodexExePath: (filePath: string) => ipcRenderer.invoke('paths:setCodexExePath', filePath),
  pickCodexExe: () => ipcRenderer.invoke('paths:pickCodexExe'),
  setCodexWorkDir: (dir: string) => ipcRenderer.invoke('paths:setCodexWorkDir', dir),
  setCodexTerminal: (terminal: CodexTerminal) => ipcRenderer.invoke('paths:setCodexTerminal', terminal),
  listCodexProcesses: () => ipcRenderer.invoke('codex:listProcesses'),
  stopCodex: () => ipcRenderer.invoke('codex:stop'),
  startCodex: () => ipcRenderer.invoke('codex:start'),
  restartCodex: () => ipcRenderer.invoke('codex:restart')
})
