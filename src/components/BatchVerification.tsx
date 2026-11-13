import { useEffect, useState } from 'react';
import { set } from 'idb-keyval';
import type { BatchSession } from '../types/batch';
import { ingestTextFiles, sessionGroups } from '../utils/textIngestion';
import { analyzeTextSession } from '../services/batchTextClient';
import { createBatchDocuments, saveDownload } from '../utils/batchDocuments';
import { buildNotebookPdf } from '../utils/batchPdf';

// Explicit diagnostic route. Fixtures are synthetic and never replace the user's batch.
export default function BatchVerification() {
  const [message, setMessage] = useState('آزمون پنج جلسه آموزشی نمونه؛ داده واقعی کاربر تغییر نمی‌کند.');
  const [pdf, setPdf] = useState<Blob>();
  useEffect(() => {
    const controller = new AbortController();
    const report = async (phase: string, details: Record<string, unknown> = {}) => {
      document.title = `SJBATCH:${phase}`;
      await set('smart_jozveh_batch_verification_v1', JSON.stringify({ phase, time: new Date().toISOString(), ...details }));
    };
    async function run() {
      const completed: BatchSession[] = [];
      try {
        const files = [5, 2, 4, 1, 3].map(n => new File([
          `# جلسه ${n}\n[00:00:00] استاد: موضوع این جلسه تعریف سلول است.\n[00:01:00] سلول واحد ساختاری بدن است. غشا مرز سلول است و ورود و خروج مواد را تنظیم می‌کند.\n[00:02:00] سؤال استاد: سلول چیست؟\n[00:02:10] پاسخ استاد: سلول واحد ساختاری بدن است.\n[00:03:00] هسته محل نگهداری اطلاعات ژنتیکی است. میتوکندری در تولید انرژی نقش دارد.\n[00:04:00] اصطلاح انگلیسی غشا membrane و اصطلاح هسته nucleus است.\n[00:05:00] نکته امتحانی: نقش غشا را از نقش هسته و میتوکندری تفکیک کنید.`,
        ], `Session_${String(n).padStart(2, '0')}_Transcript.md`));
        const imported = await ingestTextFiles(files);
        if (imported.errors.length || imported.sessions.length !== 5) throw new Error('ورود و مرتب‌سازی پنج جلسه آزمایشی ناموفق بود.');
        for (const original of imported.sessions) {
          await report('generating', { completed: completed.length, session: original.number });
          const analysis = await analyzeTextSession(original, controller.signal, setMessage);
          const session = { ...original, analysis, status: 'done' as const };
          const documents = await createBatchDocuments(session);
          completed.push({ ...session, documents });
          await set('smart_jozveh_batch_verification_outputs_v1', completed);
        }
        const groups = sessionGroups(completed);
        if (groups.length !== 1 || !groups[0].complete) throw new Error('گروه کامل پنج‌جلسه‌ای تشخیص داده نشد.');
        await report('pdf', { completed: completed.length });
        setMessage('در حال ساخت PDF پنج جلسه با فونت فارسی…');
        const result = await buildNotebookPdf(completed);
        await set('smart_jozveh_batch_verification_pdf_v1', result);
        setPdf(result);
        await report('success', { completed: completed.length, docx: completed.length * 3, pdfBytes: result.size,
          classroomQuestions: completed.reduce((n, s) => n + s.analysis!.classroomQuestions.length, 0),
          practiceQuestions: completed.reduce((n, s) => n + s.analysis!.practiceQuestions.length, 0) });
        setMessage('آزمون واقعی موفق: پنج پاسخ معتبر Gemini، پانزده Word و یک PDF پنج‌جلسه‌ای ساخته و در حافظه آزمون ذخیره شدند.');
      } catch (error: any) {
        if (controller.signal.aborted) return;
        await report('failed', { completed: completed.length, error: error.message });
        setMessage(error.message);
      }
    }
    void run();
    return () => controller.abort();
  }, []);
  return <main dir="rtl" className="p-8"><h1 className="text-xl font-bold">آزمون کامل پردازش دسته‌ای متن</h1>
    <p role="status" className="my-6 whitespace-pre-wrap">{message}</p>
    {pdf && <button className="batch-button" onClick={() => saveDownload(pdf, 'NotebookLM_Five_Test_Sessions.pdf')}>دانلود PDF آزمون</button>}
    <a className="block mt-4 underline" href="./">بازگشت به برنامه</a></main>;
}
