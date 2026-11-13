import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import 'fake-indexeddb/auto';
import { extractText, getDocumentProxy } from 'unpdf';
import { parseTranscript, ingestTextFiles, detectSessionNumber, sessionGroups } from '../src/utils/textIngestion.ts';
import { splitTextParagraphs, validateBatchAnalysis, analyzeTextSession } from '../src/services/batchTextClient.ts';
import { createBatchDocuments } from '../src/utils/batchDocuments.ts';
import { buildNotebookPdf } from '../src/utils/batchPdf.ts';

const source = '# جلسه ۱\n[00:01:02] استاد: فیزیولوژی سلول و MRI در 12 نمونه بررسی می‌شود.\n[00:02:00] سؤال: کار سلول چیست؟\n[00:02:10] پاسخ: سلول واحد ساختاری بدن است.';
const analysis = {
  sections: [{ heading: 'فیزیولوژی سلول', content: 'سلول واحد ساختاری بدن است. بررسی MRI در جلسه مطرح شد.', sourceIds: ['p2', 'p4'], examPoints: ['تعریف سلول را به خاطر بسپارید.'] }],
  classroomQuestions: [{ question: 'کار سلول چیست؟', answer: 'سلول واحد ساختاری بدن است.', evidence: 'سلول واحد ساختاری بدن است.', sourceIds: ['p3', 'p4'] }],
  practiceQuestions: [{ question: 'کدام گزینه از مطالب همین جلسه است؟', options: ['سلول واحد ساختاری بدن است.', 'گزینه نادرست دوم', 'گزینه نادرست سوم', 'گزینه نادرست چهارم'], correctIndex: 0, explanation: 'تعریف سلول در متن بیان شده است.', sourceIds: ['p4'] }],
};
const fixture = n => {
  const parsed = parseTranscript(`Session_${n}_Transcript.md`, source);
  return { id: `fixture-${n}`, number: n, title: `جلسه ${n}`, sources: [parsed.source], paragraphs: parsed.paragraphs, status: 'done', analysis: structuredClone(analysis) };
};

test('file/header/JSON detection, Persian digits, ordering and unchanged source', async () => {
  assert.equal(detectSessionNumber('Session_۱۲_Transcript.md', ''), 12);
  assert.equal(detectSessionNumber('lecture.txt', '# جلسه بیست و دوم'), 22);
  assert.equal(detectSessionNumber('lecture.txt', '# جلسه ٦'), 6);
  const result = await ingestTextFiles([new File([source], 'Session_10_Transcript.md'), new File([source], 'Session_2_Transcript.txt'),
    new File([JSON.stringify({ sessionNumber: '۳', paragraphs: [{ text: 'متن فارسی JSON', startSec: 61 }] })], 'lecture.json')]);
  assert.deepEqual(result.sessions.map(s => s.number), [2, 3, 10]);
  assert.equal(result.sessions[0].sources[0].text, source);
  assert.match(result.sessions[1].paragraphs[0].text, /^\[00:01:01\]/);
  assert.throws(() => parseTranscript('bad.json', '{}'), /JSON باید/);
  assert.throws(() => parseTranscript('lecture.txt', 'متن بدون شماره جلسه'), /شماره جلسه/);
  assert.equal(parseTranscript('Session_1.md', 'متن بدون زمان').paragraphs[0].timestamp, undefined);
});

test('five-session groups never conceal missing/failed sessions', () => {
  const full = sessionGroups([10, 1, 4, 3, 2, 5, 6, 8, 7, 9].map(fixture));
  assert.equal(full.length, 2); assert.ok(full.every(g => g.complete));
  assert.deepEqual(full[0].sessions.map(s => s.number), [1, 2, 3, 4, 5]);
  assert.equal(sessionGroups([1, 2, 4, 5].map(fixture))[0].complete, false);
  assert.equal(sessionGroups([1, 2, 3, 4, 5].map(n => ({ ...fixture(n), status: n === 3 ? 'error' : 'done' })))[0].complete, false);
});

test('long text split is lossless', () => {
  const text = 'متن بلند با MRI و 12 عدد '.repeat(3000);
  const groups = splitTextParagraphs([{ id: 'p1', text }]);
  assert.ok(groups.length > 1); assert.equal(groups.flat().map(p => p.text).join(''), text);
  assert.ok(groups.every(g => g.reduce((n, p) => n + p.text.length, 0) <= 24000));
});

test('classroom quotes, answer evidence, source IDs and four options validated', () => {
  const paragraphs = fixture(1).paragraphs;
  assert.equal(validateBatchAnalysis(analysis, paragraphs).practiceQuestions.length, 1);
  const wrong = structuredClone(analysis); wrong.sections[0].sourceIds = ['invented'];
  assert.throws(() => validateBatchAnalysis(wrong, paragraphs), /ارجاع/);
  const invented = structuredClone(analysis); invented.classroomQuestions[0].evidence = 'پاسخ ساختگی';
  assert.throws(() => validateBatchAnalysis(invented, paragraphs), /شاهد/);
  const unquoted = structuredClone(analysis); unquoted.classroomQuestions[0].question = 'یک سؤال ساختگی';
  assert.throws(() => validateBatchAnalysis(unquoted, paragraphs), /نقل عین/);
  const options = structuredClone(analysis); options.practiceQuestions[0].options.pop();
  assert.throws(() => validateBatchAnalysis(options, paragraphs), /چهار گزینه/);
  const absent = structuredClone(analysis); absent.classroomQuestions[0].evidence = ''; absent.classroomQuestions[0].answer = 'پاسخ ساختگی';
  assert.match(validateBatchAnalysis(absent, paragraphs).classroomQuestions[0].answer, /بیان نشده/);
});

test('three DOCX files: RTL, exact fonts, Persian digits, single spacing and exam emphasis', async () => {
  const documents = await createBatchDocuments(fixture(1));
  for (const blob of Object.values(documents)) {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml').async('string');
    assert.match(xml, /w:bidi/); assert.match(xml, /B Nazanin/); assert.match(xml, /B Zar/);
    assert.match(xml, /w:line="240"/); assert.match(xml, /w:lineRule="auto"/);
    assert.doesNotMatch(xml, /w:line="(?:340|360)"/);
  }
  const zip = await JSZip.loadAsync(await documents.combined.arrayBuffer());
  const text = await zip.file('word/document.xml').async('string');
  for (const expected of ['Times New Roman', 'MRI', '۱۲', 'فیزیولوژی سلول', 'نکته مهم امتحانی', 'w:highlight']) assert.ok(text.includes(expected), expected);
});

test('PDF: five sessions, embedded font and selectable original Persian Unicode', async () => {
  const fonts = ['Regular', 'Bold'].map(weight => readFileSync(new URL(`../public/fonts/Vazirmatn-${weight}.ttf`, import.meta.url)).toString('base64'));
  const blob = await buildNotebookPdf([5, 3, 1, 2, 4].map(fixture), fonts);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const raw = Buffer.from(bytes).toString('latin1'); assert.match(raw, /FontFile2/); assert.match(raw, /ToUnicode/);
  const pdf = await getDocumentProxy(bytes);
  assert.ok(pdf.numPages >= 6);
  const { text } = await extractText(pdf, { mergePages: true });
  console.log('PDF extracted text:', text.slice(0, 180));
  assert.match(text, /فیزیولوژی سلول/); assert.match(text, /MRI/); assert.match(text, /\[00:01:02\]/);
  assert.match(text, /NotebookLM/);
  // PDF text extractors commonly omit zero-width non-joiners, but letters must be exact.
  assert.match(text.replace(/\u200c/g, ''), /سؤالهای چهارگزینهای/);
  assert.match(text, /کلاسیک/); assert.doesNotMatch(text, /\ufffd/);
  assert.match(text, /مطالعاتی/); assert.match(text, /تألیفی/);
  await pdf.destroy?.();
});

test('API sends text only and resumes from validated cached analysis', async () => {
  const previousFetch = globalThis.fetch; const previousWindow = globalThis.window;
  const fakeKey = 'test-credential'; let calls = 0;
  globalThis.window = { localStorage: { getItem: () => fakeKey } };
  globalThis.fetch = async (url, options) => {
    calls++; assert.match(url, /gemini-3\.5-flash-lite:streamGenerateContent/);
    assert.equal(options.headers['x-goog-api-key'], fakeKey);
    assert.doesNotMatch(options.body, /inlineData|fileData|upload_id/);
    assert.equal(JSON.parse(options.body).generationConfig.responseMimeType, 'application/json');
    return new Response('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(analysis) }] }, finishReason: 'STOP' }] }) + '\n\n');
  };
  try {
    const session = { ...fixture(1), id: `test-${Date.now()}` };
    await analyzeTextSession(session, new AbortController().signal, () => {});
    await analyzeTextSession(session, new AbortController().signal, () => {});
    assert.equal(calls, 1);
  } finally { globalThis.fetch = previousFetch; globalThis.window = previousWindow; }
});
