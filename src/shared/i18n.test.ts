import { describe, expect, it } from 'vitest'
import { isUiLocale, localize, toTraditional } from './i18n'
import { quotaSummaryText } from './quota-summary'
import type { QuotaSnapshot } from './types'

describe('i18n', () => {
  it('isUiLocale 只接受支援的語言', () => {
    expect(isUiLocale('zh-CN')).toBe(true)
    expect(isUiLocale('zh-TW')).toBe(true)
    expect(isUiLocale('zh-Hant')).toBe(false)
    expect(isUiLocale(null)).toBe(false)
  })

  it('zh-CN 原樣輸出', () => {
    expect(localize('刷新全部', 'zh-CN')).toBe('刷新全部')
  })

  it('zh-TW 轉換字形與台灣用語', () => {
    expect(toTraditional('刷新全部')).toBe('重新整理全部')
    expect(toTraditional('无额度数据')).toBe('無額度資料')
    expect(toTraditional('添加账号')).toBe('新增帳號')
    expect(toTraditional('从 JSON 导入')).toBe('從 JSON 匯入')
    expect(toTraditional('已授权/过期')).toBe('已授權/過期')
    expect(toTraditional('选择 auth.json 或账号备份 JSON')).toBe('選擇 auth.json 或帳號備份 JSON')
  })

  it('重複轉換不會二次替換', () => {
    const once = toTraditional('未找到账号')
    expect(toTraditional(once)).toBe(once)
    expect(toTraditional('本地快照损坏，无法解密')).toBe('本機快照損壞，無法解密')
  })

  it('非中文內容保持不變', () => {
    expect(toTraditional('app-server 失败')).toBe('app-server 失敗')
    expect(toTraditional('PLUS')).toBe('PLUS')
    expect(toTraditional('user@example.com')).toBe('user@example.com')
    expect(toTraditional('')).toBe('')
  })

  it('quotaSummaryText 依語言輸出', () => {
    const q: QuotaSnapshot = {
      limitId: 'codex',
      limitName: null,
      primary: { usedPercent: 30, resetsAt: null },
      secondary: { usedPercent: 50, resetsAt: null },
      credits: null,
      planType: 'plus',
      refreshedAt: '2026-01-01T00:00:00.000Z'
    }
    expect(quotaSummaryText(q, 'zh-CN')).toBe('5h 剩70% · 7d 剩50%')
    expect(quotaSummaryText(q, 'zh-TW')).toBe('5h 剩70% · 7d 剩50%')
  })
})