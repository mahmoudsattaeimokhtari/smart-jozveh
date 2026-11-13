import { GoogleGenAI, Type } from '@google/genai';
import type { AppSettings, TranscriptParagraph, ClassicNote } from '../types';

export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com';
export const GEMINI_API_VERSION = 'v1beta';
export const GEMINI_MODEL = 'gemini-3.8-flash';
export const GEMINI_GENERATE_ENDPOINT = `${GEMINI_API_BASE_URL}/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent`;

export interface ConnectionDiagnosticResult {
  route: 'browser-direct' | 'server-auto-proxy';
  endpoint: string;
  apiVersion: string;
  model: string;
  ok: boolean;
  status: number | null;
  durationMs: number;
  raw: string;
  attempts?: Array<{
    route: string;
    proxy: string | null;
    ok: boolean;
    status: number | null;
    durationMs: number;
    raw: string;
  }>;
}

function redactSecrets(value: string, apiKey?: string): string {
  let safe = value;
  if (apiKey) safe = safe.split(apiKey).join('[REDACTED_API_KEY]');
  return safe.replace(/(?:AIza[\w-]{20,}|AQ\.[\w.-]{20,})/g, '[REDACTED_API_KEY]');
}

async function resolveGeminiApiKey(settings: AppSettings, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  const apiKey = settings.userGeminiApiKey?.trim();
  if (!apiKey || !/^(?:AIza[\w-]{35}|AQ\.[\w.-]{20,})$/.test(apiKey)) {
    throw new Error('ابتدا کلید شخصی Gemini API را در بالای صفحه وارد و ذخیره کنید.');
  }
  return apiKey;
}

// Credentials stay in memory; all Google requests originate in this browser.
export async function createGeminiClient(settings: AppSettings, signal?: AbortSignal) {
  const apiKey = await resolveGeminiApiKey(settings, signal);
  return new GoogleGenAI({
    apiKey,
    httpOptions: { apiVersion: GEMINI_API_VERSION, timeout: 600000 },
  });
}

export async function runBrowserConnectionDiagnostic(
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<ConnectionDiagnosticResult> {
  const startedAt = performance.now();
  const apiKey = await resolveGeminiApiKey(settings, signal);
  try {
    const response = await fetch(GEMINI_GENERATE_ENDPOINT, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
        generationConfig: { maxOutputTokens: 16, temperature: 0 },
      }),
      signal,
    });
    const raw = redactSecrets(await response.text(), apiKey);
    return {
      route: 'browser-direct', endpoint: GEMINI_GENERATE_ENDPOINT,
      apiVersion: GEMINI_API_VERSION, model: GEMINI_MODEL,
      ok: response.ok, status: response.status,
      durationMs: Math.round(performance.now() - startedAt), raw,
    };
  } catch (error: any) {
    const cause = error?.cause ? `\nCause: ${error.cause.message || String(error.cause)}` : '';
    return {
      route: 'browser-direct', endpoint: GEMINI_GENERATE_ENDPOINT,
      apiVersion: GEMINI_API_VERSION, model: GEMINI_MODEL,
      ok: false, status: null,
      durationMs: Math.round(performance.now() - startedAt),
      raw: redactSecrets(`${error?.name || 'Error'}: ${error?.message || String(error)}${cause}`, apiKey),
    };
  }
}

function formatTime(seconds: number) {
  const n = Math.max(0, Math.floor(seconds));
  return [Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60]
    .map(v => String(v).padStart(2, '0')).join(':');
}

export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

interface TranscribeInput {
  audioBlob: Blob; sessionTitle: string; partTitle: string; fileName: string;
  chunkIndex: number; totalChunks: number; timeOffsetSeconds: number; customPrompt: string;
}
export async function transcribeChunk(ai: GoogleGenAI, input: TranscribeInput, signal: AbortSignal) {
  const { audioBlob, sessionTitle, partTitle, fileName, chunkIndex, totalChunks, timeOffsetSeconds, customPrompt } = input;
  const cleanMime = audioBlob.type.split(';')[0] || 'audio/mpeg';
  let uploadedFileName: string | undefined;
  try {
    signal.throwIfAborted();
    const uploadResult = await ai.files.upload({ file: audioBlob,
      config: { mimeType: cleanMime, displayName: `${fileName}_part_${chunkIndex + 1}`, abortSignal: signal },
    });
    uploadedFileName = uploadResult.name;
    if (!uploadedFileName) throw new Error('شناسه فایل آپلودشده دریافت نشد.');
    let activeFile = uploadResult;
    const deadline = Date.now() + 10 * 60 * 1000;
    while (activeFile.state !== 'ACTIVE') {
      signal.throwIfAborted();
      if (activeFile.state === 'FAILED') throw new Error('پردازش فایل در گوگل ناموفق بود.');
      if (Date.now() >= deadline) throw new Error('مهلت آماده‌سازی فایل صوتی تمام شد.');
      await wait(2000, signal);
      activeFile = await ai.files.get({ name: uploadedFileName, config: { abortSignal: signal } });
    }
    if (!activeFile.uri) throw new Error('آدرس فایل آماده دریافت نشد.');
    uploadResult.uri = activeFile.uri;
    const systemInstruction = `شما یک متخصص زبده پیاده‌سازی متون آموزشی دانشگاهی به زبان فارسی هستید.
وظیفه شما استخراج سه بخش از این قطعه صوتی است:
۱. متن وفادار کلمه به کلمه با تفکیک گویندگان («استاد» یا «دانشجو») و زمان‌بندی دقیق هر پاراگراف.
۲. سؤالات مطرح‌شده در صوت (تستی با گزینه‌ها، تشریحی، شفاهی) و قید این که آیا پاسخ در صوت بیان شده یا خیر.
۳. نکات کلیدی، تعاریف و اصطلاحات برای جزوه کلاسیک.
زمان startSec و endSec و timeSec باید نسبت به شروع همین قطعه باشند؛ آفست را خودتان اضافه نکنید.
قوانین: بخش‌های نامفهوم را با [نامفهوم] مشخص کنید. واژگان تخصصی انگلیسی را با املای انگلیسی حفظ کنید.`;

    const userPromptText = `جلسه: ${sessionTitle} | قسمت: ${partTitle} | فایل: ${fileName} | قطعه ${chunkIndex + 1} از ${totalChunks} | آفست: ${formatTime(timeOffsetSeconds)}\nدستورات: ${customPrompt || 'پیاده‌سازی دقیق و کامل'}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        { fileData: { fileUri: uploadResult.uri, mimeType: cleanMime } },
        { text: userPromptText },
      ],
      config: {
        abortSignal: signal,
        maxOutputTokens: 65536,
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            paragraphs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: { type: Type.STRING },
                  text: { type: Type.STRING },
                  startSec: { type: Type.NUMBER },
                  endSec: { type: Type.NUMBER },
                  isUnclear: { type: Type.BOOLEAN },
                },
                required: ['speaker', 'text', 'startSec', 'endSec'],
              },
            },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  questionText: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  answer: { type: Type.STRING },
                  isAnswerStated: { type: Type.BOOLEAN },
                  isComplete: { type: Type.BOOLEAN },
                  asker: { type: Type.STRING },
                  timeSec: { type: Type.NUMBER },
                },
                required: ['type', 'questionText', 'isAnswerStated'],
              },
            },
            summaryPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['paragraphs', 'questions'],
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    if (!Array.isArray(parsedData.paragraphs) || !parsedData.paragraphs.length || !Array.isArray(parsedData.questions)) throw new Error('پاسخ مدل فاقد متن معتبر است.');
    if (parsedData.paragraphs.some((p: any) => typeof p.text !== 'string' || !Number.isFinite(p.startSec) || !Number.isFinite(p.endSec) || p.startSec < 0 || p.endSec < p.startSec)) throw new Error('زمان‌بندی متن دریافتی معتبر نیست.');
    const offset = Number(timeOffsetSeconds) || 0;

    return {
      success: true,
      chunkIndex,
      paragraphs: (parsedData.paragraphs || []).map((p: any) => ({
        ...p,
        partTitle, fileName,
        originalStartSec: p.startSec + offset,
        originalEndSec: p.endSec + offset,
        formattedTimeTag: `[${partTitle} | ${fileName} | ${formatTime(p.startSec + offset)} تا ${formatTime(p.endSec + offset)}]`,
      })),
      questions: (parsedData.questions || []).map((q: any) => ({
        ...q,
        id: crypto.randomUUID(), number: 0,
        topic: q.topic || "", answer: q.isAnswerStated ? (q.answer || "") : "",
        isComplete: q.isComplete ?? true, asker: q.asker || "استاد",
        timeSec: (q.timeSec || 0) + offset,
        originalTimeSec: (q.timeSec || 0) + offset,
        partTitle,
        fileName,
        formattedTime: formatTime((q.timeSec || 0) + offset),
      })),
      summaryPoints: parsedData.summaryPoints || [],
    };
  } finally {
    if (uploadedFileName) await ai.files.delete({ name: uploadedFileName,
      config: { httpOptions: { timeout: 15000 } } }).catch(() => {});
  }
}

interface SynthesisInput {
  sessionTitle: string; courseTitle: string; instructorName: string;
  sessionNumber: string; date: string; allParagraphs: TranscriptParagraph[];
}
export async function synthesizeSession(ai: GoogleGenAI, input: SynthesisInput, signal: AbortSignal): Promise<ClassicNote> {
  const { sessionTitle, courseTitle, instructorName, sessionNumber, date, allParagraphs } = input;
    const fullTranscriptText = allParagraphs.map((p: any) => `${p.speaker}: ${p.text}`).join('\n\n');

    const prompt = `بر اساس متن پیاده‌سازی شده کامل این جلسه، یک جزوه کلاسیک و دانشگاهی منظم به زبان فارسی بنویس.\nدرس: ${courseTitle} | استاد: ${instructorName} | جلسه: ${sessionNumber} - ${sessionTitle} | تاریخ: ${date}\nمتن:\n${fullTranscriptText}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        abortSignal: signal,
        maxOutputTokens: 65536,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            courseTitle: { type: Type.STRING },
            instructor: { type: Type.STRING },
            introduction: { type: Type.STRING },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  heading: { type: Type.STRING },
                  subheading: { type: Type.STRING },
                  content: { type: Type.STRING },
                  keyDefinitions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: { term: { type: Type.STRING }, definition: { type: Type.STRING } },
                      required: ['term', 'definition'],
                    },
                  },
                  teacherEmphasisPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                  examples: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['heading', 'content'],
              },
            },
            conclusion: { type: Type.STRING },
            keyTermsList: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['title', 'sections', 'conclusion'],
        },
      },
    });

  const note = JSON.parse(response.text || '{}');
  if (!Array.isArray(note.sections) || !note.sections.length || !note.title) throw new Error('جزوه معتبر از مدل دریافت نشد.');
  return note;
}
