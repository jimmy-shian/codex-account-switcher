import { describe, expect, it } from 'vitest'
import {
  getNearestResetDetail,
  getQuotaDisplayWindows,
  getQuotaWindowDisplayMode,
  remainingPercentFromUsed
} from './quota-summary'
import type { QuotaSnapshot } from './types'

function baseSnapshot(partial: Partial<QuotaSnapshot>): QuotaSnapshot {
  return {
    limitId: 'codex',
    limitName: null,
    primary: null,
    secondary: null,
    credits: null,
    planType: null,
    refreshedAt: new Date().toISOString(),
    ...partial
  }
}

describe('quota-summary window mode', () => {
  it('dual: 主次窗口都存在', () => {
    const q = baseSnapshot({
      primary: { usedPercent: 20, resetsAt: 1000, windowDurationMins: 300 },
      secondary: { usedPercent: 70, resetsAt: 2000, windowDurationMins: 10080 }
    })
    expect(getQuotaWindowDisplayMode(q)).toBe('dual')
    const out = getQuotaDisplayWindows(q)
    expect(out.fiveHour.provided).toBe(true)
    expect(out.fiveHour.remaining).toBe(80)
    expect(out.sevenDay.provided).toBe(true)
    expect(out.sevenDay.remaining).toBe(30)
  })

  it('secondary-only: free 单长窗口映射到 7 天', () => {
    const q = baseSnapshot({
      planType: 'free',
      primary: { usedPercent: 55, resetsAt: 3000, windowDurationMins: 10080 },
      secondary: null
    })
    expect(getQuotaWindowDisplayMode(q)).toBe('secondary-only')
    const out = getQuotaDisplayWindows(q)
    expect(out.fiveHour.provided).toBe(false)
    expect(out.sevenDay.provided).toBe(true)
    expect(out.sevenDay.remaining).toBe(45)
  })

  it('primary-only: 仅 5 小时窗口', () => {
    const q = baseSnapshot({
      planType: 'plus',
      primary: { usedPercent: 40, resetsAt: 4000, windowDurationMins: 300 },
      secondary: null
    })
    expect(getQuotaWindowDisplayMode(q)).toBe('primary-only')
    const out = getQuotaDisplayWindows(q)
    expect(out.fiveHour.provided).toBe(true)
    expect(out.sevenDay.provided).toBe(false)
  })

  it('remainingPercentFromUsed 兼容 0~1 小数占比', () => {
    expect(remainingPercentFromUsed(0.73)).toBe(27)
    expect(remainingPercentFromUsed(73)).toBe(27)
    expect(remainingPercentFromUsed(1)).toBe(99)
  })

  it('free 帳號長窗口標籤為 30天，非 7天', () => {
    const q = baseSnapshot({
      planType: 'free',
      primary: { usedPercent: 45, resetsAt: 3000, windowDurationMins: 43200 },
      secondary: null
    })
    const out = getQuotaDisplayWindows(q)
    expect(out.sevenDay.provided).toBe(true)
    expect(out.sevenDay.label).toBe('30天')
  })

  it('plus 帳號長窗口標籤為 7天，且到期倒數優先取 7天完整重設時間', () => {
    const q = baseSnapshot({
      planType: 'plus',
      primary: { usedPercent: 10, resetsAt: 500, windowDurationMins: 300 },
      secondary: { usedPercent: 50, resetsAt: 2500, windowDurationMins: 10080 }
    })
    const out = getQuotaDisplayWindows(q)
    expect(out.sevenDay.label).toBe('7天')
    const detail = getNearestResetDetail(q, 'zh-TW', 100)
    // 應優先取 7 天完整重設（2500），而非 5 小時（500）
    expect(detail.ts).toBe(2500)
    expect(detail.sourceLabel).toBe('7天')
  })
})
