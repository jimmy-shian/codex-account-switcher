import { execFileSync, spawn } from 'child_process'
import fs from 'fs'
import type {
  CodexLaunchResult,
  CodexPathSnapshot,
  CodexProcessInfo,
  CodexRestartResult,
  CodexStopResult,
  CodexTerminal
} from '@shared/types'
import {
  getCcSwitchAuthPathOverride,
  getCodexExePathOverride,
  getCodexStopGraceMs,
  getCodexTerminal,
  getCodexWorkDir,
  getCodexWorkDirOverride
} from './settings'
import { resolveCodexExecutable } from './paths'

/** 執行中與 codex 相關的程序名，避免誤關其他 OpenAI 工具 */
const CODEX_PROCESS_NAMES = new Set(['codex.exe', 'codex-cua.exe'])

function runCommand(
  command: string,
  args: string[],
  timeoutMs: number
): { ok: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(command, args, {
      encoding: 'utf8',
      windowsHide: true,
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    return { ok: true, stdout, stderr: '' }
  } catch (e) {
    const err = e as { stdout?: unknown; stderr?: unknown; message?: unknown }
    return {
      ok: false,
      stdout: typeof err.stdout === 'string' ? err.stdout : '',
      stderr: typeof err.stderr === 'string' ? err.stderr : String(err.message ?? e)
    }
  }
}

/** 用 tasklist 列出 codex 程序，避免額外 PowerShell 啟動成本 */
function listViaTasklist(): CodexProcessInfo[] {
  const result = runCommand('tasklist.exe', ['/FO', 'CSV', '/NH', '/FI', 'IMAGENAME eq codex.exe'], 8000)
  if (!result.ok) return []
  const processes: CodexProcessInfo[] = []
  for (const line of result.stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('"')) continue
    const fields = trimmed.split('","').map((f) => f.replace(/^"|"$/g, ''))
    const pid = Number(fields[1])
    if (!Number.isFinite(pid) || pid <= 0) continue
    processes.push({ pid, name: fields[0], exePath: '' })
  }
  return processes
}

/** tasklist 拿不到路徑，用 WMIC 補齊，讓 UI 能顯示完整路徑 */
function fillExePaths(processes: CodexProcessInfo[]): CodexProcessInfo[] {
  if (processes.length === 0) return processes
  const result = runCommand(
    'wmic',
    ['process', 'where', "name='codex.exe'", 'get', 'ProcessId,ExecutablePath', '/format:csv'],
    10000
  )
  if (!result.ok) return processes
  const pathByPid = new Map<number, string>()
  for (const line of result.stdout.split(/\r?\n/)) {
    const fields = line.split(',').map((f) => f.trim())
    if (fields.length < 3) continue
    const pid = Number(fields[fields.length - 2])
    const exePath = fields[fields.length - 1]
    if (Number.isFinite(pid) && exePath) pathByPid.set(pid, exePath)
  }
  return processes.map((p) => ({ ...p, exePath: pathByPid.get(p.pid) ?? p.exePath }))
}

/** 目前執行中的 codex 程序 */
export function listCodexProcesses(): CodexProcessInfo[] {
  const processes = listViaTasklist().filter((p) => CODEX_PROCESS_NAMES.has(p.name.toLowerCase()))
  return fillExePaths(processes)
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 關閉所有 codex 程序。
 * 先請求溫和關閉（WM_CLOSE），等待 graceMs 後才強制結束，避免使用者未存檔的內容直接消失。
 */
export async function stopCodexProcesses(graceMs = getCodexStopGraceMs()): Promise<CodexStopResult> {
  const before = listCodexProcesses()
  if (before.length === 0) return { stopped: [], remaining: [] }

  for (const p of before) {
    runCommand('taskkill.exe', ['/PID', String(p.pid), '/T'], 5000)
  }

  const wait = Math.max(0, Math.min(10000, graceMs))
  if (wait > 0) await sleep(wait)

  const stillAlive = before.filter((p) => isProcessAlive(p.pid))
  for (const p of stillAlive) {
    runCommand('taskkill.exe', ['/F', '/PID', String(p.pid), '/T'], 5000)
  }
  if (stillAlive.length > 0) await sleep(300)

  const stopped: CodexProcessInfo[] = []
  const remaining: number[] = []
  for (const p of before) {
    if (isProcessAlive(p.pid)) remaining.push(p.pid)
    else stopped.push(p)
  }
  return { stopped, remaining }
}

function resolveTerminal(): CodexTerminal {
  const configured = getCodexTerminal()
  if (configured !== 'auto') return configured
  if (process.platform !== 'win32') return 'none'
  const wt = runCommand('where.exe', ['wt.exe'], 4000)
  return wt.ok ? 'wt' : 'cmd'
}

function spawnDetached(command: string, args: string[], cwd: string): number | null {
  try {
    const child = spawn(command, args, {
      cwd,
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
      shell: false
    })
    child.unref()
    return child.pid ?? null
  } catch {
    return null
  }
}

/** 啟動 codex；終端機選擇為 auto 時優先 Windows Terminal，其次 cmd */
export function launchCodex(): CodexLaunchResult {
  const override = getCodexExePathOverride()
  const exePath = override || resolveCodexExecutable()
  const workDir = getCodexWorkDir()
  const cwd = fs.existsSync(workDir) ? workDir : process.cwd()

  if (!exePath) {
    return {
      launched: false,
      via: null,
      exePath: '',
      workDir: cwd,
      pid: null,
      message: '找不到 codex 執行檔，請在「路徑設定」指定'
    }
  }

  const terminal = resolveTerminal()
  const isBatch = /\.(cmd|bat)$/i.test(exePath)
  const commandLine = isBatch ? `"${exePath}"` : `"${exePath}"`

  if (terminal === 'wt') {
    const args = ['new-tab', '--title', 'Codex', '-d', cwd, 'cmd.exe', '/k', commandLine]
    const pid = spawnDetached('wt.exe', args, cwd)
    return {
      launched: pid != null,
      via: 'wt',
      exePath,
      workDir: cwd,
      pid,
      message: pid != null ? '已在 Windows Terminal 啟動 codex' : 'Windows Terminal 啟動失敗'
    }
  }

  if (terminal === 'cmd') {
    // start 會另開主控台視窗，視窗關閉時 codex 一併結束
    const pid = spawnDetached('cmd.exe', ['/c', 'start', '"Codex"', 'cmd.exe', '/k', commandLine], cwd)
    return {
      launched: pid != null,
      via: 'cmd',
      exePath,
      workDir: cwd,
      pid,
      message: pid != null ? '已開啟 cmd 視窗啟動 codex' : 'cmd 啟動失敗'
    }
  }

  // none：直接執行，需要 .cmd/.bat 時以 shell 執行
  const pid = isBatch
    ? spawnDetached('cmd.exe', ['/c', commandLine], cwd)
    : spawnDetached(exePath, [], cwd)
  return {
    launched: pid != null,
    via: 'none',
    exePath,
    workDir: cwd,
    pid,
    message: pid != null ? '已啟動 codex' : 'codex 啟動失敗'
  }
}

/** 一鍵關閉再啟動 codex，讓切換帳號後能在同一介面繼續用 */
export async function restartCodex(): Promise<CodexRestartResult> {
  const { stopped, remaining } = await stopCodexProcesses()
  const launched = launchCodex()
  return { ...launched, stopped, remaining }
}

/** 只啟動，不關閉現有程序 */
export function startCodex(): CodexLaunchResult {
  return launchCodex()
}

/** 一次回傳自訂值與自動偵測結果，讓 UI 直接顯示目前實際使用的路徑 */
export function getCodexPathSnapshot(ccSwitchResolved: string): CodexPathSnapshot {
  const ccSwitchOverride = getCcSwitchAuthPathOverride()
  const workDirOverride = getCodexWorkDirOverride()
  return {
    ccSwitchAuthPathOverride: ccSwitchOverride,
    // 自訂覆寫優先，其次才是自動偵測結果，UI 才能顯示實際使用的路徑
    ccSwitchAuthPathResolved: ccSwitchOverride || ccSwitchResolved || '',
    codexExePathOverride: getCodexExePathOverride(),
    codexExePathResolved: getCodexExePathOverride() || resolveCodexExecutable() || '',
    codexWorkDir: getCodexWorkDir(),
    codexWorkDirOverride: workDirOverride,
    codexTerminal: getCodexTerminal(),
    codexStopGraceMs: getCodexStopGraceMs()
  }
}

