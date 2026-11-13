@echo off
chcp 65001 > nul
echo ==============================================================
echo       ساخت فایل نصبی اندروید (APK) - جزوه‌نگار هوشمند
echo ==============================================================
echo.

echo [1/3] کامپایل فایل‌های وب...
call npm run build
if %errorlevel% neq 0 (
    echo [خطا] کامپایل وب با خطا مواجه شد.
    pause
    exit /b 1
)

echo.
echo [2/3] همگام‌سازی دارایی‌ها با پروژه اندروید...
call npx cap sync android

echo.
echo [3/3] ساخت بسته نصبی مستقیم APK با Gradle...
cd android
call gradlew.bat assembleRelease

if %errorlevel% neq 0 (
    echo [خطا] ساخت APK نیازمند نصب بودن Android SDK و Java JDK 17 است.
    echo می‌توانید پروژه پوشه android را مستقیماً در Android Studio باز کرده و Build > Build APK را بزنید.
    cd ..
    pause
    exit /b 1
)

cd ..
echo.
echo [موفقیت] فایل‌های APK با حجم بهینه‌سازی‌شده ساخته شدند:
echo   - نسخه مدرن 64 بیتی: android/app/build/outputs/apk/release/app-arm64-v8a-release.apk
echo   - نسخه گوشی‌های قدیمی 32 بیتی: android/app/build/outputs/apk/release/app-armeabi-v7a-release.apk
echo   - نسخه جامع جهانی: android/app/build/outputs/apk/release/app-universal-release.apk
echo.
pause
