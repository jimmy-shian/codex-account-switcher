import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme } from 'electron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { AccountService } from './account-service'
import type { PathsSnapshot } from '@shared/types'
import {
  getCodexPathSnapshot,
  listCodexProcesses,
  restartCodex,
  startCodex,
  stopCodexProcesses
} from './codex-process'
import {
  getLocale,
  getProxyUrl,
  getQuotaViewMode,
  getTheme,
  isCodexTerminal,
  mainText,
  setCodexExePath,
  setCodexTerminal,
  setCodexWorkDir,
  setLocale,
  setProxyUrl,
  setQuotaViewMode,
  setTheme
} from './settings'
import { isUiLocale } from '@shared/i18n'
import { isThemeMode } from '@shared/theme'
import { isQuotaViewMode } from '@shared/types'
import { invalidateCodexExeCache } from './paths'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.setName('codex-account-switcher')
if (process.platform === 'win32') {
  app.setAppUserModelId('com.local.codex-account-switcher')
}

const service = new AccountService()

/**
 * 路徑設定的唯一組裝點。
 * 所有 paths IPC 都回傳同一份完整快照，renderer 只替換 state，不需要自己合併欄位。
 */
function buildPathsSnapshot(): PathsSnapshot {
  return getCodexPathSnapshot()
}

function getArgValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag)
  if (idx < 0) return null
  return process.argv[idx + 1] ?? null
}

function isDebugWarmupMode(): boolean {
  return Boolean(process.env.CODEX_DEBUG_WARMUP_ID ?? getArgValue('--debug-warmup'))
}

function isDebugRefreshAllMode(): boolean {
  return Boolean(process.env.CODEX_DEBUG_REFRESH_ALL) || process.argv.includes('--debug-refresh-all')
}

function isDebugMode(): boolean {
  return isDebugWarmupMode() || isDebugRefreshAllMode()
}

async function runDebugModeIfNeeded(): Promise<boolean> {
  if (isDebugRefreshAllMode()) {
    const startedAt = Date.now()
    const accounts = await service.refreshAll()
    const outPath =
      process.env.CODEX_DEBUG_OUT ?? getArgValue('--debug-out') ?? path.join(process.cwd(), 'refresh-all-debug.json')
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          elapsedMs: Date.now() - startedAt,
          accounts: accounts.length,
          statuses: accounts.reduce<Record<string, number>>((acc, account) => {
            acc[account.status] = (acc[account.status] ?? 0) + 1
            return acc
          }, {})
        },
        null,
        2
      ),
      'utf8'
    )
    await app.quit()
    return true
  }

  const warmupAccountId = process.env.CODEX_DEBUG_WARMUP_ID ?? getArgValue('--debug-warmup')
  if (!warmupAccountId) return false
  const result = await service.debugWarmup(warmupAccountId)
  const outPath =
    process.env.CODEX_DEBUG_OUT ?? getArgValue('--debug-out') ?? path.join(process.cwd(), 'warmup-debug.json')
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8')
  await app.quit()
  return true
}

function resolvePreload(): string {
  const base = path.join(__dirname, '../preload')
  const mjs = path.join(base, 'index.mjs')
  if (fs.existsSync(mjs)) return mjs
  return path.join(base, 'index.js')
}

function resolveAppIcon(): string {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  const candidates = [
    path.join(process.resourcesPath, 'build', iconName),
    path.join(process.resourcesPath, iconName),
    path.join(__dirname, '../../build', iconName),
    path.join(__dirname, '../../../build', iconName)
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[candidates.length - 1]
}

function applyThemeSource(): void {
  try {
    const mode = getTheme()
    nativeTheme.themeSource = mode === 'system' ? 'system' : mode === 'dark' ? 'dark' : 'light'
  } catch {
    /* 讀不到設定時維持系統預設 */
  }
}

function resolveWindowBackground(): string {
  try {
    const mode = getTheme()
    if (mode === 'dark') return '#111418'
    if (mode === 'light') return '#f3f4f6'
    return nativeTheme.shouldUseDarkColors ? '#111418' : '#f3f4f6'
  } catch {
    return '#f3f4f6'
  }
}

function createWindow(): void {
  applyThemeSource()
  const win = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 980,
    minHeight: 560,
    backgroundColor: resolveWindowBackground(),
    icon: resolveAppIcon(),
    // 先隱藏等首幀 ready-to-show 再顯示，避免啟動 / 還原時的白屏閃爍
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: resolvePreload(),
      contextIsolation: true,
      sandbox: false,
      // 背景節流保持預設開啟，縮小視窗時降低渲染開銷
      backgroundThrottling: true
    },
    title: mainText('Codex 切号器')
  })

  win.once('ready-to-show', () => {
    try {
      if (!win.isDestroyed()) win.show()
    } catch {
      try {
        win.show()
      } catch {
        /* ignore */
      }
    }
  })
  // 保險：若 ready-to-show 因載入失敗沒觸發，3s 後強制顯示避免黑窗
  // 注意：主進程是 Node 環境，沒有 window，用全域 setTimeout
  setTimeout(() => {
    try {
      if (!win.isDestroyed() && !win.isVisible()) win.show()
    } catch {
      /* ignore */
    }
  }, 3000)

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('accounts:list', () => service.listAccounts())

  ipcMain.handle('accounts:addViaLogin', async (_e, mode?: unknown) => {
    const normalized = mode === 'external' || mode === 'device' ? mode : 'embedded'
    await service.addViaLogin(normalized)
    return service.listAccounts()
  })

  ipcMain.handle('accounts:addViaLoginCancel', () => {
    service.cancelAddViaLogin()
  })

  ipcMain.handle('accounts:clearLoginSession', async () => {
    await service.clearLoginSession()
  })

  ipcMain.handle('accounts:importAuthJsonFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const openOptions: Electron.OpenDialogOptions = {
      title: mainText('选择 auth.json 或账号备份 JSON'),
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile', 'multiSelections']
    }
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, openOptions)
      : await dialog.showOpenDialog(openOptions)
    if (canceled || !filePaths[0]) {
      throw new Error(mainText('已取消'))
    }
    const importSummary = await service.importAuthJsonFromPaths(filePaths)
    await service.refreshMany(importSummary.accountIds)
    return { ...service.listAccounts(), importSummary }
  })

  ipcMain.handle('accounts:exportAuthJsonFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const openOptions: Electron.OpenDialogOptions = {
      title: mainText('选择 JSON 导出目录'),
      defaultPath: app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory']
    }
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, openOptions)
      : await dialog.showOpenDialog(openOptions)
    if (canceled || !filePaths[0]) {
      throw new Error(mainText('已取消'))
    }
    return service.exportAuthJsonToDirectory(filePaths[0])
  })

  ipcMain.handle('accounts:switch', async (_e, accountId: string) => {
    const result = await service.switchAccount(accountId)
    const list = service.listAccounts()
    return { ...result, ...list }
  })

  ipcMain.handle('accounts:refreshOne', async (_e, accountId: string) => {
    await service.refreshOne(accountId)
    return service.listAccounts()
  })

  ipcMain.handle('accounts:refreshAll', async () => {
    await service.refreshAll()
    return service.listAccounts()
  })

  ipcMain.handle('accounts:warmupNeverRefreshed', async () => {
    const warmup = await service.warmupNeverRefreshed()
    return { ...warmup, ...service.listAccounts() }
  })

  ipcMain.handle('accounts:warmupOne', async (_e, accountId: string) => {
    const result = await service.warmupOne(accountId)
    return {
      ...service.listAccounts(),
      warmupMode: result.mode,
      warmupMessage: result.message
    }
  })

  ipcMain.handle('accounts:refreshLive', async () => {
    const live = await service.refreshLive()
    return { live, ...service.listAccounts() }
  })

  ipcMain.handle('accounts:importLive', async () => {
    await service.importLive()
    return service.listAccounts()
  })

  ipcMain.handle('accounts:updateNickname', (_e, accountId: string, nickname: string) => {
    service.updateNickname(accountId, nickname)
    return service.listAccounts()
  })

  ipcMain.handle('accounts:reorder', (_e, accountIds: string[]) => {
    service.reorderAccounts(accountIds)
    return service.listAccounts()
  })

  ipcMain.handle('accounts:delete', (_e, accountId: string) => {
    const deleted = service.deleteAccount(accountId)
    if (!deleted) throw new Error(mainText('未找到账号'))
    return service.listAccounts()
  })

  ipcMain.handle('settings:getLocale', () => getLocale())

  ipcMain.handle('settings:setLocale', (_e, locale: unknown) => {
    if (isUiLocale(locale)) setLocale(locale)
    return getLocale()
  })

  ipcMain.handle('settings:getProxyUrl', () => getProxyUrl())

  ipcMain.handle('settings:setProxyUrl', (_e, proxyUrl: unknown) => {
    return setProxyUrl(typeof proxyUrl === 'string' ? proxyUrl : '')
  })

  ipcMain.handle('settings:getTheme', () => getTheme())

  ipcMain.handle('settings:setTheme', (_e, mode: unknown) => {
    if (isThemeMode(mode)) {
      const saved = setTheme(mode)
      applyThemeSource()
      return saved
    }
    return getTheme()
  })

  ipcMain.handle('settings:getQuotaViewMode', () => getQuotaViewMode())

  ipcMain.handle('settings:setQuotaViewMode', (_e, mode: unknown) => {
    if (isQuotaViewMode(mode)) return setQuotaViewMode(mode)
    return getQuotaViewMode()
  })

  ipcMain.handle('paths:get', () => buildPathsSnapshot())

  ipcMain.handle('paths:setCodexExePath', (_e, value: unknown) => {
    setCodexExePath(typeof value === 'string' ? value : '')
    invalidateCodexExeCache()
    return buildPathsSnapshot()
  })

  ipcMain.handle('paths:pickCodexExe', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const options: Electron.OpenDialogOptions = {
      title: mainText('选择 codex 执行文件'),
      defaultPath: app.getPath('home'),
      properties: ['openFile']
    }
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (!canceled && filePaths[0]) {
      setCodexExePath(filePaths[0])
      invalidateCodexExeCache()
    }
    return buildPathsSnapshot()
  })

  ipcMain.handle('paths:setCodexWorkDir', (_e, value: unknown) => {
    setCodexWorkDir(typeof value === 'string' ? value : '')
    return buildPathsSnapshot()
  })

  ipcMain.handle('paths:setCodexTerminal', (_e, value: unknown) => {
    setCodexTerminal(isCodexTerminal(value) ? value : 'auto')
    return buildPathsSnapshot()
  })

  ipcMain.handle('codex:listProcesses', () => listCodexProcesses())

  ipcMain.handle('codex:stop', async () => {
    return stopCodexProcesses()
  })

  ipcMain.handle('codex:start', () => startCodex())

  ipcMain.handle('codex:restart', async () => {
    return restartCodex()
  })
}

app.whenReady().then(() => {
  runDebugModeIfNeeded()
    .then((handled) => {
      if (handled) return
      Menu.setApplicationMenu(null)
      registerIpc()
      createWindow()
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
      })
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.stack ?? err.message : String(err)
      process.stderr.write(`${msg}\n`)
      app.quit()
    })
})

app.on('window-all-closed', () => {
  if (isDebugMode()) return
  if (process.platform !== 'darwin') app.quit()
})
