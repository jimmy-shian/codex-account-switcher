import type { QuotaBucketRow, QuotaSnapshot, QuotaWindow } from './types'
import { localize, type UiLocale } from './i18n'

/** API 返回的 usedPercent 按「已使用占比」理解，转为剩余百分比 */
export function remainingPercentFromUsed(usedPercent: number | null | undefined): number | null {
  if (usedPercent == null || Number.isNaN(usedPercent)) return null
  const normalizedUsed =
    usedPercent > 0 && usedPercent < 1 ? Math.round(usedPercent * 10000) / 100 : usedPercent
  const r = Math.round(100 - normalizedUsed)
  return Math.max(0, Math.min(100, r))
}

export function formatReset(ts: number | null | undefined): string {
  if (ts == null) return '—'
  const d = new Date(ts * 1000)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 短日期，与参考 UI 一致：英文月缩写 + 日 */
export function formatResetShort(ts: number | null | undefined): string {
  if (ts == null) return '—'
  const d = new Date(ts * 1000)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export type QuotaWindowDisplayMode = 'unknown' | 'primary-only' | 'secondary-only' | 'dual'

export interface QuotaDisplayWindow {
  provided: boolean
  remaining: number | null
  resetsAt: number | null
}

export interface QuotaDisplayWindows {
  mode: QuotaWindowDisplayMode
  fiveHour: QuotaDisplayWindow
  sevenDay: QuotaDisplayWindow
  extras: Array<{ key: string; label: string; remaining: number | null; resetsAt: number | null }>
}

function hasWindowSignal(w: QuotaWindow | null | undefined): boolean {
  return !!w && (w.usedPercent != null || w.resetsAt != null || w.windowDurationMins != null)
}

function isLongWindow(w: QuotaWindow | null | undefined): boolean {
  const mins = w?.windowDurationMins
  if (mins == null) return false
  return mins >= 24 * 60
}

function isFreePlanType(planType: string | null | undefined): boolean {
  const t = String(planType ?? '')
    .trim()
    .toLowerCase()
  return t.includes('free')
}

export function getQuotaWindowDisplayMode(q: QuotaSnapshot | null): QuotaWindowDisplayMode {
  if (!q) return 'unknown'
  const hasPrimary = hasWindowSignal(q.primary)
  const hasSecondary = hasWindowSignal(q.secondary)
  if (!hasPrimary && !hasSecondary) return 'unknown'
  if (!hasPrimary && hasSecondary) return 'secondary-only'
  if (hasPrimary && !hasSecondary && (isLongWindow(q.primary) || isFreePlanType(q.planType))) {
    return 'secondary-only'
  }
  if (hasPrimary && !hasSecondary) return 'primary-only'
  return 'dual'
}

function displayWindowFrom(w: QuotaWindow | null): QuotaDisplayWindow {
  if (!hasWindowSignal(w)) {
    return { provided: false, remaining: null, resetsAt: null }
  }
  return {
    provided: true,
    remaining: remainingPercentFromUsed(w?.usedPercent ?? null),
    resetsAt: w?.resetsAt ?? null
  }
}

function collectExtraRows(q: QuotaSnapshot | null, locale: UiLocale): QuotaDisplayWindows['extras'] {
  if (!q?.buckets?.length) return []
  const extras: QuotaDisplayWindows['extras'] = []
  for (const b of q.buckets) {
    if (b.limitId === q.limitId) continue
    const hasP = hasWindowSignal(b.primary)
    const hasS = hasWindowSignal(b.secondary)
    if (hasP) {
      extras.push({
        key: `${b.limitId}:p`,
        label: hasS ? `${b.displayLabel} · ${localize('主', locale)}` : b.displayLabel,
        remaining: remainingPercentFromUsed(b.primary?.usedPercent),
        resetsAt: b.primary?.resetsAt ?? null
      })
    }
    if (hasS) {
      extras.push({
        key: `${b.limitId}:s`,
        label: hasP ? `${b.displayLabel} · ${localize('次', locale)}` : b.displayLabel,
        remaining: remainingPercentFromUsed(b.secondary?.usedPercent),
        resetsAt: b.secondary?.resetsAt ?? null
      })
    }
  }
  return extras
}

export function getQuotaDisplayWindows(q: QuotaSnapshot | null, locale: UiLocale = 'zh-CN'): QuotaDisplayWindows {
  const mode = getQuotaWindowDisplayMode(q)
  const unknown = {
    mode,
    fiveHour: { provided: false, remaining: null, resetsAt: null },
    sevenDay: { provided: false, remaining: null, resetsAt: null },
    extras: collectExtraRows(q, locale)
  }
  if (!q) return unknown

  if (mode === 'secondary-only') {
    const source = hasWindowSignal(q.primary) ? q.primary : q.secondary
    return {
      mode,
      fiveHour: { provided: false, remaining: null, resetsAt: null },
      sevenDay: displayWindowFrom(source),
      extras: collectExtraRows(q, locale)
    }
  }

  if (mode === 'primary-only') {
    return {
      mode,
      fiveHour: displayWindowFrom(q.primary),
      sevenDay: { provided: false, remaining: null, resetsAt: null },
      extras: collectExtraRows(q, locale)
    }
  }

  if (mode === 'dual') {
    return {
      mode,
      fiveHour: displayWindowFrom(q.primary),
      sevenDay: displayWindowFrom(q.secondary),
      extras: collectExtraRows(q, locale)
    }
  }

  return unknown
}

function pushWindowParts(parts: string[], label: string, w: QuotaWindow | null, locale: UiLocale): void {
  const r = remainingPercentFromUsed(w?.usedPercent ?? null)
  if (r != null) parts.push(`${label} ${localize('剩', locale)}${r}%`)
}

export function quotaSummaryText(q: QuotaSnapshot | null, locale: UiLocale = 'zh-CN'): string {
  if (!q) return '—'
  const main = getQuotaDisplayWindows(q, locale)
  const mainParts: string[] = []
  if (main.fiveHour.provided && main.fiveHour.remaining != null)
    mainParts.push(`5h ${localize('剩', locale)}${main.fiveHour.remaining}%`)
  if (main.sevenDay.provided && main.sevenDay.remaining != null)
    mainParts.push(`7d ${localize('剩', locale)}${main.sevenDay.remaining}%`)
  if (mainParts.length) {
    const extraParts = main.extras.map((e) => `${e.label} ${localize('剩', locale)}${e.remaining ?? '—'}%`)
    return [...mainParts, ...extraParts].join(' · ')
  }
  if (q.buckets?.length) {
    const parts: string[] = []
    for (const b of q.buckets) {
      const hasBoth =
        (b.primary?.usedPercent != null || b.primary?.resetsAt != null) &&
        (b.secondary?.usedPercent != null || b.secondary?.resetsAt != null)
      if (hasBoth) {
        pushWindowParts(parts, `${b.displayLabel}·${localize('主', locale)}`, b.primary, locale)
        pushWindowParts(parts, `${b.displayLabel}·${localize('次', locale)}`, b.secondary, locale)
      } else {
        pushWindowParts(parts, b.displayLabel, b.primary ?? b.secondary, locale)
      }
    }
    return parts.length ? parts.join(' · ') : localize('已刷新', locale)
  }
  const parts: string[] = []
  pushWindowParts(parts, localize('主', locale), q.primary, locale)
  pushWindowParts(parts, localize('次', locale), q.secondary, locale)
  return parts.length ? parts.join(' · ') : localize('已刷新', locale)
}

export type QuotaRemainRow = { key: string; label: string; remaining: number | null; resetsAt: number | null }

/** 重置券显示文案：有券时显示张数与最近到期时间，无券返回 null */
export function resetCreditsText(q: QuotaSnapshot | null, locale: UiLocale = 'zh-CN'): string | null {
  const rc = q?.resetCredits
  if (!rc || rc.availableCount == null || rc.availableCount <= 0) return null
  const count = `${rc.availableCount}${localize('张', locale)}`
  if (rc.nearestExpiresAt != null) {
    return `${localize('重置券', locale)} ${count} · ${localize('最近到期', locale)} ${formatResetShort(rc.nearestExpiresAt)}`
  }
  return `${localize('重置券', locale)} ${count}`
}

function normalizeTs(ts: unknown): number | null {
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return null
  // 防禦：上游若誤傳毫秒（>1e12），轉回秒
  if (ts > 1e12) return Math.floor(ts / 1000)
  return Math.floor(ts)
}

/** 列級最早到期時間（Unix 秒）：取 5h/7d/extras/重置券中的最小未來值；全過去則回最近過去值；無資料回 null */
export function getNearestResetTs(q: QuotaSnapshot | null, nowSec?: number): number | null {
  const detail = getNearestResetDetail(q, 'zh-CN', nowSec)
  return detail.ts
}

export interface NearestResetDetail {
  ts: number | null
  sourceLabel: string | null
  hasData: boolean
  isExpired: boolean
}

export function getNearestResetDetail(
  q: QuotaSnapshot | null,
  locale: UiLocale = 'zh-CN',
  nowSec?: number
): NearestResetDetail {
  const now = nowSec ?? Math.floor(Date.now() / 1000)
  if (!q) return { ts: null, sourceLabel: null, hasData: false, isExpired: false }
  const display = getQuotaDisplayWindows(q, locale)
  const candidates: Array<{ ts: number; label: string; rank: number }> = []
  const push = (raw: number | null | undefined, label: string, rank: number) => {
    const ts = normalizeTs(raw)
    if (ts != null) candidates.push({ ts, label, rank })
  }
  push(display.fiveHour.resetsAt, localize('5小时', locale), 0)
  push(display.sevenDay.resetsAt, localize('7天', locale), 1)
  for (const e of display.extras) push(e.resetsAt, e.label, 2)
  push(q.resetCredits?.nearestExpiresAt ?? null, localize('重置券', locale), 3)
  if (candidates.length === 0) return { ts: null, sourceLabel: null, hasData: false, isExpired: false }
  const future = candidates.filter((c) => c.ts > now).sort((a, b) => a.ts - b.ts || a.rank - b.rank)
  if (future.length > 0) {
    return { ts: future[0].ts, sourceLabel: future[0].label, hasData: true, isExpired: false }
  }
  const past = [...candidates].sort((a, b) => b.ts - a.ts || a.rank - b.rank)
  return { ts: past[0].ts, sourceLabel: past[0].label, hasData: true, isExpired: true }
}

/** 倒數格式化：ts 為 Unix 秒；回傳中文文案（簡中原文，繁中由上層 localize） */
export function formatCountdown(ts: number | null | undefined, nowSec?: number, locale: UiLocale = 'zh-CN'): string {
  const norm = normalizeTs(ts)
  if (norm == null) return localize('无资料', locale)
  const now = nowSec ?? Math.floor(Date.now() / 1000)
  const diff = norm - now
  if (diff <= 0) return localize('已到期', locale)
  if (diff < 60) return localize('即将到期', locale)
  if (diff < 3600) {
    const m = Math.ceil(diff / 60)
    return `${m}${localize('分', locale)}${localize('后重设', locale)}`
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600)
    const m = Math.ceil((diff - h * 3600) / 60)
    return m > 0
      ? `${h}${localize('时', locale)}${m}${localize('分', locale)}${localize('后重设', locale)}`
      : `${h}${localize('时', locale)}${localize('后重设', locale)}`
  }
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff - d * 86400) / 3600)
  return h > 0
    ? `${d}${localize('天', locale)}${h}${localize('时', locale)}${localize('后重设', locale)}`
    : `${d}${localize('天', locale)}${localize('后重设', locale)}`
}

/** 到期緊急度：0=無/已過期不染，1=極淺(<72h)，2=淺(<24h)，3=中(<6h)，4=最深(<1h) */
export type ExpiryUrgency = 0 | 1 | 2 | 3 | 4

export function getExpiryUrgency(ts: number | null | undefined, nowSec?: number): ExpiryUrgency {
  const norm = normalizeTs(ts)
  if (norm == null) return 0
  const now = nowSec ?? Math.floor(Date.now() / 1000)
  const diff = norm - now
  if (diff <= 0) return 0
  if (diff < 3600) return 4
  if (diff < 6 * 3600) return 3
  if (diff < 24 * 3600) return 2
  if (diff < 72 * 3600) return 1
  return 0
}

export function expiryUrgencyClass(u: ExpiryUrgency): string {
  if (u === 4) return 'row-expiry-1'
  if (u === 3) return 'row-expiry-2'
  if (u === 2) return 'row-expiry-3'
  if (u === 1) return 'row-expiry-4'
  return ''
}

function pushRow(
  rows: QuotaRemainRow[],
  key: string,
  label: string,
  w: QuotaWindow | null
): void {
  if (!w || (w.usedPercent == null && w.resetsAt == null)) return
  rows.push({
    key,
    label,
    remaining: remainingPercentFromUsed(w.usedPercent),
    resetsAt: w.resetsAt ?? null
  })
}

export function quotaRemainRows(q: QuotaSnapshot | null, locale: UiLocale = 'zh-CN'): QuotaRemainRow[] {
  if (!q) return []
  const main = getQuotaDisplayWindows(q, locale)
  const rows: QuotaRemainRow[] = []
  if (main.fiveHour.provided) {
    rows.push({
      key: `${q.limitId}:5h`,
      label: localize('5小时', locale),
      remaining: main.fiveHour.remaining,
      resetsAt: main.fiveHour.resetsAt
    })
  }
  if (main.sevenDay.provided) {
    rows.push({
      key: `${q.limitId}:7d`,
      label: localize('7天', locale),
      remaining: main.sevenDay.remaining,
      resetsAt: main.sevenDay.resetsAt
    })
  }
  for (const e of main.extras) {
    rows.push({
      key: e.key,
      label: e.label,
      remaining: e.remaining,
      resetsAt: e.resetsAt
    })
  }
  if (rows.length) return rows

  if (!q.buckets?.length) {
    pushRow(rows, `${q.limitId}:p`, localize('主', locale), q.primary)
    pushRow(rows, `${q.limitId}:s`, localize('次', locale), q.secondary)
    return rows
  }
  for (const b of q.buckets) {
    const hasP = b.primary && (b.primary.usedPercent != null || b.primary.resetsAt != null)
    const hasS = b.secondary && (b.secondary.usedPercent != null || b.secondary.resetsAt != null)
    if (hasP) {
      const label = hasS ? `${b.displayLabel} · ${localize('主', locale)}` : b.displayLabel
      pushRow(rows, `${b.limitId}:p`, label, b.primary)
    }
    if (hasS) {
      const label = hasP ? `${b.displayLabel} · ${localize('次', locale)}` : b.displayLabel
      pushRow(rows, `${b.limitId}:s`, label, b.secondary)
    }
  }
  return rows
}
