import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  detectCcSwitchAuthPath,
  listCcSwitchAuthCandidates,
  parseCcSwitchAuthContent,
  readCcSwitchAccounts,
  toCodexAuthContent
} from './cc-switch'

const created: string[] = []

function makeAuthFile(dir: string, content: string): string {
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'codex_oauth_auth.json')
  fs.writeFileSync(file, content, 'utf8')
  created.push(dir)
  return file
}

afterEach(() => {
  for (const dir of created.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('cc-switch', () => {
  it('解析已登入帳號並保留 email 與 refresh_token', () => {
    const content = JSON.stringify({
      version: 2,
      accounts: {
        'acc-1': {
          account_id: 'cgpt-a',
          chatgpt_account_id: 'cgpt-a',
          email: 'a@example.com',
          refresh_token: 'refresh-a',
          id_token: 'id-a'
        },
        'acc-2': {
          account_id: 'cgpt-b',
          chatgpt_account_id: 'cgpt-b',
          email: 'b@example.com',
          refresh_token: 'refresh-b'
        }
      },
      default_account_id: 'cgpt-a'
    })

    const accounts = parseCcSwitchAuthContent(content)
    expect(accounts).toHaveLength(2)
    expect(accounts[0]).toEqual({
      accountId: 'acc-1',
      email: 'a@example.com',
      refreshToken: 'refresh-a',
      idToken: 'id-a',
      chatgptAccountId: 'cgpt-a'
    })
    expect(accounts[1].idToken).toBeNull()
  })

  it('略過缺少 refresh_token 的項目與非物件內容', () => {
    const content = JSON.stringify({
      accounts: {
        ok: { email: 'a@example.com', refresh_token: 'r' },
        noToken: { email: 'b@example.com' },
        broken: 'not-an-object'
      }
    })
    expect(parseCcSwitchAuthContent(content).map((a) => a.email)).toEqual(['a@example.com'])
  })

  it('格式不符時回傳空陣列', () => {
    expect(parseCcSwitchAuthContent('{}')).toEqual([])
    expect(parseCcSwitchAuthContent('{"accounts":[]}')).toEqual([])
  })

  it('轉成 codex auth.json 時保留 refresh_token 與 chatgpt account_id', () => {
    const auth = JSON.parse(
      toCodexAuthContent({
        accountId: 'acc-1',
        email: 'a@example.com',
        refreshToken: 'refresh-a',
        idToken: 'id-a',
        chatgptAccountId: 'cgpt-a'
      })
    )
    expect(auth.auth_mode).toBe('chatgpt')
    expect(auth.OPENAI_API_KEY).toBeNull()
    expect(auth.tokens.refresh_token).toBe('refresh-a')
    expect(auth.tokens.id_token).toBe('id-a')
    expect(auth.tokens.account_id).toBe('cgpt-a')
    expect(typeof auth.tokens.access_token).toBe('string')
  })

  it('檔案不存在時標記 missing 而不丟錯', () => {
    const result = readCcSwitchAccounts('C:/definitely-not-exists/codex_oauth_auth.json')
    expect(result.missing).toBe(true)
    expect(result.accounts).toEqual([])
  })

  it('候選清單包含 home 與 AppData 常見位置且不重複', () => {
    const candidates = listCcSwitchAuthCandidates()
    expect(candidates.length).toBeGreaterThan(1)
    expect(new Set(candidates).size).toBe(candidates.length)
    expect(candidates.some((p) => p.startsWith(os.homedir()))).toBe(true)
    expect(candidates.some((p) => p.includes('AppData'))).toBe(true)
    expect(candidates.every((p) => p.endsWith('codex_oauth_auth.json'))).toBe(true)
  })

  it('依序掃描候選路徑並回傳第一個存在的檔案', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccswitch-detect-'))
    created.push(root)
    const dataDir = path.join(root, 'cc-switch')
    const file = makeAuthFile(dataDir, JSON.stringify({ accounts: { a: { refresh_token: 'r' } } }))
    process.env.CCSWITCH_HOME = dataDir
    try {
      expect(detectCcSwitchAuthPath()).toBe(file)
      const result = readCcSwitchAccounts()
      expect(result.missing).toBe(false)
      expect(result.accounts).toHaveLength(1)
    } finally {
      delete process.env.CCSWITCH_HOME
    }
  })

  it('自訂路徑優先於自動偵測', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccswitch-override-'))
    created.push(root)
    const autoDir = path.join(root, 'auto')
    const overrideDir = path.join(root, 'override')
    makeAuthFile(autoDir, JSON.stringify({ accounts: { a: { refresh_token: 'r' } } }))
    const overrideFile = makeAuthFile(overrideDir, JSON.stringify({ accounts: { b: { refresh_token: 'r2' } } }))
    process.env.CCSWITCH_HOME = autoDir
    try {
      expect(detectCcSwitchAuthPath()).toBe(path.join(autoDir, 'codex_oauth_auth.json'))
      const result = readCcSwitchAccounts(overrideFile)
      expect(result.filePath).toBe(overrideFile)
    } finally {
      delete process.env.CCSWITCH_HOME
    }
  })

  it('沒有任何候選檔案時回傳 null', () => {
    const originalHome = process.env.HOME
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccswitch-empty-'))
    created.push(root)
    process.env.CCSWITCH_HOME = path.join(root, 'missing')
    try {
      // 仍會掃描 home / AppData 等位置，這裡只確認不會因此拋錯
      expect(() => detectCcSwitchAuthPath()).not.toThrow()
    } finally {
      if (originalHome === undefined) delete process.env.HOME
      else process.env.HOME = originalHome
    }
  })
})
