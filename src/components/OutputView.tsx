import React, { useState } from 'react';
import {
  FileText,
  HelpCircle,
  BookMarked,
  BookOpen,
  Archive,
  Download,
  RotateCcw,
  CheckCircle,
  Loader2,
  FileDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import JSZip from 'jszip';
import { Document, Packer } from 'docx';
import { ProcessedSession, AppSettings } from '../types';
import {
  generateFullTranscriptDocx,
  generateQuestionsDocx,
  generateClassicNoteDocx,
  buildFullTranscriptDocument,
  buildQuestionsDocument,
  buildClassicNoteDocument,
} from '../utils/docxGenerator';
import { generateSessionEpub } from '../utils/epubGenerator';

interface OutputViewProps {
  session: ProcessedSession;
  settings: AppSettings;
  onOpenReader: () => void;
  onNewJob: () => void;
}

type DownloadingTarget = 'transcript' | 'questions' | 'classic' | 'epub' | 'all-docx' | 'zip' | null;

export const OutputView: React.FC<OutputViewProps> = ({
  session,
  settings,
  onOpenReader,
  onNewJob,
}) => {
  const [downloadingTarget, setDownloadingTarget] = useState<DownloadingTarget>(null);
  const [lastDownloadedFile, setLastDownloadedFile] = useState<string | null>(null);

  // Sanitize filename for safe cross-platform saving (Windows, Android, Mac)
  const safeSessionName = (session.sessionTitle || 'جلسه درس')
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim();

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setLastDownloadedFile(fileName);
    setTimeout(() => {
      setLastDownloadedFile((current) => (current === fileName ? null : current));
    }, 4000);
  };

  // 1. خروجی اول: متن کامل و وفادار به گفتار استاد با استفاده مستقیم از docx
  const handleDownloadTranscript = async () => {
    try {
      setDownloadingTarget('transcript');
      const doc: Document = buildFullTranscriptDocument(session, settings);
      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `${safeSessionName} ـ متن کامل.docx`);
    } catch (err) {
      console.error('Error generating transcript docx:', err);
      alert('خطا در ایجاد فایل Word متن کامل. لطفاً دوباره تلاش کنید.');
    } finally {
      setDownloadingTarget(null);
    }
  };

  // 2. خروجی دوم: سؤالات جلسه با استفاده مستقیم از docx
  const handleDownloadQuestions = async () => {
    try {
      setDownloadingTarget('questions');
      const doc: Document = buildQuestionsDocument(session, settings);
      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `${safeSessionName} ـ سؤالات.docx`);
    } catch (err) {
      console.error('Error generating questions docx:', err);
      alert('خطا در ایجاد فایل Word سؤالات. لطفاً دوباره تلاش کنید.');
    } finally {
      setDownloadingTarget(null);
    }
  };

  // 3. خروجی سوم: جزوه کلاسیک و دسته‌بندی‌شده با استفاده مستقیم از docx
  const handleDownloadClassicNote = async () => {
    try {
      setDownloadingTarget('classic');
      const doc: Document = buildClassicNoteDocument(session, settings);
      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `${safeSessionName} ـ جزوه کلاسیک.docx`);
    } catch (err) {
      console.error('Error generating classic note docx:', err);
      alert('خطا در ایجاد فایل Word جزوه کلاسیک. لطفاً دوباره تلاش کنید.');
    } finally {
      setDownloadingTarget(null);
    }
  };

  // 4. دانلود همزمان هر سه فایل Word به صورت مستقل
  const handleDownloadAllThreeDocx = async () => {
    try {
      setDownloadingTarget('all-docx');
      const transcriptDoc = buildFullTranscriptDocument(session, settings);
      const questionsDoc = buildQuestionsDocument(session, settings);
      const classicDoc = buildClassicNoteDocument(session, settings);

      const [transcriptBlob, questionsBlob, noteBlob] = await Promise.all([
        Packer.toBlob(transcriptDoc),
        Packer.toBlob(questionsDoc),
        Packer.toBlob(classicDoc),
      ]);

      // Download each file individually
      downloadBlob(transcriptBlob, `${safeSessionName} ـ متن کامل.docx`);
      await new Promise((r) => setTimeout(r, 400));
      downloadBlob(questionsBlob, `${safeSessionName} ـ سؤالات.docx`);
      await new Promise((r) => setTimeout(r, 400));
      downloadBlob(noteBlob, `${safeSessionName} ـ جزوه کلاسیک.docx`);
    } catch (err) {
      console.error('Error generating all docx files:', err);
      alert('خطا در ایجاد فایل‌های Word.');
    } finally {
      setDownloadingTarget(null);
    }
  };

  // 5. کتاب الکترونیک EPUB 3
  const handleDownloadEpub = async () => {
    try {
      setDownloadingTarget('epub');
      const blob = await generateSessionEpub(session);
      downloadBlob(blob, `${safeSessionName} ـ کتاب الکترونیک.epub`);
    } catch (err) {
      console.error('Error generating epub:', err);
      alert('خطا در ایجاد فایل کتاب الکترونیک.');
    } finally {
      setDownloadingTarget(null);
    }
  };

  // 6. دانلود جامع همه خروجی‌ها در فایل فشرده ZIP
  const handleDownloadAllZip = async () => {
    try {
      setDownloadingTarget('zip');
      const zip = new JSZip();

      const [transcriptBlob, questionsBlob, noteBlob, epubBlob] = await Promise.all([
        generateFullTranscriptDocx(session, settings),
        generateQuestionsDocx(session, settings),
        generateClassicNoteDocx(session, settings),
        generateSessionEpub(session),
      ]);

      zip.file(`${safeSessionName} ـ متن کامل.docx`, transcriptBlob);
      zip.file(`${safeSessionName} ـ سؤالات.docx`, questionsBlob);
      zip.file(`${safeSessionName} ـ جزوه کلاسیک.docx`, noteBlob);
      zip.file(`${safeSessionName} ـ کتاب الکترونیک.epub`, epubBlob);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, `${safeSessionName} ـ بسته کامل اسناد.zip`);
    } catch (err) {
      console.error('Error packaging zip:', err);
      alert('خطا در فشرده‌سازی و دانلود بسته اسناد.');
    } finally {
      setDownloadingTarget(null);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4">
      {/* Success banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-6 text-center shadow-sm">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <CheckCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">
          خروجی‌های {session.sessionTitle} آماده است
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
          هر سه فایل Word با استانداردهای درخواستی (متن فارسی <span className="font-semibold text-slate-800">B Nazanin</span>، تیترها{' '}
          <span className="font-semibold text-slate-800">B Zar</span>، اصطلاحات انگلیسی{' '}
          <span className="font-semibold text-slate-800">Times New Roman</span> و برجسته‌سازی با رنگ‌های گرم) ساخته شده‌اند.
        </p>

        {/* Notification toast if recently downloaded */}
        {lastDownloadedFile && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-900 rounded-lg text-xs font-semibold animate-in fade-in">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
            <span>فایل «{lastDownloadedFile}» با موفقیت دانلود شد.</span>
          </div>
        )}

        {/* Quick action bar */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onOpenReader}
            className="px-5 py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition flex items-center gap-2 active:scale-95"
          >
            <BookOpen className="w-4 h-4" />
            <span>مشاهده و مطالعه در کتابخوان داخلی</span>
          </button>

          <button
            onClick={handleDownloadAllThreeDocx}
            disabled={downloadingTarget !== null}
            className="px-5 py-2.5 bg-blue-800 hover:bg-blue-900 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {downloadingTarget === 'all-docx' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            <span>دریافت ۳ فایل Word به صورت مستقل</span>
          </button>

          <button
            onClick={handleDownloadAllZip}
            disabled={downloadingTarget !== null}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {downloadingTarget === 'zip' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
            <span>بسته جامع فشرده (.ZIP)</span>
          </button>
        </div>
      </div>

      {/* 3 Standalone Word Documents + EPUB Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Output 1: Full Transcript */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  خروجی ۱: متن کامل و وفادار به گفتار
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  {safeSessionName} ـ متن کامل.docx
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              ثبت جزء به جزء کلمات آموزشی استاد، تفکیک گویندگان («استاد» و «دانشجو»)، برچسب زمانی دقیق
              تک‌تک پاراگراف‌ها، بخش‌های نامفهوم با [نامفهوم] و قالب‌بندی استاندارد با فونت B Nazanin.
            </p>
          </div>
          <button
            onClick={handleDownloadTranscript}
            disabled={downloadingTarget !== null}
            className="w-full py-2.5 px-4 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/70 text-blue-900 text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {downloadingTarget === 'transcript' ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-800" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>دریافت فایل Word متن کامل (.docx)</span>
          </button>
        </div>

        {/* Output 2: Questions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">خروجی ۲: بانک سؤالات جلسه</h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  {safeSessionName} ـ سؤالات.docx
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              گردآوری سؤالات تستی (همراه گزینه‌ها)، تشریحی و پرسش‌های کلاسی به همراه زمان و فایل مبدأ، و ثبت
              دقیق پاسخ‌ها یا عبارت «پاسخ در فایل‌های صوتی این جلسه بیان نشده است».
            </p>
          </div>
          <button
            onClick={handleDownloadQuestions}
            disabled={downloadingTarget !== null}
            className="w-full py-2.5 px-4 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100/70 text-purple-900 text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {downloadingTarget === 'questions' ? (
              <Loader2 className="w-4 h-4 animate-spin text-purple-800" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>دریافت فایل Word سؤالات (.docx)</span>
          </button>
        </div>

        {/* Output 3: Classic Note */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
                <BookMarked className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  خروجی ۳: جزوه کلاسیک و موضوع‌بندی‌شده
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  {safeSessionName} ـ جزوه کلاسیک.docx
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              بازنویسی منظم و یکپارچه محتوای تمام فایل‌های جلسه، سرفصل‌های موضوعی، تعاریف اصطلاحات،
              مثال‌ها، جمع‌بندی و برجسته‌سازی نکات با رنگ‌های گرم (زرشکی، آجری و قهوه‌ای).
            </p>
          </div>
          <button
            onClick={handleDownloadClassicNote}
            disabled={downloadingTarget !== null}
            className="w-full py-2.5 px-4 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/70 text-amber-900 text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {downloadingTarget === 'classic' ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-800" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>دریافت فایل Word جزوه کلاسیک (.docx)</span>
          </button>
        </div>

        {/* Output 4: EPUB eBook */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  کتاب الکترونیک استاندارد (EPUB 3)
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  {safeSessionName} ـ کتاب الکترونیک.epub
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              نسخه کتاب الکترونیک شامل متن کامل، سؤالات و جزوه کلاسیک با پشتیبانی کامل از جهت راست‌به‌چپ (RTL)،
              فهرست پیونددار و قابلیت اجرا در کتابخوان‌های ویندوز و گوشی‌ها.
            </p>
          </div>
          <button
            onClick={handleDownloadEpub}
            disabled={downloadingTarget !== null}
            className="w-full py-2.5 px-4 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 text-emerald-900 text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {downloadingTarget === 'epub' ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-800" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>دریافت کتاب الکترونیک (.epub)</span>
          </button>
        </div>
      </div>

      {/* Formatting & Font Assurance Note */}
      <div className="p-4 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            فایل‌های تولیدشده با کتابخانه استاندارد <strong>docx</strong> ساخته شده و با Microsoft Word، Google Docs و LibreOffice کاملاً سازگار و قابل ویرایش هستند.
          </span>
        </div>
        <span className="text-[11px] text-slate-400 shrink-0">
          راست‌چین · بدون خطوط زیرنویس غلط‌گیر (noProof)
        </span>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
          onClick={onNewJob}
          className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>شروع پردازش جلسه جدید</span>
        </button>

        <span className="text-xs text-slate-400">
          تمام خروجی‌ها در حافظه دستگاه ذخیره شدند و همیشه در بخش «کتابخانه» در دسترس هستند.
        </span>
      </div>
    </div>
  );
};
