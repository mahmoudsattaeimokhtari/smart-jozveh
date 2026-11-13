import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, LineRuleType, PageBreak } from 'docx';
import type { BatchSession } from '../types/batch';
import { persianDigits } from './textIngestion.ts';

export interface ExportBlock { kind: 'title' | 'heading' | 'body' | 'exam'; text: string }
export function sourceReference(session: BatchSession, ids: string[]): string {
  const timestamps = [...new Set(session.paragraphs.filter(p => ids.includes(p.id)).map(p => p.timestamp).filter(Boolean))];
  return timestamps.length ? timestamps.join(' ') : `بندهای منبع: ${ids.join('، ')} (زمان در ورودی موجود نیست)`;
}
export function classicBlocks(session: BatchSession): ExportBlock[] {
  const blocks: ExportBlock[] = [{ kind: 'title', text: `${session.title} — جزوه کلاسیک` }];
  for (const section of session.analysis?.sections || []) {
    blocks.push({ kind: 'heading', text: section.heading }, { kind: 'body', text: sourceReference(session, section.sourceIds) });
    blocks.push(...section.content.split(/\r?\n/).map(text => ({ kind: 'body' as const, text })));
    for (const point of section.examPoints) blocks.push({ kind: 'exam', text: `نکته مهم امتحانی: ${point}` });
  }
  return blocks;
}
export function questionBlocks(session: BatchSession): ExportBlock[] {
  const blocks: ExportBlock[] = [{ kind: 'title', text: `${session.title} — بانک سؤال` }, { kind: 'heading', text: 'بخش اول: سؤال‌های مطرح‌شده در کلاس' }];
  if (!session.analysis?.classroomQuestions.length) blocks.push({ kind: 'body', text: 'در تحلیل متن ورودی، سؤال کلاسی با نقل‌قول و ارجاع معتبر شناسایی نشد.' });
  session.analysis?.classroomQuestions.forEach((q, i) => {
    blocks.push({ kind: 'heading', text: `${i + 1}. ${q.question}` }, { kind: 'body', text: sourceReference(session, q.sourceIds) }, { kind: 'body', text: `پاسخ کلاسی: ${q.answer}` });
    if (q.evidence) blocks.push({ kind: 'body', text: `شاهد عین متن: ${q.evidence}` });
  });
  blocks.push({ kind: 'heading', text: 'بخش دوم: سؤال‌های چهارگزینه‌ای تألیفی از محتوای همین جلسه' });
  session.analysis?.practiceQuestions.forEach((q, i) => {
    blocks.push({ kind: 'heading', text: `${i + 1}. ${q.question}` });
    q.options.forEach((option, n) => blocks.push({ kind: 'body', text: `${'ابجد'[n]}) ${option}` }));
    blocks.push({ kind: 'exam', text: `گزینه صحیح: ${'ابجد'[q.correctIndex]}` }, { kind: 'body', text: `پاسخ تشریحی: ${q.explanation}` }, { kind: 'body', text: sourceReference(session, q.sourceIds) });
  });
  return blocks;
}
export function combinedBlocks(session: BatchSession): ExportBlock[] {
  const blocks: ExportBlock[] = [{ kind: 'title', text: `${session.title} — متن اصلی و جزوه کلاسیک` },
    { kind: 'body', text: 'متن این بخش عین ورودی است؛ فقط شکل ارقام در خروجی فارسی تغییر می‌کند. جزوه و نکات امتحانی در بخش جدا آمده‌اند.' }];
  for (const source of session.sources) {
    blocks.push({ kind: 'heading', text: `متن اصلی: ${source.name}` });
    for (const text of source.text.split(/\r?\n/)) blocks.push({ kind: 'body', text });
  }
  return [...blocks, ...classicBlocks(session)];
}

export function batchTextRuns(text: string, heading = false, exam = false): TextRun[] {
  // Latin runs retain their original digits, e.g. IL-2, MRI and version numbers.
  return text.split(/([A-Za-z][A-Za-z0-9_+./:\-]*(?:[ \t]+[A-Za-z][A-Za-z0-9_+./:\-]*)*)/g).filter(Boolean).map(part => {
    const latin = /^[A-Za-z]/.test(part);
    const font = latin ? 'Times New Roman' : heading ? 'B Zar' : 'B Nazanin';
    return new TextRun({ text: latin ? part : persianDigits(part),
      font: { name: font, ascii: font, hAnsi: font, cs: font, eastAsia: font },
      size: heading ? 36 : 28, sizeComplexScript: heading ? 36 : 28,
      bold: heading || exam, boldComplexScript: heading || exam, rightToLeft: !latin,
      color: exam ? '9A3412' : '1E293B', ...(exam ? { highlight: 'yellow' as const } : {}),
    });
  });
}

export function buildBatchDocx(title: string, blocks: ExportBlock[]): Document {
  return new Document({ title, creator: 'Smart Jozveh', styles: {
    default: { document: { run: { font: { name: 'B Nazanin', cs: 'B Nazanin' }, size: 28, sizeComplexScript: 28 },
      paragraph: { alignment: AlignmentType.RIGHT, spacing: { line: 240, lineRule: LineRuleType.AUTO, before: 0, after: 80 } } } },
  }, sections: [{ properties: { page: { margin: { top: 1000, right: 1100, bottom: 1000, left: 1100 } } },
    children: blocks.map((block, index) => new Paragraph({
      alignment: AlignmentType.RIGHT, bidirectional: true,
      spacing: { line: 240, lineRule: LineRuleType.AUTO, before: block.kind === 'heading' ? 180 : 0, after: 80 },
      ...(block.kind === 'title' ? { heading: HeadingLevel.HEADING_1 } : block.kind === 'heading' ? { heading: HeadingLevel.HEADING_2 } : {}),
      children: [...(block.kind === 'title' && index > 0 ? [new TextRun({ children: [new PageBreak()] })] : []),
        ...batchTextRuns(block.text, block.kind === 'heading' || block.kind === 'title', block.kind === 'exam')],
    })) }],
  });
}
export async function createBatchDocuments(session: BatchSession) {
  const [combined, questions, classic] = await Promise.all([
    Packer.toBlob(buildBatchDocx(session.title, combinedBlocks(session))),
    Packer.toBlob(buildBatchDocx(session.title, questionBlocks(session))),
    Packer.toBlob(buildBatchDocx(session.title, classicBlocks(session))),
  ]);
  return { combined, questions, classic };
}
export function blocksMarkdown(blocks: ExportBlock[]): string {
  return blocks.map(b => b.kind === 'title' ? `# ${b.text}` : b.kind === 'heading' ? `## ${b.text}` : b.kind === 'exam' ? `**${b.text}**` : b.text).join('\n\n');
}
export function saveDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
