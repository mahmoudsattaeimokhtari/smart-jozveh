import { jsPDF } from 'jspdf';
import bidiFactory from 'bidi-js';
import { PDFDocument, PDFDict, PDFName } from 'pdf-lib';
import type { BatchSession } from '../types/batch';
import { combinedBlocks, questionBlocks, type ExportBlock } from './batchDocuments.ts';

let fonts: Promise<[string, string]> | undefined;
const bidi = bidiFactory();
async function fontData(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) throw new Error('دریافت فونت فارسی PDF ناموفق بود.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  let value = ''; for (let i = 0; i < bytes.length; i += 8192) value += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(value);
}
function logicalTextHex(text: string): string {
  let hex = 'FEFF'; for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, '0');
  return hex;
}

export async function buildNotebookPdf(sessions: BatchSession[], fontOverride?: [string, string]): Promise<Blob> {
  if (!sessions.length || sessions.some(s => s.status !== 'done' || !s.analysis)) throw new Error('فقط جلسات کامل‌شده را می‌توان وارد PDF کرد.');
  const sorted = [...sessions].sort((a, b) => a.number - b.number);
  const base = import.meta.env?.BASE_URL || './';
  if (!fontOverride && !fonts) fonts = Promise.all([fontData(`${base}fonts/Vazirmatn-Regular.ttf`), fontData(`${base}fonts/Vazirmatn-Bold.ttf`)]).catch(error => { fonts = undefined; throw error; });
  const [regular, bold] = fontOverride || await fonts!;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true, putOnlyUsedFonts: true });
  // We shape before bidi reordering. Running jsPDF's default shaper again on
  // visual-order text incorrectly turns alef-lam into lam-alef ligatures.
  for (const [token, [handler]] of Object.entries(doc.internal.events.getTopics().preProcessText || {})) {
    if (handler === doc.processArabic) doc.internal.events.unsubscribe(token);
  }
  const pdfInternal = doc.internal as typeof doc.internal & { write(content: string): void };
  doc.addFileToVFS('Vazirmatn-Regular.ttf', regular); doc.addFont('Vazirmatn-Regular.ttf', 'Vazirmatn', 'normal');
  doc.addFileToVFS('Vazirmatn-Bold.ttf', bold); doc.addFont('Vazirmatn-Bold.ttf', 'Vazirmatn', 'bold');
  doc.setLanguage('fa-IR');
  doc.setProperties({ title: `NotebookLM — جلسات ${sorted.map(s => s.number).join('، ')}`, author: 'Smart Jozveh' });
  const width = doc.internal.pageSize.getWidth(); const height = doc.internal.pageSize.getHeight();
  const margin = 44; const usable = width - margin * 2; let y = 60;
  const visual = (text: string) => {
    const shaped = doc.processArabic(text);
    return bidi.getReorderedString(shaped, bidi.getEmbeddingLevels(shaped, 'rtl'));
  };
  const visualParts = (text: string) => visual(text).split(/(\[[0-9:]+\]|[A-Za-z0-9][A-Za-z0-9_./:\-]*(?: +[A-Za-z0-9][A-Za-z0-9_./:\-]*)*)/g).filter(Boolean);
  const partWidth = (text: string, heading: boolean) => {
    doc.setFont(/[A-Za-z0-9]/.test(text) && !/[\u0600-\u06ff\ufb50-\ufeff]/.test(text) ? 'Times' : 'Vazirmatn', heading ? 'bold' : 'normal');
    return doc.getTextWidth(text);
  };
  const writeLine = (line: string, heading: boolean, exam: boolean) => {
    const lineHeight = heading ? 27 : 19;
    if (y + lineHeight > height - 50) { doc.addPage(); y = 52; }
    doc.setFont('Vazirmatn', heading ? 'bold' : 'normal'); doc.setFontSize(heading ? 16 : 11);
    doc.setTextColor(exam ? '#9A3412' : '#1E293B');
    // ActualText keeps the original logical Unicode for copy/search and NotebookLM,
    // while the visible text uses correctly shaped/reordered glyphs.
    pdfInternal.write(`/Span << /ActualText <${logicalTextHex(line)}> >> BDC`);
    const parts = visualParts(line);
    const widths = parts.map(part => partWidth(part, heading));
    let x = width - margin - widths.reduce((a, b) => a + b, 0);
    const positioned = parts.map((part, i) => { const at = x; x += widths[i]; return { part, x: at }; });
    // Emit in logical reading order while placing runs at their visual positions.
    // Separate Latin runs prevent PDF extractors from mirroring time tags.
    for (const positionedPart of positioned.reverse()) {
      partWidth(positionedPart.part, heading);
      doc.text(positionedPart.part, positionedPart.x, y, { isInputVisual: true, isOutputVisual: true, isInputRtl: false, isOutputRtl: false });
    }
    pdfInternal.write('EMC'); y += lineHeight;
  };
  const block = (b: ExportBlock) => {
    const heading = b.kind === 'title' || b.kind === 'heading';
    doc.setFont('Vazirmatn', heading ? 'bold' : 'normal'); doc.setFontSize(heading ? 16 : 11);
    if (heading) y += 10;
    const words = b.text.split(/\s+/); let line = '';
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word;
      if (visualParts(candidate).reduce((total, part) => total + partWidth(part, heading), 0) > usable && line) { writeLine(line, heading, b.kind === 'exam'); line = word; }
      else line = candidate;
    }
    writeLine(line, heading, b.kind === 'exam'); y += 4;
  };
  block({ kind: 'title', text: 'بسته مطالعاتی برای NotebookLM' });
  block({ kind: 'heading', text: `جلسات ${sorted.map(s => s.number).join('، ')}` });
  block({ kind: 'body', text: 'شامل متن اصلی، جزوه موضوعی، نکات امتحانی و بانک سؤال. سؤال‌های تألیفی از سؤال‌های کلاس جدا شده‌اند.' });
  block({ kind: 'heading', text: 'فهرست جلسات' });
  for (const session of sorted) block({ kind: 'body', text: `${session.number}. ${session.title}` });
  for (const session of sorted) {
    doc.addPage(); y = 52;
    for (const b of [...combinedBlocks(session), ...questionBlocks(session)]) block(b);
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFont('Vazirmatn', 'normal'); doc.setFontSize(9); doc.setTextColor('#64748B');
    doc.text(`${i} / ${pages}`, margin, height - 25);
  }
  // Presentation-form glyphs must map back to normal Persian Unicode. ActualText
  // alone is ignored by several PDF extractors, including PDF.js.
  const fontMaps = ['normal', 'bold'].map(style => {
    doc.setFont('Vazirmatn', style);
    const font = doc.getFont() as unknown as { id: string; metadata: { toUnicode: Record<string, number> } };
    const entries = Object.entries(font.metadata.toUnicode).map(([glyph, code]) => {
      let logical = String.fromCharCode(code).normalize('NFKC');
      if (logical.length > 1 && /^[\u0600-\u06ff]+$/.test(logical)) logical = [...logical].reverse().join('');
      return `<${Number(glyph).toString(16).padStart(4, '0')}> <${logicalTextHex(logical).slice(4)}>`;
    });
    let cmap = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /PersianUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <ffff>\nendcodespacerange\n';
    for (let i = 0; i < entries.length; i += 100) {
      const group = entries.slice(i, i + 100); cmap += `${group.length} beginbfchar\n${group.join('\n')}\nendbfchar\n`;
    }
    return { id: font.id, cmap: cmap + 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend' };
  });
  const pdf = await PDFDocument.load(doc.output('arraybuffer'));
  const unicodeStreams = new Map(fontMaps.map(font => [font.id, pdf.context.register(pdf.context.flateStream(font.cmap))]));
  for (const page of pdf.getPages()) {
    const resources = page.node.Resources();
    const fontDictionary = resources?.lookup(PDFName.of('Font'), PDFDict);
    if (!fontDictionary) continue;
    for (const font of fontMaps) {
      const dictionary = fontDictionary.lookupMaybe(PDFName.of(font.id), PDFDict);
      if (dictionary) dictionary.set(PDFName.of('ToUnicode'), unicodeStreams.get(font.id)!);
    }
  }
  return new Blob([new Uint8Array(await pdf.save({ useObjectStreams: false }))], { type: 'application/pdf' });
}
