@echo off
setlocal EnableExtensions
chcp 65001 >nul

REM ============================================================
REM Codex Account Switcher - 一鍵編譯 EXE
REM ============================================================

REM 切換到 BAT 所在目錄
cd /d "%~dp0"

REM 再次關閉命令回顯，避免某些環境重新開啟 echo
@echo off

echo.
echo ========================================
echo  Codex 切換器 - 一鍵編譯 EXE
echo ========================================
echo.
echo [目前目錄]
echo %CD%
echo.

REM ============================================================
REM 0. 檢查必要檔案
REM ============================================================

if not exist "package.json" (
    echo [錯誤] 找不到 package.json
    echo.
    echo 請確認此 BAT 放在專案根目錄：
    echo %CD%
    goto :ERROR_END
)

REM ============================================================
REM 1. 檢查 Node.js
REM ============================================================

where node.exe >nul 2>nul

if errorlevel 1 (
    echo [錯誤] 找不到 Node.js。
    echo.
    echo 請先安裝 Node.js 20 或更新版本。
    echo 安裝完成後，重新開啟 CMD 再執行此 BAT。
    goto :ERROR_END
)

echo [OK] Node.js：
node --version

REM ============================================================
REM 2. 檢查 npm
REM ============================================================

where npm.cmd >nul 2>nul

if errorlevel 1 (
    echo.
    echo [錯誤] 找不到 npm。
    echo 請檢查 Node.js 是否完整安裝。
    goto :ERROR_END
)

echo [OK] npm：
call npm --version

echo.

REM ============================================================
REM 3. 安裝依賴
REM ============================================================

if not exist "node_modules\" (
    echo ========================================
    echo [1/2] 安裝專案依賴
    echo ========================================
    echo.
    echo 找不到 node_modules，開始執行 npm install...
    echo.

    call npm install

    if errorlevel 1 (
        echo.
        echo ========================================
        echo [錯誤] npm install 失敗
        echo ========================================
        echo.
        echo 請查看上方 npm 錯誤訊息。
        goto :ERROR_END
    )

    echo.
    echo [OK] npm install 完成。
) else (
    echo ========================================
    echo [1/2] 檢查專案依賴
    echo ========================================
    echo.
    echo [OK] node_modules 已存在，跳過 npm install。
)

echo.

REM ============================================================
REM 4. 編譯 Electron
REM ============================================================

echo ========================================
echo [2/2] 開始編譯 EXE
echo ========================================
echo.
echo 執行：
echo npm run build
echo.
echo 編譯流程：
echo   electron-vite build
echo          ↓
echo   electron-builder
echo.
echo ----------------------------------------
echo.

REM 避免 Electron Builder 自動搜尋 Windows 憑證
set "CSC_IDENTITY_AUTO_DISCOVERY=false"

call npm run build

set "BUILD_RESULT=%ERRORLEVEL%"

echo.

if not "%BUILD_RESULT%"=="0" (
    echo ========================================
    echo [錯誤] 編譯失敗
    echo ========================================
    echo.
    echo npm run build 回傳錯誤碼：
    echo %BUILD_RESULT%
    echo.
    echo 請往上查看：
    echo   electron-vite
    echo   vite
    echo   electron-builder
    echo.
    echo 所顯示的第一個 error / ERROR 訊息。
    goto :ERROR_END
)

REM ============================================================
REM 5. 檢查輸出目錄
REM ============================================================

echo ========================================
echo  編譯成功
echo ========================================
echo.

if exist "release-fixed\" (
    echo 輸出目錄：
    echo %CD%\release-fixed
    echo.

    echo 找到的 EXE：
    echo ----------------------------------------

    dir /b "release-fixed\*.exe" 2>nul

    if errorlevel 1 (
        echo [注意] release-fixed 中目前沒有找到 .exe。
        echo.
        echo Electron Builder 可能將安裝檔輸出到其他子目錄。
        echo 目前 release-fixed 內容：
        echo.
        dir /b "release-fixed"
    )

    echo ----------------------------------------
    echo.

    REM 自動開啟輸出資料夾
    start "" explorer.exe "%CD%\release-fixed"

) else (
    echo [警告] npm run build 成功，但找不到：
    echo %CD%\release-fixed
    echo.
    echo 請檢查 package.json 中 electron-builder 的輸出設定。
)

goto :SUCCESS_END


REM ============================================================
REM 錯誤結束
REM ============================================================

:ERROR_END
echo.
echo ========================================
echo  編譯程序未完成
echo ========================================
echo.

if /I "%~1"=="--nopause" goto :EOF
if /I "%~1"=="-y" goto :EOF

pause
goto :EOF


REM ============================================================
REM 成功結束
REM ============================================================

:SUCCESS_END
echo.
echo ========================================
echo  全部處理完成
echo ========================================
echo.

if /I "%~1"=="--nopause" goto :EOF
if /I "%~1"=="-y" goto :EOF

pause

endlocal
goto :EOF