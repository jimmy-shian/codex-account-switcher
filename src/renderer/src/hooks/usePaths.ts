import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CodexProcessInfo, CodexTerminal, PathsSnapshot } from '@shared/types'

const EMPTY_PATHS: PathsSnapshot = {
  codexExePathOverride: '',
  codexExePathResolved: '',
  codexWorkDir: '',
  codexWorkDirOverride: '',
  codexTerminal: 'auto',
  codexStopGraceMs: 1500
}

// 主進程已改為非阻塞 + 2s 快取；renderer 側再降頻到 8s，並在隱藏 / 最小化時暫停，
// 避免縮小視窗期間仍不斷 spawn 子進程造成卡頓與白屏。
const POLL_INTERVAL_MS = 8000

function samePaths(a: PathsSnapshot, b: PathsSnapshot): boolean {
  return (
    a.codexExePathOverride === b.codexExePathOverride &&
    a.codexExePathResolved === b.codexExePathResolved &&
    a.codexWorkDir === b.codexWorkDir &&
    (a.codexWorkDirOverride ?? '') === (b.codexWorkDirOverride ?? '') &&
    a.codexTerminal === b.codexTerminal &&
    a.codexStopGraceMs === b.codexStopGraceMs
  )
}

function sameProcesses(a: CodexProcessInfo[], b: CodexProcessInfo[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].pid !== b[i].pid || a[i].name !== b[i].name || (a[i].exePath ?? '') !== (b[i].exePath ?? '')) return false
  }
  return true
}

/**
 * 路徑設定與 codex 程序狀態。
 * 路徑來源是 main process 的自動偵測，renderer 只負責編輯與顯示。
 */
export function usePaths(): {
  paths: PathsSnapshot
  running: CodexProcessInfo[]
  busy: boolean
  open: boolean
  setOpen: (open: boolean) => void
  reloadPaths: () => Promise<void>
  refreshRunning: () => Promise<void>
  pickCodexExe: () => Promise<void>
  commitCodexExe: (value: string) => Promise<void>
  commitWorkDir: (value: string) => Promise<void>
  changeTerminal: (value: CodexTerminal) => Promise<void>
  restart: () => Promise<{ message: string }>
  /** 依目前狀態自動決定啟動或關閉 */
  toggle: () => Promise<{ message: string }>
} {
  const [paths, setPaths] = useState<PathsSnapshot>(EMPTY_PATHS)
  const [running, setRunning] = useState<CodexProcessInfo[]>([])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  // 避免輪詢請求堆疊：上一次還沒回來就跳過這次
  const runningInFlightRef = useRef(false)

  const reloadPaths = useCallback(async () => {
    try {
      const next = await window.codexSwitcher.getPaths()
      setPaths((prev) => (samePaths(prev, next) ? prev : next))
    } catch {
      /* 讀不到設定時維持上一次結果 */
    }
  }, [])

  const refreshRunning = useCallback(async () => {
    // 最小化 / 切到背景分頁時暫停輪詢，恢復後由 visibilitychange 立即補一次
    if (typeof document !== 'undefined' && document.hidden) return
    if (runningInFlightRef.current) return
    runningInFlightRef.current = true
    try {
      const next = await window.codexSwitcher.listCodexProcesses()
      setRunning((prev) => (sameProcesses(prev, next) ? prev : next))
    } catch {
      setRunning((prev) => (prev.length === 0 ? prev : []))
    } finally {
      runningInFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    void reloadPaths()
    void refreshRunning()
  }, [reloadPaths, refreshRunning])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshRunning()
    }, POLL_INTERVAL_MS)
    // 從最小化還原 / 切回前景時立即補一次，避免顯示過期狀態；平時靠 interval 即可
    const onVisible = () => {
      if (!document.hidden) void refreshRunning()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [refreshRunning])

  const pickCodexExe = useCallback(async () => {
    setBusy(true)
    try {
      setPaths(await window.codexSwitcher.pickCodexExe())
    } finally {
      setBusy(false)
    }
  }, [])

  const commitCodexExe = useCallback(
    async (value: string) => {
      if (value === paths.codexExePathOverride) return
      setPaths(await window.codexSwitcher.setCodexExePath(value))
    },
    [paths.codexExePathOverride]
  )

  const commitWorkDir = useCallback(async (value: string) => {
    setPaths(await window.codexSwitcher.setCodexWorkDir(value))
  }, [])

  const changeTerminal = useCallback(async (value: CodexTerminal) => {
    setPaths(await window.codexSwitcher.setCodexTerminal(value))
  }, [])

  const restart = useCallback(async () => {
    setBusy(true)
    try {
      const r = await window.codexSwitcher.restartCodex()
      await refreshRunning()
      return { message: r.message }
    } finally {
      setBusy(false)
    }
  }, [refreshRunning])

  const stop = useCallback(async () => {
    setBusy(true)
    try {
      const r = await window.codexSwitcher.stopCodex()
      await refreshRunning()
      return {
        message: r.stopped.length === 0 ? '没有运行中的 Codex' : `已关闭 ${r.stopped.length} 个 Codex 进程`
      }
    } finally {
      setBusy(false)
    }
  }, [refreshRunning])

  const start = useCallback(async () => {
    setBusy(true)
    try {
      const r = await window.codexSwitcher.startCodex()
      await refreshRunning()
      return { message: r.message }
    } finally {
      setBusy(false)
    }
  }, [refreshRunning])

  /** 程序存在就關閉，沒有就啟動；呼叫端不需要自己判斷 */
  const toggle = useCallback(async () => {
    const alive = await window.codexSwitcher.listCodexProcesses()
    return alive.length > 0 ? stop() : start()
  }, [start, stop])

  // 穩定引用：paths.running 沒變時不讓父層回調與子樹跟著重建，減少每次 render 的連帶重排
  return useMemo(
    () => ({
      paths,
      running,
      busy,
      open,
      setOpen,
      reloadPaths,
      refreshRunning,
      pickCodexExe,
      commitCodexExe,
      commitWorkDir,
      changeTerminal,
      restart,
      toggle
    }),
    [
      paths,
      running,
      busy,
      open,
      reloadPaths,
      refreshRunning,
      pickCodexExe,
      commitCodexExe,
      commitWorkDir,
      changeTerminal,
      restart,
      toggle
    ]
  )
}
