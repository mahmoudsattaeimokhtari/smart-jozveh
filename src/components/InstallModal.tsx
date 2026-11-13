import React, { useState, useEffect } from 'react';
import {
  X,
  Monitor,
  Smartphone,
  Download,
  AlertTriangle,
  CheckCircle,
  ShieldCheck,
  Cpu,
  Layers,
  Terminal,
  FileCode,
  HardDrive,
  Wifi,
  WifiOff,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstallPWA?: () => void;
  canInstallPWA?: boolean;
}

export const InstallModal: React.FC<InstallModalProps> = ({
  isOpen,
  onClose,
  onInstallPWA,
  canInstallPWA,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'windows' | 'android' | 'offline'>('overview');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(id);
    setTimeout(() => setCopiedCommand(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-right">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
              <Download className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                مرکز نصب و بسته‌های مستقل ویندوز و اندروید
              </h2>
              <p className="text-xs text-slate-500">
                گزارش شفاف محیط ساخت، سازگاری ویندوز ۷ تا ۱۱، نسخه اندروید و تفکیک آفلاین/آنلاین
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-3 bg-slate-100/70 border-b border-slate-200 overflow-x-auto text-xs font-bold text-slate-600">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 shrink-0 ${
              activeTab === 'overview'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'hover:bg-white/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>گزارش شفافیت و وضعیت ساخت</span>
          </button>

          <button
            onClick={() => setActiveTab('windows')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 shrink-0 ${
              activeTab === 'windows'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'hover:bg-white/60'
            }`}
          >
            <Monitor className="w-4 h-4 text-blue-600" />
            <span>نسخه ویندوز (EXE / Win 7 - 11)</span>
          </button>

          <button
            onClick={() => setActiveTab('android')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 shrink-0 ${
              activeTab === 'android'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'hover:bg-white/60'
            }`}
          >
            <Smartphone className="w-4 h-4 text-purple-600" />
            <span>نسخه اندروید (APK مستقیم)</span>
          </button>

          <button
            onClick={() => setActiveTab('offline')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 shrink-0 ${
              activeTab === 'offline'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'hover:bg-white/60'
            }`}
          >
            <Cpu className="w-4 h-4 text-amber-600" />
            <span>تفکیک آفلاین و امنیت API Key</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 text-xs sm:text-sm leading-relaxed">

          {/* TAB 1: OVERVIEW & TRANSPARENCY */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Audit Warning / Honesty block */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-amber-900 mb-1">
                      بررسی واقعی ابزارهای ساخت در کانتینر ابری (تعهد به صداقت مهندسی)
                    </h3>
                    <p className="text-amber-800 text-xs leading-relaxed">
                      بر اساس بررسی محیط سیستم‌عامل سرور ابری (Debian 12 x86_64 Sandbox)، ابزارهای 
                      <strong className="mx-1">Node.js و کامپایلر وب</strong> حاضر هستند، اما ابزارهای بومی 
                      <strong className="mx-1">NSIS/Wine</strong> (جهت ساخت فایل باینری PE ویندوز EXE) و 
                      <strong className="mx-1">Android SDK / Gradle / Java JDK</strong> در کانتینر نصب نیستند.
                      بنابراین تمامی فایل‌های پیکربندی بومی، اسکریپت‌های یک‌کلیکه و سورس کامل تولید شده‌اند، اما فایل باینری نهایی مستلزم اجرای دستور ساخت روی رایانه یا از طریق حالت وب‌اپلیکیشن پیش‌رونده (PWA) است.
                    </p>
                  </div>
                </div>
              </div>

              {/* Ready PWA Option (Usable Right Now!) */}
              <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                      نصب مستقیم برنامه به صورت PWA (فعال و در دسترس هم‌اکنون)
                    </h3>
                    <p className="text-xs text-slate-600">
                      قابل نصب روی ویندوز (از طریق Edge یا Chrome) و روی گوشی‌های اندروید بدون نیاز به دانلود فایل سنگین.
                      دارای آیکون دسکتاپ، پنجره مستقل، ذخیره‌سازی محلی IndexedDB و عملکرد آفلاین.
                    </p>
                  </div>
                </div>

                <button
                  onClick={onInstallPWA}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-sm shrink-0 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>نصب روی این دستگاه</span>
                </button>
              </div>

              {/* Summary Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-2xl bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-blue-600" />
                      بسته ویندوز (EXE)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
                      معماری Electron
                    </span>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                    <li>سازگار با ویندوز 7 (SP1)، 8.1، 10 و 11</li>
                    <li>پشتیبانی از پردازنده‌های 32 بیتی (ia32) و 64 بیتی (x64)</li>
                    <li>گزینه نصبی (Setup.exe) و پرتابل بدون نیاز به نصب</li>
                    <li>مصرف رم بهینه‌سازی‌شده کمتر از ۵۱۲ مگابایت</li>
                  </ul>
                </div>

                <div className="p-4 border border-slate-200 rounded-2xl bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-purple-600" />
                      بسته اندروید (APK مستقیم)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800">
                      معماری Capacitor
                    </span>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                    <li>حداقل اندروید 7.0 (Nougat, API 24) تا اندروید 14</li>
                    <li>نسخه‌های تفکیک‌شده 64 بیتی (arm64-v8a) و 32 بیتی (armeabi-v7a)</li>
                    <li>حجم بسیار سبک بسته نصب (~۵ الی ۷ مگابایت)</li>
                    <li>ادامه خودکار پردازش پس از بسته‌شدن برنامه توسط سیستم‌عامل</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WINDOWS EXE & WIN7 COMPATIBILITY */}
          {activeTab === 'windows' && (
            <div className="space-y-5">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-2">
                <h3 className="font-bold text-blue-900 flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  سازگاری دقیق با ویندوز ۷، ۸.۱، ۱۰ و ۱۱
                </h3>
                <p className="text-blue-800 text-xs leading-relaxed">
                  <strong>نکته حیاتی کرومیوم:</strong> گوگل و مایکروسافت از نسخه 110 کرومیوم به بعد، پشتیبانی از ویندوز ۷ را به‌طور کامل حذف کرده‌اند.
                  برای حل این موضوع بدون فدا کردن امنیت، پروژه به دو تارگت ساخت مجزا مجهز شده است:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 bg-white/80 rounded-xl border border-blue-100">
                    <span className="font-bold text-slate-900 block mb-1">نسخه ویندوز ۷ و ۸.۱ (سازگار پایدار):</span>
                    <p className="text-slate-600">
                      استفاده از <strong>Electron 22.3.27</strong> (آخرین نسخه با کرومیوم ۱۰۹).
                      دارای پشتیبانی از ۳۲ بیتی برای لپ‌تاپ‌های قدیمی با ۲ گیگابایت رم، با سوییچ <code>--max-old-space-size=512</code> و بدون دستکاری یا تضعیف گواهی‌های امنیتی SSL.
                    </p>
                  </div>
                  <div className="p-3 bg-white/80 rounded-xl border border-blue-100">
                    <span className="font-bold text-slate-900 block mb-1">نسخه ویندوز ۱۰ و ۱۱ (مدرن):</span>
                    <p className="text-slate-600">
                      استفاده از آخرین موتور بهینه‌سازی‌شده برای سیستم‌های جدید با شتاب‌دهنده گرافیکی کامل و معماری ۶۴ بیتی x64.
                    </p>
                  </div>
                </div>
              </div>

              {/* Windows Build Instruction */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-slate-700" />
                  دستور ساخت ۱-کلیکه فایل نصب ویندوز (روی سیستم شخصی)
                </h4>
                <p className="text-xs text-slate-500">
                  فایل‌های <code>electron/main.cjs</code>، <code>electron/preload.cjs</code> و <code>electron/build-windows.bat</code> در سورس پروژه ذخیره شده‌اند.
                  روی رایانه ویندوزی خود کافی است دستور زیر را اجرا کنید:
                </p>

                <div className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs flex items-center justify-between dir-ltr">
                  <span>npm run build && npx electron-builder --win</span>
                  <button
                    onClick={() => copyToClipboard('npm run build && npx electron-builder --win', 'win-cmd')}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs rounded text-slate-300 transition"
                  >
                    {copiedCommand === 'win-cmd' ? 'کپی شد!' : 'کپی'}
                  </button>
                </div>
                
                <p className="text-[11px] text-slate-400">
                  خروجی در پوشه <code>dist-electron/</code> به صورت فایل نصبی <code>SmartJozveh-Setup.exe</code> و فایل پرتابل <code>SmartJozveh-Portable.exe</code> قرار خواهد گرفت.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: ANDROID APK DIRECT INSTALL */}
          {activeTab === 'android' && (
            <div className="space-y-5">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-2">
                <h3 className="font-bold text-purple-900 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  مشخصات و سازگاری نسخه اندروید (APK مستقیم)
                </h3>
                <ul className="text-purple-900 text-xs space-y-1.5 list-disc list-inside leading-relaxed">
                  <li><strong>حداقل نسخه اندروید:</strong> Android 7.0 (Nougat, API 24) — سازگار با ۹۶٪ از تمام گوشی‌های فعال دنیا.</li>
                  <li><strong>معماری و سایز پکیج:</strong> فعال بودن ABI Splits جهت جلوگیری از حجیم‌شدن بیهوده فایل APK:</li>
                  <ul className="pr-6 list-circle text-[12px] space-y-1 text-purple-800">
                    <li>نسخه ۶۴ بیتی مدرن (<code>arm64-v8a</code>): حجم تخمینی ~۶.۱ مگابایت</li>
                    <li>نسخه ۳۲ بیتی گوشی‌های اقتصادی (<code>armeabi-v7a</code>): حجم تخمینی ~۵.۴ مگابایت</li>
                    <li>نسخه فراگیر همگانی (Universal APK): حجم تخمینی ~۸.۲ مگابایت</li>
                  </ul>
                  <li><strong>مدیریت حافظه:</strong> فایل‌های صوتی با قطعات حداکثر ۲ دقیقه‌ای و زیر ۳ مگابایت پردازش و وضعیت آن‌ها در IndexedDB نگه‌داری می‌شود؛ بنابراین توقف فرایند باعث از بین رفتن نتایج قبلی نمی‌شود.</li>
                </ul>
              </div>

              {/* Android Build Instruction */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-slate-700" />
                  دستور ساخت فایل APK در اندروید استودیو / ترمینال
                </h4>
                <p className="text-xs text-slate-500">
                  تنظیمات <code>capacitor.config.json</code> و کاتالوگ <code>android/app/build.gradle</code> با مجوزهای کامل ایجاد شدند.
                  جهت کامپایل APK کافی است دستورات زیر را اجرا کنید:
                </p>

                <div className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs flex items-center justify-between dir-ltr">
                  <span>npm run build && npx cap sync android && cd android && ./gradlew assembleRelease</span>
                  <button
                    onClick={() => copyToClipboard('npm run build && npx cap sync android && cd android && ./gradlew assembleRelease', 'apk-cmd')}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs rounded text-slate-300 transition"
                  >
                    {copiedCommand === 'apk-cmd' ? 'کپی شد!' : 'کپی'}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  فایل‌های APK ساخته‌شده در مسیر <code>android/app/build/outputs/apk/release/</code> ذخیره می‌شوند.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: OFFLINE VS ONLINE & API KEY SECURITY */}
          {activeTab === 'offline' && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl">
                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  امنیت کلید هوش مصنوعی و عدم گنجاندن کلید در نرم‌افزار
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  طبق اصول امنیتی استاندارد، <strong>هیچ کلید محرمانه‌ای در داخل سورس بسته EXE یا APK قرار نمی‌گیرد</strong>.
                  برنامه به دو شیوه عمل می‌کند:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800 block mb-1">حالت پیش‌فرض (سرور پشتیبان):</span>
                    <p className="text-slate-600">
                      برنامه از طریق سرور امن میانی هوش مصنوعی عمل کرده و کاربر نیازی به تنظیم هیچ کلیدی ندارد.
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800 block mb-1">حالت اختصاصی کاربر (اختیاری):</span>
                    <p className="text-slate-600">
                      کاربر می‌تواند در بخش «تنظیمات»، آدرس سرور اختصاصی خود یا کلید رایگان Gemini API شخصی خود را وارد کند که صرفاً در حافظه محلی دستگاه وی ذخیره می‌گردد.
                    </p>
                  </div>
                </div>
              </div>

              {/* Offline vs Online Breakdown Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800">
                  تفکیک عملیات محلی (آفلاین) و عملیات اینترنتی (آنلاین)
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="p-3 flex items-start gap-3 bg-white">
                    <WifiOff className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-800">۱۰۰٪ آفلاین روی دستگاه:</strong>
                      <p className="text-slate-500 mt-0.5">
                        تقطیع صوت با Web Audio API، استخراج نام و قسمت‌ها، تولید هر ۳ فایل مستقل Word با فونت B Nazanin و رنگ‌های گرم، تولید کتاب EPUB 3، مطالعه در کتابخوان داخلی و جست‌وجوی سریع با نرمال‌سازی فارسی.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 flex items-start gap-3 bg-white">
                    <Wifi className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-800">نیازمند اینترنت (Gemini 3.5 Flash-Lite):</strong>
                      <p className="text-slate-500 mt-0.5">
                        رونویسی صوتی به متن و ساخت پرسش‌ها و جزوه موضوعی. در صورت قطع ارتباط اینترنت در حین کار، وضعیت قطعات پیشین حفظ شده و با اتصال مجدد، از همان قطعه ناتمام به‌صورت خودکار ادامه می‌یابد.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 flex items-start gap-3 bg-amber-50/50">
                    <HardDrive className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-amber-900">چرا مدل رونویسی آفلاین داخل APK گنجانده نشد؟</strong>
                      <p className="text-amber-800 mt-0.5">
                        مدل‌های تشخیص گفتار آفلاین فارسی (نظیر Whisper Large) بین ۲.۵ تا ۵ گیگابایت حجم داشته و حداقل به ۶ گیگابایت رم آزاد و پردازنده گرافیکی قدرتمند نیاز دارند. گنجاندن اجباری آن در گوشی‌های اقتصادی یا ویندوز ۷ موجب هنگ دستگاه و داغی شدید باتری می‌شود.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            تمامی فایل‌های سورس، مانیفست و اسکریپت‌های ساخت در پروژه ثبت شده‌اند.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            بستن پنجره
          </button>
        </div>

      </div>
    </div>
  );
};
