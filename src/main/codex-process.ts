import { execFile, execFileSync, spawn } from 'child_process'
import fs from 'fs'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
import type {
  CodexLaunchResult,
  CodexPathSnapshot,
  CodexProcessInfo,
  CodexRestartResult,
  CodexStopResult,
  CodexTerminal
} from '@shared/types'
import {
  getCodexExePathOverride,
  getCodexStopGraceMs,
  getCodexTerminal,
  getCodexWorkDir,
  getCodexWorkDirOverride
} from './settings'
import { resolveCodexAppxPackageId, resolveCodexExecutable } from './paths'

/** 執行中與 codex 相關的程序名，包含官方桌面版主程式與背景程序 */
const CODEX_PROCESS_NAMES = new Set([
  'codex.exe',
  'codex-cua.exe',
  'codex-computer-use-swift.exe',
  'chatgpt.exe'
])

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

/**
 * 非阻塞版本：同 runCommand 但走 async execFile，不凍結主線程事件循環。
 * 程序列表輪詢走這條路，避免 resize / minimize 時視窗無回應白屏。
 */
async function runCommandAsync(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout } = await execFileAsync(command, args, {
      encoding: 'utf8',
      windowsHide: true,
      timeout: timeoutMs
    })
    return { ok: true, stdout: stdout as string, stderr: '' }
  } catch (e) {
    const err = e as { stdout?: unknown; stderr?: unknown; message?: unknown }
    return {
      ok: false,
      stdout: typeof err.stdout === 'string' ? err.stdout : '',
      stderr: typeof err.stderr === 'string' ? err.stderr : String(err.message ?? e)
    }
  }
}

function parseTasklistCsv(stdout: string, seenPids: Set<number>): CodexProcessInfo[] {
  const processes: CodexProcessInfo[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('"')) continue
    const fields = trimmed.split('","').map((f) => f.replace(/^"|"$/g, ''))
    const pid = Number(fields[1])
    if (!Number.isFinite(pid) || pid <= 0 || seenPids.has(pid)) continue
    seenPids.add(pid)
    processes.push({ pid, name: fields[0], exePath: '' })
  }
  return processes
}

/** 用 tasklist 列出 codex 與桌面版相關程序（非阻塞並行版） */
async function listViaTasklistAsync(): Promise<CodexProcessInfo[]> {
  const seenPids = new Set<number>()
  const results = await Promise.all(
    ['codex.exe', 'ChatGPT.exe', 'codex-computer-use-swift.exe'].map((imageName) =>
      runCommandAsync('tasklist.exe', ['/FO', 'CSV', '/NH', '/FI', `IMAGENAME eq ${imageName}`], 5000)
    )
  )
  const processes: CodexProcessInfo[] = []
  for (const result of results) {
    if (!result.ok) continue
    processes.push(...parseTasklistCsv(result.stdout, seenPids))
  }
  return processes
}

/** tasklist 拿不到路徑，用 WMIC 補齊，讓 UI 能顯示完整路徑（非阻塞版） */
async function fillExePathsAsync(processes: CodexProcessInfo[]): Promise<CodexProcessInfo[]> {
  if (processes.length === 0) return processes
  // 只有 ChatGPT.exe 需要路徑來判斷是否為 Codex 桌面版；純 codex.exe 列表可跳過慢速 wmic
  const needsPath = processes.some((p) => p.name.toLowerCase() === 'chatgpt.exe')
  if (!needsPath) return processes
  const result = await runCommandAsync(
    'wmic',
    ['process', 'where', "(name='codex.exe' or name='ChatGPT.exe')", 'get', 'ProcessId,ExecutablePath', '/format:csv'],
    6000
  )
  if (!result.ok) return processes
  const pathByPid = new Map<number, string>()
  for (const line of result.stdout.split(/\r?\n/)) {
    const fields = line.split(',').map((f) => f.trim())
    if (fields.length < 3) continue
    const pid = Number(fields[fields.length - 1])
    const exePath = fields[fields.length - 2]
    if (Number.isFinite(pid) && exePath) pathByPid.set(pid, exePath)
  }
  return processes.map((p) => ({ ...p, exePath: pathByPid.get(p.pid) ?? p.exePath }))
}

async function listCodexProcessesUncached(): Promise<CodexProcessInfo[]> {
  const rawList = await listViaTasklistAsync()
  const filtered = rawList.filter((p) => CODEX_PROCESS_NAMES.has(p.name.toLowerCase()))
  const filled = await fillExePathsAsync(filtered)
  // 如果是 ChatGPT.exe，必須確認路徑包含 OpenAI.Codex，避免誤判非 Codex 程式
  return filled.filter((p) => {
    if (p.name.toLowerCase() === 'chatgpt.exe') {
      return !p.exePath || /openai\.codex/i.test(p.exePath)
    }
    return true
  })
}

// 程序列表快取 + 單飛：renderer 每幾秒輪詢一次，合併併發請求並在 TTL 內直接回快取，
// 避免重複 spawn tasklist/wmic 拖慢主進程。
const LIST_CACHE_TTL_MS = 2000
let listCache: { at: number; data: CodexProcessInfo[] } | null = null
let listInFlight: Promise<CodexProcessInfo[]> | null = null

function invalidateListCache(): void {
  listCache = null
}

/** 目前執行中的 codex 程序（過濾非 Codex 相關的 ChatGPT 程序） */
export async function listCodexProcesses(): Promise<CodexProcessInfo[]> {
  const now = Date.now()
  if (listCache && now - listCache.at < LIST_CACHE_TTL_MS) return listCache.data
  if (listInFlight) return listInFlight
  listInFlight = listCodexProcessesUncached()
    .then((data) => {
      listCache = { at: Date.now(), data }
      return data
    })
    .finally(() => {
      listInFlight = null
    })
  return listInFlight
}

/** 同步舊版保留給極少數同步呼叫端；高頻輪詢請用 async listCodexProcesses */
export function listCodexProcessesSync(): CodexProcessInfo[] {
  if (listCache) return listCache.data
  return []
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
 * 關閉所有 codex 程序與桌面應用程式。
 * 先嘗試溫和關閉，等待 graceMs 後強制結束，確保乾淨終止。
 */
export async function stopCodexProcesses(graceMs = getCodexStopGraceMs()): Promise<CodexStopResult> {
  const before = await listCodexProcesses()
  if (before.length === 0) return { stopped: [], remaining: [] }

  invalidateListCache()
  await Promise.all(
    before.map((p) => runCommandAsync('taskkill.exe', ['/PID', String(p.pid), '/T'], 3000))
  )

  const wait = Math.max(0, Math.min(10000, graceMs))
  if (wait > 0) await sleep(wait)

  // 強制終止仍存活的程序（包含子程序樹）
  const stillAlive = before.filter((p) => isProcessAlive(p.pid))
  if (stillAlive.length > 0) {
    await Promise.all(
      stillAlive.map((p) => runCommandAsync('taskkill.exe', ['/F', '/PID', String(p.pid), '/T'], 4000))
    )
    // 額外確保映像檔完全關閉
    await Promise.all([
      runCommandAsync('taskkill.exe', ['/F', '/IM', 'ChatGPT.exe', '/T'], 4000),
      runCommandAsync('taskkill.exe', ['/F', '/IM', 'codex.exe', '/T'], 4000),
      runCommandAsync('taskkill.exe', ['/F', '/IM', 'codex-computer-use-swift.exe', '/T'], 4000)
    ])
    await sleep(300)
  }

  const stopped: CodexProcessInfo[] = []
  const remaining: number[] = []
  for (const p of before) {
    if (isProcessAlive(p.pid)) remaining.push(p.pid)
    else stopped.push(p)
  }
  return { stopped, remaining }
}

let terminalCache: { at: number; value: CodexTerminal } | null = null
const TERMINAL_CACHE_TTL_MS = 60_000

function resolveTerminal(): CodexTerminal {
  const configured = getCodexTerminal()
  if (configured !== 'auto') return configured
  if (process.platform !== 'win32') return 'none'
  const now = Date.now()
  if (terminalCache && now - terminalCache.at < TERMINAL_CACHE_TTL_MS) return terminalCache.value
  const wt = runCommand('where.exe', ['wt.exe'], 4000)
  const value: CodexTerminal = wt.ok ? 'wt' : 'cmd'
  terminalCache = { at: now, value }
  return value
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

/** 啟動 codex；優先支援官方桌面版應用，其次透過終端機執行 CLI */
export function launchCodex(): CodexLaunchResult {
  const override = getCodexExePathOverride()
  const appxId = !override ? resolveCodexAppxPackageId() : null

  // 若使用者未自訂 CLI 路徑，且系統安裝了官方桌面版應用，優先啟動官方桌面應用
  if (appxId) {
    const pid = spawnDetached('cmd.exe', ['/c', 'start', '', `shell:AppsFolder\\${appxId}`], process.cwd())
    return {
      launched: pid != null,
      via: 'appx',
      exePath: appxId,
      workDir: process.cwd(),
      pid,
      message: pid != null ? '已启动 Codex 桌面版应用' : 'Codex 桌面版应用启动失败'
    }
  }

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
      message: '找不到 codex 执行档，请在「路径设置」指定'
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
      message: pid != null ? '已在 Windows Terminal 启动 codex' : 'Windows Terminal 启动失败'
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
      message: pid != null ? '已打开 cmd 窗口启动 codex' : 'cmd 启动失败'
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
    message: pid != null ? '已启动 codex' : 'codex 启动失败'
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
export function getCodexPathSnapshot(): CodexPathSnapshot {
  const workDirOverride = getCodexWorkDirOverride()
  const override = getCodexExePathOverride()
  const resolved = override || resolveCodexExecutable() || (resolveCodexAppxPackageId() ? '官方桌面应用 (Desktop App)' : '')
  return {
    codexExePathOverride: override,
    codexExePathResolved: resolved,
    codexWorkDir: getCodexWorkDir(),
    codexWorkDirOverride: workDirOverride,
    codexTerminal: getCodexTerminal(),
    codexStopGraceMs: getCodexStopGraceMs()
  }
}

