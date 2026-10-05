import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LiveSessionInfo, QuotaViewMode, SavedAccount } from '@shared/types'
import { isQuotaViewMode } from '@shared/types'
import { getNearestResetTs, getQuotaDisplayWindows } from '@shared/quota-summary'
import { isUiLocale, type UiLocale } from '@shared/i18n'
import { AccountTable, buildAccountRows } from './components/AccountTable'
import { LiveBanner, LoginWaitHint } from './components/LiveBanner'
import { DeleteConfirmModal, RefreshIndicator, Toast, WarmupConfirmModal } from './components/Modals'
import { PathSettings } from './components/PathSettings'
import { SettingsPanel } from './components/SettingsPanel'
import './components/settings-panel.css'
import { Toolbar } from './components/Toolbar'
import { useQuotaOperation, useToast, useTranslate } from './hooks/useAppState'
import { useHotkeys } from './hooks/useHotkeys'
import { usePaths } from './hooks/usePaths'
import { useTheme } from './hooks/useTheme'
import { cleanErrorMessage, countByQuotaFilter, importSummaryText, matchesQuotaFilter } from './lib/account-view'
import type { DeleteTarget, QuotaFilterValue, SortConfig, SortField, WarmupConfirmTarget } from './types'
import type { ListResult } from './vite-env'

const AUTO_REFRESH_MS = 5 * 60 * 1000
const WARMUP_CONFIRM_SECONDS = 3

export default function App() {
  const [accounts, setAccounts] = useState<SavedAccount[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [liveInfo, setLiveInfo] = useState<LiveSessionInfo | null>(null)
  const [quotaFilter, setQuotaFilter] = useState<QuotaFilterValue>('all')
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)
  const [loginInProgress, setLoginInProgress] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [warmupConfirm, setWarmupConfirm] = useState<WarmupConfirmTarget | null>(null)
  const [warmupCountdown, setWarmupCountdown] = useState(WARMUP_CONFIRM_SECONDS)
  const [locale, setLocale] = useState<UiLocale>('zh-CN')
  const [proxyUrl, setProxyUrl] = useState('')
  const [proxySaving, setProxySaving] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [quotaViewMode, setQuotaViewMode] = useState<QuotaViewMode>('both')
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))
  const initialLoadDoneRef = useRef(false)

  const t = useTranslate(locale)
  const { toast, showToast, showError } = useToast()
  const quota = useQuotaOperation(loginInProgress)
  const paths = usePaths()
  const theme = useTheme()

  const onRestartCodex = useCallback(async () => {
    try {
      showToast(t((await paths.restart()).message))
    } catch (e) {
      showError(e)
    }
  }, [paths.restart, showError, showToast, t])

  /** 依目前狀態決定啟動或關閉，與工具列按鈕共用同一個動作 */
  const onToggleCodex = useCallback(async () => {
    try {
      showToast(t((await paths.toggle()).message))
    } catch (e) {
      showError(e)
    }
  }, [paths.toggle, showError, showToast, t])

  // onImportLive / onAdd 定義在下方，用 ref 讓快捷鍵能呼叫最新版本
  const onImportLiveRef = useRef<() => void>(() => {})
  const onAddRef = useRef<() => void>(() => {})

  // Ctrl+Shift+R 重啟、Q 啟動/關閉切換、S 匯入 Live、N 新增
  useHotkeys({
    r: () => void onRestartCodex(),
    q: () => void onToggleCodex(),
    s: () => onImportLiveRef.current(),
    n: () => onAddRef.current()
  })

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = t('Codex 切号器')
  }, [locale, t])

  useEffect(() => {
    void (async () => {
      try {
        const saved = await window.codexSwitcher.getLocale()
        if (isUiLocale(saved)) setLocale(saved)
      } catch {
        /* 讀不到設定時維持預設語言 */
      }
      try {
        const savedProxy = await window.codexSwitcher.getProxyUrl()
        if (typeof savedProxy === 'string') setProxyUrl(savedProxy)
      } catch {
        /* 讀不到設定時維持直連 */
      }
      try {
        const savedView = await window.codexSwitcher.getQuotaViewMode()
        if (isQuotaViewMode(savedView)) setQuotaViewMode(savedView)
      } catch {
        /* 讀不到時維持 both */
      }
    })()
  }, [])

  // 倒數 tick：每 60s 更新相對時間
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000))
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const applyListState = useCallback((r: ListResult) => {
    setAccounts(r.accounts)
    setActiveId(r.activeAccountId)
  }, [])

  const reload = useCallback(async () => {
    const r = await window.codexSwitcher.listAccounts()
    applyListState(r)
    return r
  }, [applyListState])

  const runAutoRefresh = useCallback(
    async (opts: { showErrorToast: boolean; showSuccessToast: boolean }) => {
      const operationId = quota.enter({ mode: 'all' })
      if (operationId == null) return
      try {
        const r = await window.codexSwitcher.refreshAll()
        if (!quota.isActive(operationId)) return
        applyListState(r)
        setLiveInfo(null)
        if (opts.showSuccessToast) showToast(t('已加载并完成额度刷新'))
      } catch (e) {
        if (opts.showErrorToast && quota.isActive(operationId)) showError(e)
      } finally {
        quota.exit(operationId)
      }
    },
    [applyListState, quota, showError, showToast, t]
  )

  useEffect(() => {
    if (initialLoadDoneRef.current) return
    initialLoadDoneRef.current = true
    void (async () => {
      try {
        const r = await reload()
        if (r.accounts.length > 0) {
          await runAutoRefresh({ showErrorToast: true, showSuccessToast: true })
        } else {
          showToast(t('已加载列表（暂无账号）'))
        }
      } catch (e) {
        showError(e)
      }
    })()
  }, [reload, runAutoRefresh, showError, showToast, t])

  useEffect(() => {
    if (accounts.length === 0) return
    const timer = window.setInterval(() => {
      if (loginInProgress || quota.running()) return
      void runAutoRefresh({ showErrorToast: false, showSuccessToast: false })
    }, AUTO_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [accounts.length, loginInProgress, quota, runAutoRefresh])

  useEffect(() => {
    if (!warmupConfirm) return
    setWarmupCountdown(WARMUP_CONFIRM_SECONDS)
    const timer = window.setInterval(() => {
      setWarmupCountdown((n) => (n > 0 ? n - 1 : 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [warmupConfirm])

  const filtered = useMemo(() => {
    const result = accounts.filter((a) => matchesQuotaFilter(a, quotaFilter, locale))
    if (!sortConfig) return result
    return [...result].sort((a, b) => {
      const asc = sortConfig.dir === 'asc'
      if (sortConfig.field === 'reset') {
        const aTs = getNearestResetTs(a.lastQuotaSnapshot, nowSec)
        const bTs = getNearestResetTs(b.lastQuotaSnapshot, nowSec)
        // 無資料沉底：無論 asc/desc 都在最後
        if (aTs == null && bTs == null) return a.email.localeCompare(b.email)
        if (aTs == null) return 1
        if (bTs == null) return -1
        if (aTs === bTs) return a.email.localeCompare(b.email)
        return asc ? (aTs < bTs ? -1 : 1) : aTs < bTs ? 1 : -1
      }
      const aDisplay = getQuotaDisplayWindows(a.lastQuotaSnapshot, locale)
      const bDisplay = getQuotaDisplayWindows(b.lastQuotaSnapshot, locale)
      const aWindow = sortConfig.field === '5h' ? aDisplay.fiveHour : aDisplay.sevenDay
      const bWindow = sortConfig.field === '5h' ? bDisplay.fiveHour : bDisplay.sevenDay
      const aVal = aWindow.provided && aWindow.remaining != null ? aWindow.remaining : -1
      const bVal = bWindow.provided && bWindow.remaining != null ? bWindow.remaining : -1
      if (aVal === bVal) return 0
      return asc ? (aVal < bVal ? -1 : 1) : aVal < bVal ? 1 : -1
    })
  }, [accounts, locale, quotaFilter, sortConfig, nowSec])

  const filterCounts = useMemo(() => countByQuotaFilter(accounts, locale), [accounts, locale])
  const rows = useMemo(
    () => buildAccountRows(filtered, activeId, quota.ui, t, locale, nowSec),
    [activeId, filtered, quota.ui, t, locale, nowSec]
  )

  const onChangeLocale = async (next: UiLocale) => {
    setLocale(next)
    try {
      const saved = await window.codexSwitcher.setLocale(next)
      if (isUiLocale(saved)) setLocale(saved)
    } catch {
      /* 寫入失敗時畫面仍使用已切換的語言 */
    }
  }

  const onChangeViewMode = async (next: QuotaViewMode) => {
    setQuotaViewMode(next)
    setNowSec(Math.floor(Date.now() / 1000))
    try {
      const saved = await window.codexSwitcher.setQuotaViewMode(next)
      if (isQuotaViewMode(saved)) setQuotaViewMode(saved)
    } catch {
      /* 寫入失敗時畫面仍使用已切換的模式 */
    }
  }

  const onSaveProxy = async () => {
    setProxySaving(true)
    try {
      const saved = await window.codexSwitcher.setProxyUrl(proxyUrl)
      setProxyUrl(saved)
      showToast(saved ? t(`已存储 Proxy：${saved}`) : t('已设为直连（不使用 Proxy）'))
    } catch (e) {
      showError(e)
    } finally {
      setProxySaving(false)
    }
  }

  const onAdd = async () => {
    setLoginInProgress(true)
    try {
      const r = await window.codexSwitcher.addViaLogin('embedded')
      applyListState(r)
      showToast(t('账号已添加'))
    } catch (e) {
      const msg = cleanErrorMessage(e instanceof Error ? e.message : String(e))
      if (msg === '已取消登录') showToast(t('已取消登录'))
      else if (msg !== '已取消') showToast(t(msg))
    } finally {
      setLoginInProgress(false)
    }
  }

  /** 匯入目前 Live auth.json，再刷新全部額度 */
  const onImportLive = async () => {
    const operationId = quota.enter({ mode: 'all' })
    if (operationId == null) return
    try {
      const r = await window.codexSwitcher.importLive()
      if (!quota.isActive(operationId)) return
      applyListState(r)
      const r2 = await window.codexSwitcher.refreshAll()
      if (!quota.isActive(operationId)) return
      applyListState(r2)
      setLiveInfo(null)
      showToast(t('已汇入 Live 并刷新全部'))
    } catch (e) {
      if (quota.isActive(operationId)) showError(e)
    } finally {
      quota.exit(operationId)
    }
  }

  const onImportAuthJson = async () => {
    const operationId = quota.enter({ mode: 'all' })
    if (operationId == null) return
    try {
      const r = await window.codexSwitcher.importAuthJsonFile()
      if (!quota.isActive(operationId)) return
      applyListState(r)
      setLiveInfo(null)
      showToast(importSummaryText(r.importSummary, t))
    } catch (e) {
      if (!quota.isActive(operationId)) return
      const msg = cleanErrorMessage(e instanceof Error ? e.message : String(e))
      if (msg !== '已取消') showToast(t(msg))
    } finally {
      quota.exit(operationId)
    }
  }

  const onExportAuthJson = async () => {
    try {
      const r = await window.codexSwitcher.exportAuthJsonFile()
      showToast(t(`已导出 ${r.accountCount} 个账号 JSON：${r.directoryPath}`))
    } catch (e) {
      const msg = cleanErrorMessage(e instanceof Error ? e.message : String(e))
      if (msg !== '已取消') showToast(t(msg))
    }
  }

  const onWarmup = async () => {
    const operationId = quota.enter({ mode: 'warmup' }, { force: true })
    if (operationId == null) return
    try {
      const r = await window.codexSwitcher.warmupNeverRefreshed()
      if (!quota.isActive(operationId)) return
      applyListState(r)
      setLiveInfo(null)
      if (r.attempted === 0) {
        showToast(t('没有命中 95% 以上额度的账号'))
      } else if (r.failed > 0) {
        const detail = r.lastMessage ? t(`：${r.lastMessage}`) : ''
        showToast(
          r.warmed > 0
            ? t(`已预热 ${r.warmed} 个，失败 ${r.failed} 个${detail}`)
            : t(`一键预热失败${detail}`)
        )
      } else {
        showToast(t(`已预热 ${r.warmed} 个 95% 以上账号`))
      }
    } catch (e) {
      if (quota.isActive(operationId)) showError(e)
    } finally {
      quota.exit(operationId)
    }
  }

  const onSwitch = useCallback(
    async (id: string) => {
      try {
        const r = await window.codexSwitcher.switchAccount(id)
        applyListState(r)
        showToast(`${t('已切换。')}${t(r.warning)}`)
      } catch (e) {
        showError(e)
      }
    },
    [applyListState, showError, showToast, t]
  )

  const onRefreshRow = useCallback(
    async (id: string) => {
      const operationId = quota.enter({ mode: 'row', accountId: id })
      if (operationId == null) return
      try {
        const r = await window.codexSwitcher.refreshOne(id)
        if (!quota.isActive(operationId)) return
        applyListState(r)
        showToast(t('已刷新该账号额度'))
      } catch (e) {
        if (quota.isActive(operationId)) showError(e)
      } finally {
        quota.exit(operationId)
      }
    },
    [applyListState, quota, showError, showToast, t]
  )

  const onWarmupRow = async (id: string) => {
    const operationId = quota.enter({ mode: 'rowWarmup', accountId: id }, { force: true })
    if (operationId == null) return
    try {
      const r = await window.codexSwitcher.warmupOne(id)
      if (!quota.isActive(operationId)) return
      applyListState(r)
      showToast(t(r.warmupMessage))
    } catch (e) {
      if (quota.isActive(operationId)) showError(e)
    } finally {
      quota.exit(operationId)
    }
  }

  const confirmWarmup = async () => {
    const target = warmupConfirm
    if (!target || warmupCountdown > 0) return
    setWarmupConfirm(null)
    if (target.mode === 'row') await onWarmupRow(target.accountId)
    else await onWarmup()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const r = await window.codexSwitcher.deleteAccount(deleteTarget.id)
      applyListState(r)
      setDeleteTarget(null)
      showToast(t('账号已删除'))
    } catch (e) {
      showError(e)
    } finally {
      setDeleting(false)
    }
  }

  const onCopyEmail = useCallback(
    (email: string) => {
      void navigator.clipboard.writeText(email)
      showToast(t('已复制账号：') + email)
    },
    [showToast, t]
  )

  const onSort = useCallback((field: SortField) => {
    setSortConfig((c) => ({ field, dir: c?.field === field && c.dir === 'asc' ? 'desc' : 'asc' }))
  }, [])

  const onSwitchCb = useCallback((id: string) => void onSwitch(id), [onSwitch])
  const onRefreshRowCb = useCallback((id: string) => void onRefreshRow(id), [onRefreshRow])
  const onWarmupRowCb = useCallback(
    (id: string, email: string) => setWarmupConfirm({ mode: 'row', accountId: id, email }),
    []
  )
  const onDeleteCb = useCallback((id: string, email: string) => setDeleteTarget({ id, email }), [])

  const onTogglePathSettings = useCallback(() => paths.setOpen(!paths.open), [paths.setOpen, paths.open])
  const onPickCodexExe = useCallback(() => void paths.pickCodexExe(), [paths.pickCodexExe])
  const onCommitCodexExe = useCallback((value: string) => void paths.commitCodexExe(value), [paths.commitCodexExe])
  const onCommitWorkDir = useCallback((value: string) => void paths.commitWorkDir(value), [paths.commitWorkDir])
  const onChangeTerminal = useCallback(
    (value: Parameters<typeof paths.changeTerminal>[0]) => void paths.changeTerminal(value),
    [paths.changeTerminal]
  )
  const onRestartCodexCb = useCallback(() => void onRestartCodex(), [onRestartCodex])
  const onToggleCodexCb = useCallback(() => void onToggleCodex(), [onToggleCodex])

  onImportLiveRef.current = () => void onImportLive()
  onAddRef.current = () => void onAdd()

  return (
    <div className="app">
      <Toolbar
        quotaFilter={quotaFilter}
        filterCounts={filterCounts}
        hasAccounts={accounts.length > 0}
        busy={quota.ui.mode !== 'idle'}
        t={t}
        onChangeFilter={setQuotaFilter}
        onOpenSettings={() => setSettingsOpen(true)}
        onAdd={() => void onAdd()}
        onImportLive={() => void onImportLive()}
        onImportAuthJson={() => void onImportAuthJson()}
        onExportAuthJson={() => void onExportAuthJson()}
        onWarmup={() => setWarmupConfirm({ mode: 'batch' })}
      />
      <PathSettings
        codexExeOverride={paths.paths.codexExePathOverride}
        codexExeResolved={paths.paths.codexExePathResolved}
        codexWorkDir={paths.paths.codexWorkDir}
        codexWorkDirOverride={paths.paths.codexWorkDirOverride ?? ''}
        codexTerminal={paths.paths.codexTerminal}
        open={paths.open}
        running={paths.running}
        busy={paths.busy}
        t={t}
        onToggle={onTogglePathSettings}
        onPickCodexExe={onPickCodexExe}
        onCommitCodexExe={onCommitCodexExe}
        onCommitWorkDir={onCommitWorkDir}
        onChangeTerminal={onChangeTerminal}
        onRestart={onRestartCodexCb}
        onToggleCodex={onToggleCodexCb}
      />
      {loginInProgress ? (
        <LoginWaitHint onCancel={() => void window.codexSwitcher.addViaLoginCancel()} t={t} />
      ) : null}
      {liveInfo ? <LiveBanner liveInfo={liveInfo} locale={locale} refreshUi={quota.ui} t={t} /> : null}

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty">
            {accounts.length === 0 ? t('暂无账号，点击「添加账号」通过浏览器登录。') : t('当前筛选下无账号')}
          </div>
        ) : (
          <AccountTable
            rows={rows}
            locale={locale}
            sortConfig={sortConfig}
            nowSec={nowSec}
            t={t}
            onSort={onSort}
            onSwitch={onSwitchCb}
            onRefreshRow={onRefreshRowCb}
            onWarmupRow={onWarmupRowCb}
            onDelete={onDeleteCb}
            onCopyEmail={onCopyEmail}
          />
        )}
      </div>

      {quota.ui.mode !== 'idle' && (
        <RefreshIndicator
          text={
            quota.ui.mode === 'warmup' || quota.ui.mode === 'rowWarmup' ? t('预热中...') : t('额度刷新中...')
          }
        />
      )}
      {toast ? <Toast message={toast} /> : null}

      {warmupConfirm ? (
        <WarmupConfirmModal
          target={warmupConfirm}
          countdown={warmupCountdown}
          t={t}
          onCancel={() => setWarmupConfirm(null)}
          onConfirm={() => void confirmWarmup()}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteConfirmModal
          target={deleteTarget}
          deleting={deleting}
          t={t}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}

      <SettingsPanel
        open={settingsOpen}
        themeMode={theme.mode}
        systemDark={theme.systemDark}
        resolved={theme.resolved}
        locale={locale}
        proxyUrl={proxyUrl}
        proxySaving={proxySaving}
        t={t}
        onClose={() => setSettingsOpen(false)}
        onChangeTheme={theme.setTheme}
        onChangeLocale={(next) => void onChangeLocale(next)}
        onChangeProxy={setProxyUrl}
        onSaveProxy={() => void onSaveProxy()}
      />
    </div>
  )
}
