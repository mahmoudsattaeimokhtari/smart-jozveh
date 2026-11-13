import React from 'react';
import { X, HelpCircle, Laptop, Smartphone, FileText, CheckCircle2, Info } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  canInstallPWA: boolean;
  onInstallPWA: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  canInstallPWA,
  onInstallPWA,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">راهنما و آموزش کار با جزوه‌نگار هوشمند</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-slate-700 leading-relaxed">
          {/* Section 1: File Organization */}
          <div>
            <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>۱. ساختار سه سطحی فایل‌ها (جلسه ← قسمت ← فایل کوتاه)</span>
            </h3>
            <p className="text-slate-600 mb-2">
              کوتاه کردن فایل‌های صوتی به دلیل کاهش حجم مشکلی در ساختار ایجاد نمی‌کند. برنامه نام‌هایی مانند
              «جلسه اول»، «جلسه ۱۰»، «جلسه بیستم» و شماره قسمت‌های «۱، ۲، ۳» با اعداد فارسی و انگلیسی را
              به‌درستی تشخیص داده و تمام فایل‌های متعلق به یک جلسه را کنار هم قرار می‌دهد.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800">
              مثال الگو: جلسه ۱۰ ـ قسمت ۲ ـ فایل ۰۱.mp3
            </div>
          </div>

          {/* Section 2: Three Outputs */}
          <div>
            <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>۲. سه خروجی مستقل Word برای هر جلسه</span>
            </h3>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>
                <strong>متن کامل.docx:</strong> وفادار به گفتار، کلمه به کلمه همراه با برچسب زمان تک‌تک
                پاراگراف‌ها و تفکیک گویندگان.
              </li>
              <li>
                <strong>سؤالات.docx:</strong> سؤالات تستی و تشریحی و قید صریح پاسخ‌های بیان‌شده یا نشده در
                صوت.
              </li>
              <li>
                <strong>جزوه کلاسیک.docx:</strong> بازنویسی ساختاریافته با سرفصل‌ها، تعاریف و برجسته‌سازی با
                رنگ‌های گرم.
              </li>
            </ul>
          </div>

          {/* Section 3: Fonts in Word */}
          <div>
            <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600" />
              <span>۳. فونت‌های استاندارد B Nazanin و B Zar</span>
            </h3>
            <p className="text-slate-600">
              متن اصلی با فونت <strong>B Nazanin</strong>، تیترها با <strong>B Zar</strong> و عبارات انگلیسی با{' '}
              <strong>Times New Roman</strong> تنظیم شده‌اند. اگر این فونت‌ها روی ویندوز شما نصب نباشند، فایل
              Word با فونت جایگزین سیستم باز می‌شود؛ برای بهترین نمایش پیشنهاد می‌شود بسته فونت‌های فارسی سری B
              را روی رایانه خود نصب فرمایید.
            </p>
          </div>

          {/* Section 4: Install as App on Windows & Android */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-slate-700" />
              <span>۴. نسخه قابل نصب روی ویندوز و گوشی‌های اندروید (PWA)</span>
            </h3>
            <p className="text-slate-600 mb-3">
              این سامانه با استاندارد مدرن وب‌اپلیکیشن پیش‌رونده (PWA) طراحی شده است و می‌توانید آن را بدون
              نیاز به دانلود فایل‌های حجیم، مستقیماً به شکل یک برنامه مستقل روی دسکتاپ ویندوز یا صفحه اصلی گوشی
              اندروید خود نصب کنید:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-blue-600" />
                  <span>ویندوز (Chrome / Edge)</span>
                </div>
                <span>
                  روی علامت نصب در نوار آدرس یا دکمه «نصب برنامه» کلیک کنید تا مانند یک نرم‌افزار مستقل .exe
                  اجرا شود.
                </span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>اندروید (Chrome)</span>
                </div>
                <span>
                  در منوی سه نقطه مرورگر گزینه «افزودن به صفحه اصلی» (Add to Home screen) را لمس کنید.
                </span>
              </div>
            </div>

            {canInstallPWA && (
              <button
                onClick={onInstallPWA}
                className="mt-3 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition"
              >
                نصب مستقیم جزوه‌نگار هوشمند روی این دستگاه
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition"
          >
            متوجه شدم
          </button>
        </div>
      </div>
    </div>
  );
};
