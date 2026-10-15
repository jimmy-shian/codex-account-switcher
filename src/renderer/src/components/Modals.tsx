import type { ToastItem } from '../hooks/useAppState'
import type { DeleteTarget, TFn, WarmupConfirmTarget } from '../types'

export function WarmupConfirmModal({
  target,
  countdown,
  t,
  onCancel,
  onConfirm
}: {
  target: WarmupConfirmTarget
  countdown: number
  t: TFn
  onCancel: () => void
  onConfirm: () => void
}) {
  const locked = countdown > 0
  return (
    <div className="modal-back" role="presentation" onClick={onCancel}>
      <div className="modal modal-warmup" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{t('确认预热')}</h3>
        <p className="modal-text">{t('预热会对目标账号发送一条最小消息（hi），用来让额度数据更新。')}</p>
        <ul className="modal-list">
          <li>{t('每个账号都会启动一次 app-server，请保持网络通畅')}</li>
          <li>{t('账号较多时可能需要等待一分钟以上，中途请不要重复点击')}</li>
        </ul>
        <p className="modal-target">
          {target.mode === 'row' ? t(`目标账号：${target.email}`) : t('目标账号：剩余额度 95% 以上的全部账号')}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t('取消')}
          </button>
          <button type="button" className="btn btn-warmup" disabled={locked} onClick={onConfirm}>
            {locked ? t(`${countdown} 秒后开始`) : t('确定预热')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DeleteConfirmModal({
  target,
  deleting,
  t,
  onCancel,
  onConfirm
}: {
  target: DeleteTarget
  deleting: boolean
  t: TFn
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="modal-back" role="presentation" onClick={() => !deleting && onCancel()}>
      <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{t('确认删除')}</h3>
        <p className="modal-text">
          {t('确定要删除账号')} <strong>{target.email}</strong> {t('吗？此操作不可恢复。')}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" disabled={deleting} onClick={onCancel}>
            {t('取消')}
          </button>
          <button type="button" className="btn btn-danger" disabled={deleting} onClick={onConfirm}>
            {deleting ? t('删除中…') : t('删除')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Toast({ message }: { message: string }) {
  return (
    <div className="toast" role="status">
      {message}
    </div>
  )
}

/** 右下角堆叠式通知：最多 3 则，新通知从下方滑入把旧通知往上推挤 */
export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((item) => (
        <div key={item.id} className="toast toast-item">
          {item.message}
        </div>
      ))}
    </div>
  )
}

export function RefreshIndicator({ text }: { text: string }) {
  return (
    <div className="global-refreshing-float">
      <span className="quota-spinner" aria-hidden />
      <span>{text}</span>
    </div>
  )
}
