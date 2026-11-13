import type { BatchSession, TextParagraph, TextSource } from '../types/batch';

export const asciiDigits = (text: string) => text.replace(/[۰-۹٠-٩]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.includes(c) ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(c) : '٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
export const persianDigits = (text: string) => text.replace(/[0-9٠-٩]/g, c => '۰۱۲۳۴۵۶۷۸۹'[Number(asciiDigits(c))]);

const ordinals: Record<string, number> = {
  'اول': 1, 'یک': 1, 'دوم': 2, 'دو': 2, 'سوم': 3, 'سه': 3, 'چهارم': 4, 'چهار': 4,
  'پنجم': 5, 'پنج': 5, 'ششم': 6, 'شش': 6, 'هفتم': 7, 'هفت': 7, 'هشتم': 8, 'هشت': 8,
  'نهم': 9, 'نه': 9, 'دهم': 10, 'ده': 10, 'یازدهم': 11, 'دوازدهم': 12, 'سیزدهم': 13,
  'چهاردهم': 14, 'پانزدهم': 15, 'شانزدهم': 16, 'هفدهم': 17, 'هجدهم': 18, 'نوزدهم': 19,
  'بیستم': 20, 'بیست و یکم': 21, 'بیست و دوم': 22, 'بیست و سوم': 23, 'بیست و چهارم': 24,
  'بیست و پنجم': 25, 'بیست و ششم': 26, 'بیست و هفتم': 27, 'بیست و هشتم': 28, 'بیست و نهم': 29, 'سی ام': 30,
};
export function detectSessionNumber(name: string, header: string): number | undefined {
  for (const value of [name.split('/').pop() || name, header.slice(0, 2000)]) {
    const clean = asciiDigits(value).replace(/\u200c/g, ' ');
    const numeric = clean.match(/(?:session|جلسه|نشست)[\s_#:\-]*(\d+)/i);
    if (numeric && Number(numeric[1]) > 0 && Number(numeric[1]) <= 100000) return Number(numeric[1]);
    const written = clean.match(/(?:جلسه|نشست)\s+([^\n:#]+)/);
    if (written) {
      for (const [word, number] of Object.entries(ordinals).sort((a, b) => b[0].length - a[0].length)) {
        if (written[1].trim().startsWith(word) && !/[\u0600-\u06ff]/.test(written[1].trim()[word.length] || '')) return number;
      }
    }
    const bare = clean.match(/^(\d{1,4})[_. -]/);
    if (bare && Number(bare[1]) > 0) return Number(bare[1]);
  }
}

export function findTimestamp(text: string): string | undefined {
  const match = asciiDigits(text).match(/\[(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?\]/);
  if (!match || Number(match[2]) > 59 || Number(match[3]) > 59) return;
  return `[${match[1].padStart(2, '0')}:${match[2]}:${match[3]}]`;
}
const timeTag = (seconds: number) => `[${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${(Math.floor(seconds / 60) % 60).toString().padStart(2, '0')}:${(Math.floor(seconds) % 60).toString().padStart(2, '0')}]`;

export function parseTranscript(name: string, content: string): { number: number; title: string; source: TextSource; paragraphs: TextParagraph[] } {
  const original = content.replace(/^\uFEFF/, '');
  let text = original;
  let explicitNumber: number | undefined;
  let title = '';
  if (/\.json$/i.test(name)) {
    let data: any;
    try { data = JSON.parse(original); } catch { throw new Error('ساختار JSON معتبر نیست.'); }
    if (typeof data === 'string') text = data;
    else {
      const value = Number(asciiDigits(String(data?.sessionNumber ?? data?.session_number ?? data?.number ?? '')));
      if (Number.isInteger(value) && value > 0 && value <= 100000) explicitNumber = value;
      title = typeof data?.sessionTitle === 'string' ? data.sessionTitle : typeof data?.title === 'string' ? data.title : '';
      if (typeof data?.transcript === 'string') text = data.transcript;
      else if (typeof data?.text === 'string') text = data.text;
      else {
        const rows = Array.isArray(data) ? data : data?.transcriptParagraphs ?? data?.paragraphs ?? data?.segments;
        if (!Array.isArray(rows)) throw new Error('JSON باید transcript، text یا آرایه paragraphs/segments داشته باشد.');
        text = rows.map((row: any) => {
          if (typeof row === 'string') return row;
          if (typeof row?.text !== 'string') throw new Error('هر بند JSON باید متن داشته باشد.');
          const start = row.originalStartSec ?? row.startSec ?? row.start;
          const stamp = Number.isFinite(start) && start >= 0 ? timeTag(start) : typeof row.timestamp === 'string' ? row.timestamp : '';
          return `${stamp ? stamp + ' ' : ''}${row.speaker ? String(row.speaker) + ': ' : ''}${row.text}`;
        }).join('\n\n');
      }
    }
  }
  if (!text.trim()) throw new Error('فایل متنی خالی است.');
  const number = explicitNumber ?? detectSessionNumber(name, text);
  if (!number) throw new Error('شماره جلسه در نام فایل یا هدر پیدا نشد؛ نامی مثل Session_01_Transcript یا «جلسه ۱» لازم است.');
  let lastTimestamp: string | undefined;
  const paragraphs = text.split(/\r?\n/).filter(line => line.trim()).map((line, i) => {
    lastTimestamp = findTimestamp(line) || lastTimestamp;
    return { id: `p${i + 1}`, text: line, timestamp: lastTimestamp };
  });
  return { number, title: title || `جلسه ${number}`, source: { name, text }, paragraphs };
}

export async function ingestTextFiles(files: File[]): Promise<{ sessions: BatchSession[]; errors: string[] }> {
  const grouped = new Map<number, Array<ReturnType<typeof parseTranscript>>>();
  const errors: string[] = [];
  for (const file of [...files].sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, 'fa', { numeric: true }))) {
    if (!/\.(md|txt|json)$/i.test(file.name)) continue;
    const name = file.webkitRelativePath || file.name;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('فایل متنی بزرگ‌تر از ۱۰ مگابایت است.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
      let content: string;
      try { content = new TextDecoder(encoding, { fatal: true }).decode(bytes); }
      catch { throw new Error('کدگذاری متن قابل خواندن نیست؛ فایل UTF-8 یا UTF-16 لازم است.'); }
      const parsed = parseTranscript(name, content);
      const rows = grouped.get(parsed.number) || [];
      if (!rows.some(row => row.source.text === parsed.source.text)) rows.push(parsed);
      grouped.set(parsed.number, rows);
    } catch (error: any) { errors.push(`${name}: ${error.message}`); }
  }
  const sessions: BatchSession[] = [];
  for (const [number, rows] of grouped) {
    const sources = rows.map(row => row.source);
    const fingerprint = JSON.stringify({ number, sources, version: 'batch-text-v1' });
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
    const id = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    const paragraphs = rows.flatMap(row => row.paragraphs).map((p, i) => ({ ...p, id: `p${i + 1}` }));
    sessions.push({ id, number, title: rows[0].title, sources, paragraphs, status: 'pending' });
  }
  return { sessions: sessions.sort((a, b) => a.number - b.number), errors };
}

export function sessionGroups(sessions: BatchSession[]) {
  const groups = new Map<number, BatchSession[]>();
  for (const session of [...sessions].sort((a, b) => a.number - b.number)) {
    const start = Math.floor((session.number - 1) / 5) * 5 + 1;
    groups.set(start, [...(groups.get(start) || []), session]);
  }
  return [...groups].sort((a, b) => a[0] - b[0]).map(([start, items]) => ({ start, end: start + 4, sessions: items,
    complete: items.length === 5 && items.every((s, i) => s.number === start + i && s.status === 'done') }));
}
