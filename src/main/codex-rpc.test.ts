import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodexRpcClient } from './codex-rpc'

describe('CodexRpcClient', () => {
  const dirs: string[] = []

  afterEach(() => {
    vi.useRealTimers()
    for (const dir of dirs.splice(0)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true })
      } catch {
        /* */
      }
    }
  })

  it('对挂起的 RPC 请求执行超时兜底', async () => {
    vi.useFakeTimers()
    const client = new CodexRpcClient('codex', 'home') as any
    client.proc = {
      stdin: { write: vi.fn() },
      kill: vi.fn()
    }

    const pending = client.request('account/read', { refreshToken: true }, 1234)
    const assertion = expect(pending).rejects.toThrow('RPC account/read 超时（1234ms）')
    await vi.advanceTimersByTimeAsync(1234)
    await assertion
  })

  it('dispose 会拒绝所有未完成请求', async () => {
    const client = new CodexRpcClient('codex', 'home') as any
    client.proc = {
      stdin: { write: vi.fn() },
      kill: vi.fn()
    }

    const pending = client.request('account/rateLimits/read', {}, 5000)
    const assertion = expect(pending).rejects.toThrow('codex app-server 已关闭')
    client.dispose()
    await assertion
  })

  it('thread.path 缺失时按 threadId 从 sessions 目录读取 token_count 配额', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-rpc-test-'))
    dirs.push(home)
    const threadId = '019e3f58-9895-7a03-a15d-dcea8250295f'
    const sessionDir = path.join(home, 'sessions', '2026', '05', '19')
    fs.mkdirSync(sessionDir, { recursive: true })
    fs.writeFileSync(
      path.join(sessionDir, `rollout-2026-05-19T16-28-04-${threadId}.jsonl`),
      `${JSON.stringify({
        type: 'event_msg',
        payload: {
          type: 'token_count',
          rateLimits: {
            limitId: 'codex',
            primary: { usedPercent: 5, windowDurationMins: 300, resetsAt: 123 }
          }
        }
      })}\n`,
      'utf8'
    )

    const client = new CodexRpcClient('codex', home) as any
    await expect(client.readLatestRateLimitsFromSession(null, threadId)).resolves.toMatchObject({
      limitId: 'codex',
      primary: { usedPercent: 5 }
    })
  })
})
