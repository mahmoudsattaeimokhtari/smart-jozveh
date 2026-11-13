import type { AppSettings, TranscriptParagraph, ClassicNote } from '../types';
import { MAX_INLINE_AUDIO_BYTES, sliceAudioFile } from '../utils/audioChunker';
import { get, set } from 'idb-keyval';
import { LONG_AUDIO_MAX_BYTES } from '../utils/longAudio';
import { readGeminiStream } from './geminiStream';

export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com';
export const GEMINI_API_VERSION = 'v1beta';
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const GEMINI_GENERATE_ENDPOINT = `${GEMINI_API_BASE_URL}/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent`;
export const GEMINI_AUDIO_TIMEOUT_MS = 1_200_000;
export const GEMINI_TEXT_TIMEOUT_MS = 600_000;
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
  let rejectCancelled: ((reason?: unknown) => void) | undefined;
  const cancelled = new Promise<never>((_, reject) => { rejectCancelled = reject; });
  const forwardAbort = () => {
    controller.abort(parentSignal?.reason);
    rejectCancelled?.(parentSignal?.reason || new DOMException('Aborted', 'AbortError'));
  };
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
    return await Promise.race([request(controller.signal), timeoutPromise, cancelled]);
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
  if (blob.size > LONG_AUDIO_MAX_BYTES) {
    throw new Error('حجم صوت فشرده از سقف امن ارسال مستقیم بیشتر است.');
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

export async function generateContentText(
  client: BrowserGeminiClient,
  body: Record<string, unknown>,
  parentSignal: AbortSignal,
  timeoutMs = GEMINI_TEXT_TIMEOUT_MS,
  onProgress?: (length: number) => void,
): Promise<string> {
  const serialized = JSON.stringify(body);
  if (new Blob([serialized]).size > 19 * 1024 * 1024) throw new Error('حجم کل درخواست از سقف امن ۱۹ مگابایت بیشتر است.');
  return withGeminiTimeout(parentSignal, async requestSignal => {
    const response = await withGeminiTimeout(requestSignal, headerSignal => fetch(GEMINI_GENERATE_ENDPOINT.replace(':generateContent', ':streamGenerateContent?alt=sse'), {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': client.apiKey },
      body: serialized, signal: headerSignal,
    }), 180_000);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${redactSecrets(await response.text(), client.apiKey)}`);
    return readGeminiStream(response, requestSignal, onProgress);
  }, timeoutMs);
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
  progressKey?: string;
  onStatus?: (message: string) => void;
  longAudio?: boolean;
}
async function transcribeSingle(ai: BrowserGeminiClient, input: TranscribeInput, signal: AbortSignal) {
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
        maxOutputTokens: input.longAudio ? 65536 : 8192,
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
    }, signal, GEMINI_AUDIO_TIMEOUT_MS, length => input.onStatus?.(`دریافت متن از Gemini: ${length.toLocaleString('fa-IR')} نویسه؛ ارتباط در حال دریافت داده است.`));

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

type ChunkResult = Awaited<ReturnType<typeof transcribeSingle>>;
interface SmallPartRecovery {
  parts: Array<{ blob: Blob; offset: number }>;
  results: ChunkResult[];
}

export async function transcribeChunk(ai: BrowserGeminiClient, input: TranscribeInput, signal: AbortSignal): Promise<ChunkResult> {
  if (input.longAudio) {
    const resultKey = input.progressKey ? `smart_jozveh_long_result_v1:${input.progressKey}` : undefined;
    const saved = resultKey ? await get<ChunkResult>(resultKey) : undefined;
    if (saved) return saved;
    const result = await transcribeSingle(ai, input, signal);
    if (resultKey) await set(resultKey, result);
    return result;
  }
  const key = input.progressKey ? `smart_jozveh_small_parts_v1:${input.progressKey}` : undefined;
  let recovery = key ? await get<SmallPartRecovery>(key) : undefined;
  if (!recovery) {
    input.onStatus?.('در حال ارسال قطعه صوتی؛ سقف انتظار هر درخواست ۱۲۰ ثانیه است.');
    try { return await transcribeSingle(ai, input, signal); }
    catch (error: any) {
      signal.throwIfAborted();
      if (!/NetworkError|fetch|مهلت|timeout|MAX_TOKENS/i.test(error?.message || '')) throw error;
      input.onStatus?.('ارسال قطعه کامل نشد؛ در حال تقسیم همان قطعه به بخش‌های ۳۰ ثانیه‌ای…');
      // Re-decode compressed containers; never cut MP3/MP4 by arbitrary byte offsets.
      const parts = await sliceAudioFile(new File([input.audioBlob], 'retry-audio', {
        type: input.audioBlob.type,
      }), 'retry', 0.5);
      if (parts.length < 2) throw error;
      recovery = { parts: parts.map(part => ({ blob: part.audioBlob!, offset: part.timeOffsetSeconds })), results: [] };
      if (key) await set(key, recovery);
    }
  }
  for (let i = recovery.results.length; i < recovery.parts.length; i++) {
    signal.throwIfAborted();
    input.onStatus?.(`ارسال بخش کوچک ${i + 1} از ${recovery.parts.length}؛ ${recovery.results.length} بخش ذخیره شده است.`);
    const part = recovery.parts[i];
    const result = await transcribeSingle(ai, {
      ...input, audioBlob: part.blob,
      timeOffsetSeconds: input.timeOffsetSeconds + part.offset,
    }, signal);
    recovery.results.push(result);
    if (key) await set(key, recovery);
  }
  return {
    success: true, chunkIndex: input.chunkIndex,
    paragraphs: recovery.results.flatMap(result => result.paragraphs),
    questions: recovery.results.flatMap(result => result.questions),
    summaryPoints: recovery.results.flatMap(result => result.summaryPoints),
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
