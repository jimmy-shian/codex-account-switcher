import { Menu, nativeImage, Tray, type NativeImage } from 'electron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { mainText } from './settings'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface TrayHost {
  showMainWindow: () => void
  quitApp: () => void
}

let tray: Tray | null = null
let balloonShown = false

export function resolveAppIcon(): string {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  const candidates = [
    path.join(process.resourcesPath, 'build', iconName),
    path.join(process.resourcesPath, iconName),
    path.join(__dirname, '../../build', iconName),
    path.join(__dirname, '../../../build', iconName)
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[candidates.length - 1]
}

function resolveTrayImage(): NativeImage {
  return nativeImage.createFromPath(resolveAppIcon())
}

export function isTrayAvailable(): boolean {
  return tray != null
}

export function createTray(host: TrayHost): void {
  if (tray) return
  try {
    tray = new Tray(resolveTrayImage())
  } catch {
    tray = null
    return
  }
  tray.setToolTip(mainText('Codex 切号器'))
  tray.on('click', () => host.showMainWindow())
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: mainText('显示主窗口'), click: () => host.showMainWindow() },
      { type: 'separator' },
      { label: mainText('退出'), click: () => host.quitApp() }
    ])
  )
}

export function notifyHiddenToTray(): void {
  if (balloonShown || !tray || process.platform !== 'win32') return
  balloonShown = true
  try {
    tray.displayBalloon({
      icon: resolveTrayImage(),
      title: mainText('Codex 切号器'),
      content: mainText('已缩小到系统托盘，点击图标即可快速打开；右键图标可退出。')
    })
  } catch {
    /* 气泡通知失败不影响功能 */
  }
}

export function destroyTray(): void {
  try {
    tray?.destroy()
  } catch {
    /* ignore */
  }
  tray = null
}
