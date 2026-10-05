# Codex Account Switcher / Codex切号器

Codex Account Switcher 是一个面向 Windows 的 Codex切号器、Codex账号切换工具，用来管理多个 ChatGPT 登录型 Codex 账号。它会加密保存每个账号的 `auth.json` 快照，并在切换账号时原子覆盖当前用户的 `%USERPROFILE%\.codex\auth.json`。

除了切号，本工具还整合了 Live 账号汇入、Codex 进程的一键启动/关闭/重启、Proxy 设置、路径自定义与简繁体界面切换。

常见搜索词：Codex切号器、codex切号器、Codex账号切换、codex账号切换、Codex账号切号、codex账号切号、Codex切换账号、codex切换账号、Codex多账号、codex多账号、Codex账号管理、ChatGPT账号切换、OpenAI账号切换、Codex 一键重启。

## 截图

![Codex切号器账号列表截图](docs/images/codex-switcher-screenshot.png)

## 功能

账号管理：

- 通过浏览器登录添加账号，登录失败时可自动切换到设备码登录；登录完成立刻刷新一次额度。
- 导入当前 Live `auth.json`，或一次多选导入多个 JSON 文件；导入失败时直接回报是文件读不到、格式不对还是快照缺失。
- 导出账号为多个独立 JSON 文件，每个账号一个，文件名按昵称/邮箱生成。
- 切换账号前自动备份现有 Live `auth.json`。
- 删除账号有二次确认弹窗，避免误删。

Live 汇入：

- `汇入 Live` 一键抓取当前 Live `auth.json`，合并进列表后刷新全部额度。
- 所有账号都需经由本工具登录或汇入，不再读取任何第三方账号文件；既有第三方账号请全部重新登录。

额度与状态：

- 刷新账号邮箱、套餐、5 小时额度、7 天额度和状态。
- 额度筛选分为全部 / 可用 / 无额度 / 封禁，并在选项上显示各分类的账号数量。
- 点击 `5h 额度` 或 `7d 额度` 表头可切换升序、降序排序。
- 批量刷新使用有限并发，避免大量账号串行等待。
- 应用开启后每 5 分钟自动刷新一次全部额度（登录或刷新进行中时自动跳过）。

Codex 进程控制：

- 一键启动 Codex、关闭 Codex、一键重启 Codex（先关后起，方便切号后立刻接着用）。
- 用 `tasklist` + `WMIC` 列出运行中的 `codex.exe`，并显示「Codex 运行中（N）」状态，每 4 秒轮询一次。
- 关闭进程时先请求温和退出，等待宽限时间后才强制结束，尽量避免未保存内容直接消失。
- 启动终端可选：自动（优先 Windows Terminal）/ Windows Terminal / cmd 窗口 / 直接执行（无窗口）。
- 可指定启动目录，留空则使用用户目录。

界面与设置：

- 界面语言可切换简体中文 / 繁體中文，选择会写入设置文件，重启后保留。
- Proxy 设置：填入代理地址后保存，留空表示直连。
- 「路径设置」可自定义 Codex 执行文件、启动目录与启动终端；留空表示自动检测，并在界面上标出「自动 / 自定义」与实际解析到的路径。
- 支持键盘快捷键，输入框内打字不会误触。
- 点击账号邮箱即可复制到剪贴板。

## 界面操作

工具栏：

- `额度筛选`：切换全部 / 可用 / 无额度 / 封禁，括号内为该分类的账号数。
- `界面语言`：切换简体中文 / 繁體中文，主进程对话框与窗口标题也会跟着转换。
- `添加账号`：启动 Codex app-server 登录流程，并通过浏览器完成授权；登录期间界面会出现提示条，可点「取消登录」结束等待。
- `汇入 Live`：抓取当前 Live `auth.json`，并刷新全部额度。
- `从 JSON 导入`：支持多选标准 `auth.json` 文件；导入后会自动刷新本次导入的账号信息。
- `导出 JSON`：选择目录后，为每个账号写出一个明文 JSON 文件。
- `一键预热`：对剩余额度 95% 以上的账号发送一次最小消息，促使额度数据更新。
- `预热` / `一键预热`：点击后先弹出确认窗口，倒数 3 秒结束才能按下确认，避免误触发长时间操作。
- `Proxy（留空＝直连）`：输入后按 Enter 或点「保存 Proxy」生效。

路径设置栏：

- `路径设置`：展开或收起路径设置面板。
- `一键重啟 Codex`：关闭运行中的 Codex，再用当前账号重新启动。
- `启动 Codex` / `关闭 Codex`：按当前进程状态自动切换按钮行为。

路径设置面板：

- `Codex 执行文件`：留空自动检测，找不到时可直接浏览选择。
- `启动目录`：留空＝用户目录。
- `启动终端`：自动 / Windows Terminal / cmd 窗口 / 直接执行（无窗口）。
- 输入框支持 `Enter` 确认、`Esc` 还原。

账号列表：

- 表头 `5h 额度`、`7d 额度` 可点击排序。
- 行内操作：`切换`、`刷新`、`预热`、`删除`。
- 邮箱左侧显示「当前」标记表示 Live 使用的账号，下方显示套餐徽章与稳定指纹前 12 码。
- 状态标签包括正常、刷新中、未授权/过期、无额度数据、app-server 失败、快照损坏、待刷新。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl+Shift+N` | 添加账号 |
| `Ctrl+Shift+S` | 汇入 Live 并刷新全部 |
| `Ctrl+Shift+R` | 一键重启 Codex |
| `Ctrl+Shift+Q` | 启动 / 关闭 Codex |

快捷键在焦点位于输入框或文本域时不会触发，避免打字误操作。

## 项目结构

```text
src/main/              Electron 主进程、账号服务、Codex RPC、进程控制、存储和打包路径
src/preload/           安全暴露给渲染层的 IPC API
src/renderer/          React 单页界面
src/shared/            主进程和渲染层共用类型、额度展示逻辑、简繁转换
resources/             可选放置随包分发的 Codex 可执行文件
```

关键文件：

- `src/main/index.ts`：窗口创建、IPC 注册、导入导出对话框。
- `src/main/account-service.ts`：账号导入、导出、切换、刷新、预热和删除。
- `src/main/codex-rpc.ts`：通过 `codex app-server` 做 JSON-RPC 通信。
- `src/main/codex-process.ts`：列出、启动、关闭与重启 Codex 进程。
- `src/main/settings.ts`：语言、Proxy、路径、启动终端等设置读写。
- `src/main/paths.ts`：定位 Live `auth.json` 与 Codex 可执行文件。
- `src/main/crypto-blob.ts`：用 Electron `safeStorage` 加密/解密账号快照。
- `src/main/auth-atomic.ts`：备份和原子写入 Live `auth.json`。
- `src/shared/i18n.ts`：简繁转换与语言设置，主进程文案也走这里。
- `src/renderer/src/App.tsx`：桌面端主界面。
- `src/renderer/src/components/PathSettings.tsx`：路径设置与 Codex 进程控制面板。

## 数据位置

- 账号元数据和加密快照：Electron `userData` 下的 `data/` 目录，通常在 `%APPDATA%\codex-account-switcher\data\`。
- 应用设置：Electron `userData` 下的 `settings.json`，包含语言、Proxy、路径、启动终端与关闭宽限时间。
- Live 认证文件：`%USERPROFILE%\.codex\auth.json`。
- 切换账号前备份：`%USERPROFILE%\.codex\auth.json.bak.<timestamp>`。

本地保存的账号快照使用 Electron `safeStorage` 加密。导出的 JSON 文件是明文凭据，等同账号登录令牌备份，不要提交到 Git、网盘共享目录或聊天窗口。

## Codex CLI

应用需要能运行 `codex app-server`。解析顺序：

1. 打包资源目录中的 `resources/codex.exe`、`codex.cmd` 或 `codex`。
2. OpenAI Codex 官方安装目录 `%LOCALAPPDATA%\OpenAI\Codex\bin`。
3. Windows `where codex`。
4. 当前 `PATH`。
5. `%APPDATA%\npm\codex.cmd`。
6. Node 安装目录和常见本地安装目录。

如果没有找到 Codex CLI，刷新额度、登录添加、启动/重启 Codex 和预热会失败。

## 开发

```bash
npm install
npm run dev
```

### Windows 启动注意事项（重要）

本项目的 `electron-vite dev` 会启动 renderer dev server 后再拉起 Electron 应用。如果启动时报错并停在 `start electron app...`：

```text
TypeError: Cannot read properties of undefined (reading 'exports')
    at cjsPreparseModuleExports (node:internal/modules/esm/translators:379:81)
Node.js v20.18.3
```

原因是系统环境变量 `ELECTRON_RUN_AS_NODE` 被设成了 `1`。该变量会让 `electron.exe` 以纯 Node 模式运行，Electron 内建模块没有注册，主进程的 `import ... from "electron"` 会解析到 `node_modules/electron/index.js`（CJS）并因此崩溃。

先确认当前值：

```bat
echo %ELECTRON_RUN_AS_NODE%
```

清除后再启动（cmd.exe）：

```bat
set "ELECTRON_RUN_AS_NODE=" && npm run dev
```

PowerShell：

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm run dev
```

注意：一定要写成 `set "ELECTRON_RUN_AS_NODE="`，带引号的写法才是真正删除变量。写成 `set ELECTRON_RUN_AS_NODE=` 只会把值设成一个空格 `" "`，Electron 仍会判定为 Node 模式，崩溃依旧。

永久修法是到「系统属性 → 高级 → 环境变量」把 `ELECTRON_RUN_AS_NODE` 删除。该变量同样会影响 `npm run build` 与 `electron-builder` 打包。

## 测试

```bash
npm test
```

## 构建

```bash
npm run build
```

构建流程先运行 `electron-vite build`，再用 `electron-builder` 输出 Windows portable 和 NSIS 安装包。产物目录是 `release-fixed/`。

`package.json` 中使用 `cross-env CSC_IDENTITY_AUTO_DISCOVERY=false`，用于避免未配置代码签名环境时被自动签名流程阻断。

## 调试预热

可通过环境变量或参数导出单个账号的预热诊断信息：

```bash
CODEX_DEBUG_WARMUP_ID=<account-id> CODEX_DEBUG_OUT=warmup-debug.json npm run dev
```

或：

```bash
npm run dev -- --debug-warmup <account-id> --debug-out warmup-debug.json
```

`warmup-debug.json` 可能包含账号和请求诊断信息，不要提交。

## 常见问题

### dev 启动报 `Cannot read properties of undefined (reading 'exports')`

环境变量 `ELECTRON_RUN_AS_NODE` 被设成了 `1`，Electron 没有以浏览器进程启动。参照上面「Windows 启动注意事项」清除该变量后重试。

### 找不到 Codex CLI

确认终端中能执行 `codex app-server`，或把可执行文件放入 `resources/` 后重新打包；也可以在「路径设置」的 `Codex 执行文件` 直接指定完整路径。

### 账号显示 app-server 失败

通常是 Codex CLI 不可用、登录状态过期、网络失败或 app-server 协议调用失败。可以先刷新单个账号，仍失败再重新登录或重新导入该账号的 `auth.json`。若设置了 Proxy，可先确认 `保存 Proxy` 已生效。

### 一键重启 Codex 没有反应

面板会显示「Codex 运行中（N）」，确认该数量不是 0；关闭进程使用 `taskkill`，若目标程序拒绝退出，程序会等待设置的宽限时间后再强制结束。可在 `settings.json` 调整 `codexStopGraceMs`（默认 1500 毫秒）。

### Live 与列表高亮不一致

应用使用稳定指纹匹配 Live `auth.json` 和账号列表。若 token 刷新导致原始指纹变化，列表刷新时会尝试补齐稳定指纹；仍不匹配时可使用 `汇入 Live`。

### safeStorage 不可用

本工具依赖 Electron `safeStorage`。如果系统加密能力不可用，账号快照无法加密保存，需要先修复系统凭据/加密环境。

## 安全提醒

- 加密快照只适合保存在本机应用数据目录。
- `导出 JSON` 输出的是明文 `auth.json`，请按密钥文件处理。
- 不要把真实 `auth.json`、导出目录、`.enc` 快照或调试输出提交到仓库。
- 项目默认忽略构建产物和本地工作记录，发布前仍建议执行一次敏感词扫描。
