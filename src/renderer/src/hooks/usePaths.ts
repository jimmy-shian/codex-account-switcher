import { useCallback, useEffect, useState } from 'react'
import type { CodexProcessInfo, CodexTerminal, PathsSnapshot } from '@shared/types'

const EMPTY_PATHS: PathsSnapshot = {
  ccSwitchAuthPathOverride: '',
  ccSwitchAuthPathResolved: '',
  ccSwitchAuthCandidates: [],
  codexExePathOverride: '',
  codexExePathResolved: '',
  codexWorkDir: '',
  codexWorkDirOverride: '',
  codexTerminal: 'auto',
  codexStopGraceMs: 1500
}

const POLL_INTERVAL_MS = 4000

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
  pickCcSwitch: () => Promise<void>
  commitCcSwitch: (value: string) => Promise<void>
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

  const reloadPaths = useCallback(async () => {
    try {
      setPaths(await window.codexSwitcher.getPaths())
    } catch {
      /* 讀不到設定時維持上一次結果 */
    }
  }, [])

  const refreshRunning = useCallback(async () => {
    try {
      setRunning(await window.codexSwitcher.listCodexProcesses())
    } catch {
      setRunning([])
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
    return () => window.clearInterval(timer)
  }, [refreshRunning])

  const pickCcSwitch = useCallback(async () => {
    setBusy(true)
    try {
      setPaths(await window.codexSwitcher.pickCcSwitchAuthPath())
    } finally {
      setBusy(false)
    }
  }, [])

  const commitCcSwitch = useCallback(
    async (value: string) => {
      if (value === paths.ccSwitchAuthPathOverride) return
      setPaths(await window.codexSwitcher.setCcSwitchAuthPath(value))
    },
    [paths.ccSwitchAuthPathOverride]
  )

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

  return {
    paths,
    running,
    busy,
    open,
    setOpen,
    reloadPaths,
    refreshRunning,
    pickCcSwitch,
    commitCcSwitch,
    pickCodexExe,
    commitCodexExe,
    commitWorkDir,
    changeTerminal,
    restart,
    toggle
  }
}
