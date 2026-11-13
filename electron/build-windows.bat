@echo off
chcp 65001 > nul
echo ==============================================================
echo    ساخت بسته نصبی و پرتابل ویندوز - جزوه‌نگار هوشمند
echo ==============================================================
echo.

:: 1. بررسی وجود Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطا] نرم‌افزار Node.js روی سیستم شما نصب نیست.
    echo لطفاً ابتدا Node.js (نسخه 18 یا بالاتر) را از https://nodejs.org دانلود و نصب کنید.
    pause
    exit /b 1
)

echo [1/4] کامپایل پروژه وب...
call npm run build
if %errorlevel% neq 0 (
    echo [خطا] کامپایل پروژه با خطا مواجه شد.
    pause
    exit /b 1
)

echo.
echo [2/4] انتخاب نسخه ویندوز هدف:
echo   1. ویندوز 10 و 11 (نسخه مدرن 64 بیتی)
echo   2. ویندوز 7 و 8.1 و 10 (نسخه پایدار 32 بیتی / سبک - Electron 22)
echo   3. ویندوز 7 و 8.1 و 10 (نسخه پایدار 64 بیتی - Electron 22)
set /p win_choice="گزینه مورد نظر را وارد کنید (پیش‌فرض 1): "

if "%win_choice%"=="2" (
    echo [3/4] ساخت نسخه 32 بیتی سازگار با ویندوز 7...
    call npx electron-builder --win --ia32 --config electron/electron-builder.json
) else if "%win_choice%"=="3" (
    echo [3/4] ساخت نسخه 64 بیتی سازگار با ویندوز 7...
    call npx electron-builder --win --x64 --config electron/electron-builder.json
) else (
    echo [3/4] ساخت نسخه مدرن ویندوز...
    call npx electron-builder --win --x64 --config electron/electron-builder.json
)

echo.
echo [4/4] عملیات با موفقیت به پایان رسید!
echo فایل‌های خروجی EXE در پوشه dist-electron قرار گرفتند:
echo   - فایل نصبی نصاب: SmartJozveh-Setup.exe
echo   - فایل پرتابل (بدون نیاز به نصب): SmartJozveh-Portable.exe
echo.
pause
