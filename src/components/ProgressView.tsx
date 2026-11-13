import React from 'react';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileAudio,
  FileText,
  HelpCircle,
  BookMarked,
  WifiOff,
} from 'lucide-react';

export type ProcessingStep =
  | 'idle'
  | 'slicing'
  | 'transcribing'
  | 'extracting_questions'
  | 'generating_notes'
  | 'building_documents'
  | 'completed'
  | 'error';

interface ProgressViewProps {
  currentStep: ProcessingStep;
  currentSessionTitle: string;
  currentFileName: string;
  currentPartName: string;
  completedChunks: number;
  totalChunks: number;
  percent: number;
  isOnline: boolean;
  errors: string[];
  onRetryFailed?: () => void;
  onCancel?: () => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  currentStep,
  currentSessionTitle,
  currentFileName,
  currentPartName,
  completedChunks,
  totalChunks,
  percent,
  isOnline,
  errors,
  onRetryFailed,
  onCancel,
}) => {
  const stepsConfig = [
    {
      id: 'slicing',
      title: 'تقطیع و آماده‌سازی صوت روی دستگاه',
      desc: 'برش قطعات زیر ۳۰ دقیقه بدون آپلود اولیه',
      icon: FileAudio,
    },
    {
      id: 'transcribing',
      title: 'در حال تبدیل صوت و آماده‌سازی متن کامل',
      desc: 'وفادار به کلام با درج زمان و تفکیک استاد و دانشجو',
      icon: FileText,
    },
    {
      id: 'extracting_questions',
      title: 'در حال استخراج و تحلیل سؤالات جلسه',
      desc: 'سؤالات تستی، تشریحی و ثبت پاسخ‌های صوتی',
      icon: HelpCircle,
    },
    {
      id: 'generating_notes',
      title: 'در حال ساخت جزوه کلاسیک موضوع‌بندی‌شده',
      desc: 'سرفصل‌ها، تعاریف، نکات آموزشی و برجسته‌سازی گرم',
      icon: BookMarked,
    },
    {
      id: 'building_documents',
      title: 'قالب‌بندی و ساخت اسناد Word و کتاب EPUB',
      desc: 'تنظیم فونت‌های B Nazanin و B Zar، جهت RTL و بسته‌بندی نهایی',
      icon: CheckCircle2,
    },
  ];

  const getStepStatus = (stepId: string) => {
    const order = ['slicing', 'transcribing', 'extracting_questions', 'generating_notes', 'building_documents', 'completed'];
    const currentIndex = order.indexOf(currentStep);
    const stepIndex = order.indexOf(stepId);

    if (currentStep === 'completed') return 'completed';
    if (currentIndex > stepIndex) return 'completed';
    if (currentIndex === stepIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-6 px-4">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 text-amber-800 mb-3">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-1">
          {currentSessionTitle || 'در حال پردازش خودکار جلسه'}
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          تمام مراحل به صورت خودکار و بدون نیاز به کلیک متوالی در حال اجرا است
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 mb-2">
          <div
            className="bg-amber-800 h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.max(5, Math.min(100, percent))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            قطعه {completedChunks} از {totalChunks || 1}
          </span>
          <span className="font-semibold text-slate-700">{Math.round(percent)}%</span>
        </div>

        {/* Current target info tag */}
        {currentFileName && (
          <div className="mt-3 inline-block px-3 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600">
            {currentPartName} · {currentFileName}
          </div>
        )}

        {!isOnline && (
          <div className="mt-3 flex items-center justify-center gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
            <WifiOff className="w-4 h-4 text-amber-700" />
            <span>
              ارتباط اینترنت موقتاً قطع است. پیشرفت شما تا این لحظه در دستگاه ذخیره شد و پس از اتصال مجدد
              خودکار ادامه خواهد یافت.
            </span>
          </div>
        )}
      </div>

      {/* Sequential Auto Steps */}
      <div className="space-y-3">
        {stepsConfig.map((s) => {
          const status = getStepStatus(s.id);
          const Icon = s.icon;

          return (
            <div
              key={s.id}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                status === 'active'
                  ? 'bg-white border-amber-600 shadow-sm'
                  : status === 'completed'
                  ? 'bg-slate-50/80 border-slate-200 text-slate-700'
                  : 'bg-white/40 border-slate-200/60 text-slate-400'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  status === 'active'
                    ? 'bg-amber-100 text-amber-900'
                    : status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {status === 'active' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-800" />
                ) : status === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>

              <div className="flex-1">
                <div
                  className={`text-sm font-semibold ${
                    status === 'active'
                      ? 'text-slate-900'
                      : status === 'completed'
                      ? 'text-slate-800'
                      : 'text-slate-400'
                  }`}
                >
                  {s.title}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{s.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Non-fatal Errors or Warnings */}
      {errors.length > 0 && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900">
          <div className="flex items-center gap-2 font-bold mb-1">
            <AlertCircle className="w-4 h-4 text-red-700" />
            <span>هشدارهای ثبت‌شده در جریان پردازش:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-red-800">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
          {onRetryFailed && (
            <button
              onClick={onRetryFailed}
              className="mt-2 text-xs font-semibold text-red-900 underline hover:text-red-950"
            >
              تلاش مجدد برای قطعات ناموفق
            </button>
          )}
        </div>
      )}

      {onCancel && (
        <div className="mt-6 text-center">
          <button
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-red-600 transition"
          >
            توقف فرآیند و بازگشت
          </button>
        </div>
      )}
    </div>
  );
};
