import { useEffect, useState } from 'react';
import { set } from 'idb-keyval';
import { loadUploadedFiles, loadSettings, saveSession } from '../utils/storage';
import { prepareLongAudio } from '../utils/longAudio';
import { createGeminiClient, transcribeChunk, synthesizeSession, runBrowserConnectionDiagnostic, generateContentText } from '../services/geminiClient';

export default function LongAudioVerification() {
  const [status, setStatus] = useState('شروع آزمون صوت واقعی…');
  useEffect(() => {
    const controller = new AbortController();
    let lastSaved = 0;
    let lastPhase = '';
    const progress = (phase: string, details: Record<string, unknown> = {}) => {
      document.title = `SJ30:${phase}`;
      if (lastPhase !== phase || Date.now() - lastSaved > 1000 || ['success', 'failed'].includes(phase)) {
        lastPhase = phase;
        lastSaved = Date.now();
        void set('smart_jozveh_probe30_report_v1', JSON.stringify({ phase, time: new Date().toISOString(), ...details }));
      }
    };
    async function run() {
      try {
        const files = await loadUploadedFiles();
        const file = files.find(item => item.file);
        if (!file?.file) throw new Error('فایل صوتی ذخیره‌شده‌ای در این مرورگر موجود نیست.');
        const settings = await loadSettings();
        const client = await createGeminiClient(settings, controller.signal);
        if (new URLSearchParams(location.search).get('networkCheck') === '1') {
          const results: Array<Record<string, unknown>> = [];
          const check = async (name: string, request: () => Promise<unknown>) => {
            progress(`network-${name}`, { results });
            setStatus(`آزمون اتصال: ${name}`);
            const start = Date.now();
            try { const result = await request(); results.push({ name, durationMs: Date.now() - start, result }); }
            catch (error: any) { results.push({ name, durationMs: Date.now() - start, error: error.message }); }
          };
          await check('unary', async () => {
            const response = await runBrowserConnectionDiagnostic(settings, controller.signal);
            return { ok: response.ok, status: response.status, raw: response.raw };
          });
          await check('stream', () => generateContentText(client, {
            contents: [{ parts: [{ text: 'Reply with hello only.' }] }], generationConfig: { maxOutputTokens: 1024 },
          }, controller.signal, 30_000));
          const prepared = await prepareLongAudio(file.file, file.id, controller.signal, setStatus, true);
          // Our encoder produces MPEG-2 Layer III, 16 kHz / 24 kbps, 108-byte frames.
          // Cut at a complete frame boundary: 278 frames are 10.008 seconds.
          const short = prepared[0].audioBlob!.slice(0, 108 * 278, 'audio/mpeg');
          await check('audio10', async () => {
            const data = await short.arrayBuffer();
            let binary = ''; for (const b of new Uint8Array(data)) binary += String.fromCharCode(b);
            return generateContentText(client, {
              contents: [{ parts: [{ inlineData: { mimeType: 'audio/mpeg', data: btoa(binary) } }, { text: 'Write what you hear in this audio.' }] }],
              generationConfig: { maxOutputTokens: 2048 },
            }, controller.signal, 60_000);
          });
          progress('network-complete', { results });
          setStatus(JSON.stringify(results, null, 2));
          return;
        }
        progress('preparing');
        const chunks = await prepareLongAudio(file.file, file.id, controller.signal, text => {
          setStatus(text); progress('encoding');
        }, true);
        const audio = chunks[0];
        if (audio.durationSeconds < 1799) throw new Error('فایل اول کمتر از ۳۰ دقیقه است؛ آزمون نیم‌ساعته قابل انجام نیست.');
        progress('sending', { bytes: audio.audioBlob!.size, seconds: audio.durationSeconds });
        const result = await transcribeChunk(client, {
          audioBlob: audio.audioBlob!, longAudio: true, progressKey: `verify30:${file.id}:${file.size}:${file.file.lastModified}`,
          sessionTitle: file.sessionName, partTitle: file.partName, fileName: file.name,
          chunkIndex: 0, totalChunks: 1, timeOffsetSeconds: 0, customPrompt: '',
          onStatus: text => { setStatus(text); progress('receiving', { bytes: audio.audioBlob!.size }); },
        }, controller.signal);
        const lastSecond = Math.max(...result.paragraphs.map((p: any) => p.originalEndSec));
        await set('smart_jozveh_probe30_transcript_v1', result);
        if (lastSecond < 1500) throw new Error('متن دریافت شد اما پوشش زمانی کمتر از ۲۵ دقیقه است؛ خروجی کامل اعلام نمی‌شود.');
        progress('notes', { paragraphs: result.paragraphs.length, lastSecond });
        setStatus('متن صوت دریافت و ذخیره شد؛ در حال ساخت جزوه…');
        const note = await synthesizeSession(client, {
          sessionTitle: file.sessionName, courseTitle: '', instructorName: '', sessionNumber: String(file.sessionNumber),
          date: new Date().toLocaleDateString('fa-IR'), allParagraphs: result.paragraphs,
        }, controller.signal);
        await saveSession({ id: `verified30:${file.id}`, sessionTitle: `${file.sessionName} — ۳۰ دقیقه اول`,
          sessionNumber: file.sessionNumber, courseTitle: '', instructorName: '', date: new Date().toLocaleDateString('fa-IR'),
          parts: [{ partNumber: file.partNumber, partName: file.partName, files: [file] }],
          transcriptParagraphs: result.paragraphs, questions: result.questions, classicNote: note, createdAt: new Date().toISOString() });
        progress('success', { seconds: audio.durationSeconds, bytes: audio.audioBlob!.size, paragraphs: result.paragraphs.length, lastSecond, sections: note.sections.length });
        setStatus('پردازش ۳۰ دقیقه صوت انجام شد؛ متن، سوالات و جزوه در کتابخانه ذخیره شدند.');
      } catch (error: any) {
        if (controller.signal.aborted) return;
        const message = error?.message || String(error);
        progress('failed', { error: message });
        setStatus(message);
      }
    }
    void run();
    return () => controller.abort();
  }, []);
  return <main dir="rtl" className="p-8 text-right"><h1 className="text-xl font-bold">آزمون واقعی نیم‌ساعت صوت</h1>
    <p role="status" className="my-6 whitespace-pre-wrap">{status}</p>
    <a href="./">بازگشت به برنامه و کتابخانه</a></main>;
}
