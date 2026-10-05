import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { CodexProcessInfo, CodexTerminal } from '@shared/types'
import type { TFn } from '../types'
import { AnimatedSelect, type AnimatedSelectOption } from './AnimatedSelect'

const TERMINAL_OPTIONS: CodexTerminal[] = ['auto', 'wt', 'cmd', 'none']

const TERMINAL_LABELS: Record<CodexTerminal, string> = {
  auto: '自动（优先 Windows Terminal）',
  wt: 'Windows Terminal',
  cmd: 'cmd 窗口',
  none: '直接执行（无窗口）'
}

function normalizePath(p: string): string {
  return p.trim().replace(/\//g, '\\').toLowerCase()
}

function PathRow({
  label,
  override,
  resolved,
  emptyHint,
  onPick,
  onCommit,
  t
}: {
  label: string
  /** 自訂覆寫值；空字串＝自動 */
  override: string
  /** 實際生效路徑（覆寫優先，否則自動偵測）；會直接填入輸入框 */
  resolved: string
  emptyHint: string
  onPick: () => void
  onCommit: (value: string) => void
  t: TFn
}) {
  const display = resolved || ''
  const isAuto = override === '' && display !== ''
  const isMissing = display === ''
  const [draft, setDraft] = useState(display)
  const focusedRef = useRef(false)

  useEffect(() => {
    // 編輯中不強制覆寫，避免 polling 蓋掉輸入
    if (!focusedRef.current) setDraft(display)
  }, [display])

  const commit = (raw: string) => {
    const trimmed = raw.trim()
    // 防誤存：自動態未修改就不存；與覆寫值相同也不存
    if (trimmed === override) return
    if (override === '' && normalizePath(trimmed) === normalizePath(display) && trimmed !== '') return
    onCommit(trimmed)
  }

  return (
    <div className="path-row">
      <label className="path-row-label">{label}</label>
      <input
        className={`path-row-input${isAuto ? ' is-auto' : ''}`}
        type="text"
        value={draft}
        placeholder={emptyHint}
        aria-label={label}
        title={display || emptyHint}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => {
          focusedRef.current = true
        }}
        onBlur={() => {
          focusedRef.current = false
          commit(draft)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(draft)
          if (e.key === 'Escape') {
            setDraft(display)
            focusedRef.current = false
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
      <button type="button" className="btn btn-sm btn-ghost" onClick={onPick}>
        {t('浏览…')}
      </button>
      {override !== '' ? (
        <button
          type="button"
          className="btn btn-sm btn-ghost path-auto-reset"
          title={t('清除自定义，恢复自动侦测')}
          onClick={() => {
            setDraft('')
            onCommit('')
          }}
        >
          {t('重置为自动')}
        </button>
      ) : null}
      <span
        className={`path-mode-pill ${isMissing ? 'pill pill-warn' : isAuto ? 'pill pill-neutral' : 'pill pill-ok'}`}
        title={display || emptyHint}
      >
        {isMissing ? t('未检测到') : isAuto ? t('自动') : t('自定义')}
      </span>
    </div>
  )
}

export const PathSettings = memo(function PathSettings({
  codexExeOverride,
  codexExeResolved,
  codexWorkDir,
  codexWorkDirOverride,
  codexTerminal,
  open,
  running,
  t,
  onToggle,
  onPickCodexExe,
  onCommitCodexExe,
  onCommitWorkDir,
  onChangeTerminal,
  onRestart,
  onToggleCodex,
  busy
}: {
  codexExeOverride: string
  codexExeResolved: string
  codexWorkDir: string
  codexWorkDirOverride: string
  codexTerminal: CodexTerminal
  open: boolean
  /** 目前執行中的 codex 程序，數量大於 0 代表已啟動 */
  running: CodexProcessInfo[]
  t: TFn
  onToggle: () => void
  onPickCodexExe: () => void
  onCommitCodexExe: (value: string) => void
  onCommitWorkDir: (value: string) => void
  onChangeTerminal: (value: CodexTerminal) => void
  onRestart: () => void
  /** 依執行狀態自動決定啟動或關閉 */
  onToggleCodex: () => void
  busy: boolean
}) {
  const terminalOptions: AnimatedSelectOption<CodexTerminal>[] = useMemo(
    () =>
      TERMINAL_OPTIONS.map((item) => ({
        value: item,
        label: t(TERMINAL_LABELS[item])
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  )

  const isRunning = running.length > 0

  return (
    <section className={`path-settings${open ? ' is-open' : ''}`}>
      <div className="path-settings-bar">
        <button
          type="button"
          className="btn btn-sm btn-ghost path-settings-toggle"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="path-settings-body"
        >
          <span>{open ? t('收起路径设置') : t('路径设置')}</span>
          <span className="path-settings-arrow" aria-hidden />
        </button>
        <span className="path-running">
          {isRunning ? t(`Codex 运行中（${running.length}）`) : t('Codex 未启动')}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-toolbar btn-restart-codex"
          onClick={onRestart}
          disabled={busy}
          title={t('关闭运行中的 Codex，再用新账号重新启动（Ctrl+Shift+R）')}
        >
          {t('一键重启 Codex')} (Ctrl+Shift+R)
        </button>
        <button
          type="button"
          className={isRunning ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-toolbar btn-start-codex'}
          onClick={onToggleCodex}
          disabled={busy}
          title={isRunning ? t('关闭运行中的 Codex（Ctrl+Shift+Q）') : t('启动 Codex（Ctrl+Shift+Q）')}
        >
          {isRunning ? t('关闭 Codex') : t('启动 Codex')}
        </button>
      </div>

      <div
        id="path-settings-body"
        role="region"
        aria-hidden={!open}
        className={`path-settings-collapsible${open ? ' is-open' : ''}`}
      >
        <div className="path-settings-body-inner">
          <div className="path-settings-body">
            <PathRow
              label={t('Codex 执行文件')}
              override={codexExeOverride}
              resolved={codexExeResolved}
              emptyHint={t('未检测到，请浏览选择…')}
              onPick={onPickCodexExe}
              onCommit={onCommitCodexExe}
              t={t}
            />
            <div className="path-row">
              <label className="path-row-label">{t('启动目录')}</label>
              <WorkDirInput
                override={codexWorkDirOverride}
                resolved={codexWorkDir}
                onCommit={onCommitWorkDir}
                t={t}
              />
            </div>
            <div className="path-row">
              <label className="path-row-label">{t('启动终端')}</label>
              <AnimatedSelect
                className="animated-select-terminal"
                ariaLabel={t('启动终端')}
                value={codexTerminal}
                options={terminalOptions}
                onChange={onChangeTerminal}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
})

function WorkDirInput({
  override,
  resolved,
  onCommit,
  t
}: {
  override: string
  resolved: string
  onCommit: (value: string) => void
  t: TFn
}) {
  const display = override || resolved || ''
  const isAuto = override === '' && display !== ''
  const [draft, setDraft] = useState(display)
  const focusedRef = useRef(false)

  useEffect(() => {
    if (!focusedRef.current) setDraft(display)
  }, [display])

  const commit = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed === override) return
    if (override === '' && normalizePath(trimmed) === normalizePath(display) && trimmed !== '') return
    onCommit(trimmed)
  }

  return (
    <>
      <input
        className={`path-row-input${isAuto ? ' is-auto' : ''}`}
        type="text"
        value={draft}
        placeholder={t('留空＝用户目录')}
        aria-label={t('启动目录')}
        title={display}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => {
          focusedRef.current = true
        }}
        onBlur={() => {
          focusedRef.current = false
          commit(draft)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(draft)
          if (e.key === 'Escape') {
            setDraft(display)
            focusedRef.current = false
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
      {override !== '' ? (
        <button
          type="button"
          className="btn btn-sm btn-ghost path-auto-reset"
          title={t('清除自定义，恢复自动（用户目录）')}
          onClick={() => {
            setDraft('')
            onCommit('')
          }}
        >
          {t('重置为自动')}
        </button>
      ) : null}
      <span
        className={`path-mode-pill ${isAuto ? 'pill pill-neutral' : 'pill pill-ok'}`}
        title={display}
      >
        {isAuto ? t('自动') : t('自定义')}
      </span>
    </>
  )
}
