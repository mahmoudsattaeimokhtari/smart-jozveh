import type { AppSettings, TranscriptParagraph, ClassicNote } from '../types';
import { MAX_INLINE_AUDIO_BYTES } from '../utils/audioChunker';

export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com';
export const GEMINI_API_VERSION = 'v1beta';
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const GEMINI_GENERATE_ENDPOINT = `${GEMINI_API_BASE_URL}/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent`;
export const GEMINI_AUDIO_TIMEOUT_MS = 120_000;
export const GEMINI_TEXT_TIMEOUT_MS = 180_000;
export const GEMINI_DIAGNOSTIC_TIMEOUT_MS = 30_000;

const SchemaType = {
  OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING', NUMBER: 'NUMBER', BOOLEAN: 'BOOLEAN',
} as const;

interface BrowserGeminiClient { apiKey: string }

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
  return { apiKey } satisfies BrowserGeminiClient;
}

async function withGeminiTimeout<T>(
  parentSignal: AbortSignal | undefined,
  request: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  parentSignal?.throwIfAborted();
  const controller = new AbortController();
  let timedOut = false;
  const forwardAbort = () => controller.abort(parentSignal?.reason);
  parentSignal?.addEventListener('abort', forwardAbort, { once: true });
  let rejectTimeout: ((reason?: unknown) => void) | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => { rejectTimeout = reject; });
  const timer = window.setTimeout(() => {
    timedOut = true;
    const timeoutError = new Error(`مهلت ${Math.round(timeoutMs / 1000)} ثانیه‌ای درخواست Gemini تمام شد؛ اتصال را بررسی و دوباره تلاش کنید.`);
    controller.abort(timeoutError);
    rejectTimeout?.(timeoutError);
  }, timeoutMs);
  try {
    return await Promise.race([request(controller.signal), timeoutPromise]);
  } catch (error) {
    if (timedOut) throw new Error(`مهلت ${Math.round(timeoutMs / 1000)} ثانیه‌ای درخواست Gemini تمام شد؛ اتصال را بررسی و دوباره تلاش کنید.`);
    throw error;
  } finally {
    window.clearTimeout(timer);
    parentSignal?.removeEventListener('abort', forwardAbort);
  }
}

async function blobToBase64(blob: Blob, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  if (blob.size > MAX_INLINE_AUDIO_BYTES) {
    throw new Error(`حجم قطعه صوتی ${Math.ceil(blob.size / 1024 / 1024)} مگابایت است و از سقف ۳ مگابایت ارسال مستقیم بیشتر است.`);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => reader.abort();
    signal.addEventListener('abort', abort, { once: true });
    reader.onerror = () => { signal.removeEventListener('abort', abort); reject(reader.error || new Error('خواندن قطعه صوتی ناموفق بود.')); };
    reader.onabort = () => { signal.removeEventListener('abort', abort); reject(signal.reason || new DOMException('Aborted', 'AbortError')); };
    reader.onload = () => {
      signal.removeEventListener('abort', abort);
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      if (comma < 0) reject(new Error('تبدیل قطعه صوتی به Base64 ناموفق بود.'));
      else resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

async function generateContentText(
  client: BrowserGeminiClient,
  body: Record<string, unknown>,
  parentSignal: AbortSignal,
  timeoutMs = GEMINI_TEXT_TIMEOUT_MS,
): Promise<string> {
  const { response, raw } = await withGeminiTimeout(parentSignal, async requestSignal => {
    const response = await fetch(GEMINI_GENERATE_ENDPOINT, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': client.apiKey },
      body: JSON.stringify(body),
      signal: requestSignal,
    });
    return { response, raw: await response.text() };
  }, timeoutMs);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${redactSecrets(raw, client.apiKey)}`);
  }
  let payload: any;
  try { payload = JSON.parse(raw); }
  catch { throw new Error('پاسخ Gemini JSON معتبر نبود.'); }
  const text = (payload.candidates || [])
    .flatMap((candidate: any) => candidate?.content?.parts || [])
    .map((part: any) => typeof part?.text === 'string' ? part.text : '')
    .join('');
  if (!text) throw new Error('Gemini پاسخ متنی قابل استفاده برنگرداند.');
  return text;
}

export async function runBrowserConnectionDiagnostic(
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<ConnectionDiagnosticResult> {
  const startedAt = performance.now();
  const apiKey = await resolveGeminiApiKey(settings, signal);
  try {
    const { response, responseText } = await withGeminiTimeout(signal, async requestSignal => {
      const response = await fetch(GEMINI_GENERATE_ENDPOINT, {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
          generationConfig: { maxOutputTokens: 16, temperature: 0 },
        }),
        signal: requestSignal,
      });
      return { response, responseText: await response.text() };
    }, GEMINI_DIAGNOSTIC_TIMEOUT_MS);
    const raw = redactSecrets(responseText, apiKey);
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
export async function transcribeChunk(ai: BrowserGeminiClient, input: TranscribeInput, signal: AbortSignal) {
  const { audioBlob, sessionTitle, partTitle, fileName, chunkIndex, totalChunks, timeOffsetSeconds, customPrompt } = input;
  const cleanMime = audioBlob.type.split(';')[0] || 'audio/mpeg';
  signal.throwIfAborted();
  const base64Audio = await blobToBase64(audioBlob, signal);
    const systemInstruction = `شما یک متخصص زبده پیاده‌سازی متون آموزشی دانشگاهی به زبان فارسی هستید.
وظیفه شما استخراج سه بخش از این قطعه صوتی است:
۱. متن وفادار کلمه به کلمه با تفکیک گویندگان («استاد» یا «دانشجو») و زمان‌بندی دقیق هر پاراگراف.
۲. سؤالات مطرح‌شده در صوت (تستی با گزینه‌ها، تشریحی، شفاهی) و قید این که آیا پاسخ در صوت بیان شده یا خیر.
۳. نکات کلیدی، تعاریف و اصطلاحات برای جزوه کلاسیک.
زمان startSec و endSec و timeSec باید نسبت به شروع همین قطعه باشند؛ آفست را خودتان اضافه نکنید.
قوانین: بخش‌های نامفهوم را با [نامفهوم] مشخص کنید. واژگان تخصصی انگلیسی را با املای انگلیسی حفظ کنید.`;

    const userPromptText = `جلسه: ${sessionTitle} | قسمت: ${partTitle} | فایل: ${fileName} | قطعه ${chunkIndex + 1} از ${totalChunks} | آفست: ${formatTime(timeOffsetSeconds)}\nدستورات: ${customPrompt || 'پیاده‌سازی دقیق و کامل'}`;

    const responseText = await generateContentText(ai, {
      contents: [{ role: 'user', parts: [
        { inlineData: { data: base64Audio, mimeType: cleanMime } },
        { text: userPromptText },
      ] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            paragraphs: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  speaker: { type: SchemaType.STRING },
                  text: { type: SchemaType.STRING },
                  startSec: { type: SchemaType.NUMBER },
                  endSec: { type: SchemaType.NUMBER },
                  isUnclear: { type: SchemaType.BOOLEAN },
                },
                required: ['speaker', 'text', 'startSec', 'endSec'],
              },
            },
            questions: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  type: { type: SchemaType.STRING },
                  topic: { type: SchemaType.STRING },
                  questionText: { type: SchemaType.STRING },
                  options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                  answer: { type: SchemaType.STRING },
                  isAnswerStated: { type: SchemaType.BOOLEAN },
                  isComplete: { type: SchemaType.BOOLEAN },
                  asker: { type: SchemaType.STRING },
                  timeSec: { type: SchemaType.NUMBER },
                },
                required: ['type', 'questionText', 'isAnswerStated'],
              },
            },
            summaryPoints: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          },
          required: ['paragraphs', 'questions'],
        },
      },
    }, signal, GEMINI_AUDIO_TIMEOUT_MS);

    const parsedData = JSON.parse(responseText || '{}');
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
}

interface SynthesisInput {
  sessionTitle: string; courseTitle: string; instructorName: string;
  sessionNumber: string; date: string; allParagraphs: TranscriptParagraph[];
}
export async function synthesizeSession(ai: BrowserGeminiClient, input: SynthesisInput, signal: AbortSignal): Promise<ClassicNote> {
  const { sessionTitle, courseTitle, instructorName, sessionNumber, date, allParagraphs } = input;
    const fullTranscriptText = allParagraphs.map((p: any) => `${p.speaker}: ${p.text}`).join('\n\n');

    const prompt = `بر اساس متن پیاده‌سازی شده کامل این جلسه، یک جزوه کلاسیک و دانشگاهی منظم به زبان فارسی بنویس.\nدرس: ${courseTitle} | استاد: ${instructorName} | جلسه: ${sessionNumber} - ${sessionTitle} | تاریخ: ${date}\nمتن:\n${fullTranscriptText}`;

    const responseText = await generateContentText(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            courseTitle: { type: SchemaType.STRING },
            instructor: { type: SchemaType.STRING },
            introduction: { type: SchemaType.STRING },
            sections: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  heading: { type: SchemaType.STRING },
                  subheading: { type: SchemaType.STRING },
                  content: { type: SchemaType.STRING },
                  keyDefinitions: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: { term: { type: SchemaType.STRING }, definition: { type: SchemaType.STRING } },
                      required: ['term', 'definition'],
                    },
                  },
                  teacherEmphasisPoints: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                  examples: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                },
                required: ['heading', 'content'],
              },
            },
            conclusion: { type: SchemaType.STRING },
            keyTermsList: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          },
          required: ['title', 'sections', 'conclusion'],
        },
      },
    }, signal);

  const note = JSON.parse(responseText || '{}');
  if (!Array.isArray(note.sections) || !note.sections.length || !note.title) throw new Error('جزوه معتبر از مدل دریافت نشد.');
  return note;
}
