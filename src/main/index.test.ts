import { EventEmitter } from 'events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  app: Object.assign(new (class {
    setName = vi.fn()
    setAppUserModelId = vi.fn()
    requestSingleInstanceLock = vi.fn(() => true)
    whenReady = vi.fn(() => Promise.resolve())
    quit = vi.fn()
  })(), { on: vi.fn() }),
  windows: [] as any[],
  createTray: vi.fn(),
  destroyTray: vi.fn(),
  refreshAll: vi.fn(async () => [])
}))

vi.mock('electron', async () => {
  const { EventEmitter } = await import('events')
  return {
    app: mocks.app,
    BrowserWindow: class extends EventEmitter {
      isDestroyed = vi.fn(() => false)
      isMinimized = vi.fn(() => false)
      isVisible = vi.fn(() => true)
      restore = vi.fn()
      show = vi.fn()
      focus = vi.fn()
      loadFile = vi.fn()
      loadURL = vi.fn()
      webContents = { openDevTools: vi.fn() }
      constructor() {
        super()
        mocks.windows.push(this)
      }
    },
    dialog: {},
    ipcMain: { handle: vi.fn() },
    Menu: { setApplicationMenu: vi.fn() },
    nativeTheme: { shouldUseDarkColors: false }
  }
})
vi.mock('./account-service', () => ({
  AccountService: class {
    refreshAll = mocks.refreshAll
  }
}))
vi.mock('./codex-process', () => ({}))
vi.mock('./paths', () => ({ invalidateCodexExeCache: vi.fn() }))
vi.mock('./settings', () => ({ getTheme: () => 'system', mainText: (text: string) => text }))
vi.mock('./tray', () => ({
  createTray: mocks.createTray,
  destroyTray: mocks.destroyTray,
  isTrayAvailable: () => true,
  notifyHiddenToTray: vi.fn(),
  resolveAppIcon: () => ''
}))

describe('main process lifecycle', () => {
  let events: EventEmitter
  let originalExitListeners: Array<(code: number) => void>

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.useFakeTimers()
    events = new EventEmitter()
    mocks.app.on.mockImplementation((name, listener) => {
      events.on(name, listener)
      return mocks.app
    })
    mocks.app.requestSingleInstanceLock.mockReturnValue(true)
    mocks.windows.length = 0
    originalExitListeners = process.listeners('exit')
    vi.stubEnv('CODEX_DEBUG_REFRESH_ALL', '')
    vi.stubEnv('CODEX_DEBUG_WARMUP_ID', '')
  })

  afterEach(() => {
    for (const listener of process.listeners('exit')) {
      if (!originalExitListeners.includes(listener)) process.removeListener('exit', listener)
    }
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  async function boot(): Promise<void> {
    await import('./index')
    await Promise.resolve()
  }

  it('exits a duplicate launch without creating a window or tray', async () => {
    mocks.app.requestSingleInstanceLock.mockReturnValue(false)
    await boot()
    expect(mocks.app.quit).toHaveBeenCalledOnce()
    expect(mocks.app.whenReady).not.toHaveBeenCalled()
    expect(mocks.windows).toHaveLength(0)
    expect(mocks.createTray).not.toHaveBeenCalled()
  })

  it('restores and focuses the existing window on repeated launches', async () => {
    await boot()
    const win = mocks.windows[0]
    win.emit('ready-to-show')
    win.isMinimized.mockReturnValue(true)
    events.emit('second-instance')
    events.emit('second-instance')
    expect(win.restore).toHaveBeenCalledTimes(2)
    expect(win.focus).toHaveBeenCalledTimes(2)
    expect(mocks.windows).toHaveLength(1)
    expect(mocks.createTray).toHaveBeenCalledOnce()
  })

  it('recreates a hibernated window without creating another tray', async () => {
    await boot()
    mocks.windows[0].isDestroyed.mockReturnValue(true)
    events.emit('second-instance')
    expect(mocks.windows).toHaveLength(2)
    expect(mocks.createTray).toHaveBeenCalledOnce()
  })

  it('removes the tray before quitting and has an exit fallback', async () => {
    await boot()
    events.emit('before-quit')
    expect(mocks.destroyTray).toHaveBeenCalledOnce()
    const exitListener = process.listeners('exit').find((listener) => !originalExitListeners.includes(listener))
    expect(exitListener).toBeDefined()
    exitListener!(0)
    expect(mocks.destroyTray).toHaveBeenCalledTimes(2)
  })
})
