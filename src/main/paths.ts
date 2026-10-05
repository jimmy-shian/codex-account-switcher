import { execFileSync } from 'child_process'
import { app } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'

const CODEX_NAMES = ['codex.exe', 'codex.cmd', 'codex'] as const

function firstExistingInDir(dir: string): string | null {
  for (const name of CODEX_NAMES) {
    const p = path.join(dir, name)
    if (fs.existsSync(p)) return p
  }
  return null
}

function resolveCodexViaWhere(): string | null {
  if (process.platform !== 'win32') return null
  try {
    const out = execFileSync('where.exe', ['codex'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
    const lines = out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    const lower = (s: string) => s.toLowerCase()
    const pick =
      lines.find((l) => lower(l).endsWith('codex.exe')) ??
      lines.find((l) => lower(l).endsWith('codex.cmd')) ??
      lines.find((l) => lower(l).endsWith('codex.bat')) ??
      lines.find((l) => /\.(exe|cmd|bat)$/i.test(l)) ??
      lines[0]
    if (!pick) return null
    return fs.existsSync(pick) ? pick : null
  } catch {
    return null
  }
}

const APPX_CACHE_TTL_MS = 60_000
let appxCache: { at: number; value: string | null } | null = null

/** 偵測 Windows 官方 Codex 桌面版 UWP / WindowsApps 套件 AppID（帶快取，避免每次 paths:get 都掃目錄） */
export function resolveCodexAppxPackageId(): string | null {
  if (process.platform !== 'win32') return null
  const now = Date.now()
  if (appxCache && now - appxCache.at < APPX_CACHE_TTL_MS) return appxCache.value
  let value: string | null = null
  try {
    const packagesDir = path.join(os.homedir(), 'AppData', 'Local', 'Packages')
    if (fs.existsSync(packagesDir)) {
      const entries = fs.readdirSync(packagesDir)
      const hit = entries.find((dir) => /^OpenAI\.Codex_/i.test(dir))
      if (hit) value = `${hit}!App`
    }
  } catch {
    /* ignore */
  }
  appxCache = { at: now, value }
  return value
}

function resolveOpenAiCodexExe(): string | null {
  const binDir = path.join(os.homedir(), 'AppData', 'Local', 'OpenAI', 'Codex', 'bin')
  const candidates: Array<{ path: string; mtimeMs: number }> = []

  const pushIfExists = (p: string): void => {
    try {
      const stat = fs.statSync(p)
      if (stat.isFile()) candidates.push({ path: p, mtimeMs: stat.mtimeMs })
    } catch {
      /* */
    }
  }

  pushIfExists(path.join(binDir, 'codex.exe'))
  try {
    for (const entry of fs.readdirSync(binDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      pushIfExists(path.join(binDir, entry.name, 'codex.exe'))
    }
  } catch {
    /* */
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return candidates[0]?.path ?? null
}

export function getLiveAuthPath(): string {
  return path.join(os.homedir(), '.codex', 'auth.json')
}

export function getCodexDir(): string {
  return path.join(os.homedir(), '.codex')
}

export function resolveBundledCodexExe(): string | null {
  if (app.isPackaged) {
    const dir = path.join(process.resourcesPath, 'resources')
    return firstExistingInDir(dir)
  }
  const dirs = [
    path.join(process.cwd(), 'resources'),
    path.join(app.getAppPath(), 'resources')
  ]
  for (const dir of dirs) {
    const hit = firstExistingInDir(dir)
    if (hit) return hit
  }
  return null
}

export function resolveSystemCodexExe(): string | null {
  const openAiCodex = resolveOpenAiCodexExe()
  if (openAiCodex) return openAiCodex

  const viaWhere = resolveCodexViaWhere()
  if (viaWhere) return viaWhere

  const pathEnv = process.env.PATH ?? ''
  const parts = pathEnv.split(path.delimiter)
  for (const dir of parts) {
    if (!dir) continue
    const hit = firstExistingInDir(dir)
    if (hit) return hit
  }

  const npmGlobalCmd = path.join(process.env.APPDATA ?? '', 'npm', 'codex.cmd')
  if (fs.existsSync(npmGlobalCmd)) return npmGlobalCmd

  const nodeDir = path.dirname(process.execPath)
  const nodeCodex = firstExistingInDir(nodeDir)
  if (nodeCodex) return nodeCodex

  const local = path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'codex', 'codex.exe')
  if (fs.existsSync(local)) return local
  return null
}

const EXE_CACHE_TTL_MS = 30_000
let exeCache: { at: number; value: string | null } | null = null

export function resolveCodexExecutable(): string | null {
  const now = Date.now()
  if (exeCache && now - exeCache.at < EXE_CACHE_TTL_MS) return exeCache.value
  const value = resolveBundledCodexExe() ?? resolveSystemCodexExe()
  exeCache = { at: now, value }
  return value
}

/** 路徑被使用者修改後呼叫，立即失效快取 */
export function invalidateCodexExeCache(): void {
  exeCache = null
  appxCache = null
}

export function getUserDataAccountsDir(): string {
  const d = path.join(app.getPath('userData'), 'data')
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
  return d
}

export function getAccountsJsonPath(): string {
  return path.join(getUserDataAccountsDir(), 'accounts.json')
}

export function blobPathForRef(ref: string): string {
  return path.join(getUserDataAccountsDir(), ref)
}
