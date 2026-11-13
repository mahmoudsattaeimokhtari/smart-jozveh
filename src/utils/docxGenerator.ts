import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
} from 'docx';
import {
  ProcessedSession,
  TranscriptParagraph,
  SessionQuestion,
  ClassicNote,
  AppSettings,
} from '../types';

// Palette of warm, readable colors for highlights
const WARM_COLORS = {
  burgundy: '881337',   // زرشکی عمیق
  brickRed: '9A3412',   // آجری
  burntOrange: 'C2410C',// نارنجی سوخته
  warmBrown: '78350F',  // قهوه‌ای گرم
  darkText: '1E293B',   // متن اصلی تیره و خوانا
  mutedMeta: '64748B',  // خاکستری خوانا برای برچسب زمان
  borderLight: 'E2E8F0',
  headerBg: 'F8FAFC',
};

// Regex to detect English / Latin characters vs Persian
const LATIN_REGEX = /^[A-Za-z0-9\s.,!?:;_\-+=/\\(){}[\]$@#%^&*<>~`'"]+$/;

/**
 * Splits a sentence into runs so that Latin / English words get Times New Roman
 * and Persian words get B Nazanin (or B Zar for headings), respecting RTL.
 */
function createBiDiRuns(
  text: string,
  options: {
    persianFont: string;
    englishFont?: string;
    sizePt: number;
    bold?: boolean;
    color?: string;
    isHeading?: boolean;
  }
): TextRun[] {
  const {
    persianFont,
    englishFont = 'Times New Roman',
    sizePt,
    bold = false,
    color = WARM_COLORS.darkText,
  } = options;

  if (!text) return [];

  // Match English words / tokens or non-English tokens
  // Matches Latin chunks or Persian/other chunks
  const tokens = text.split(/([A-Za-z0-9][A-Za-z0-9\s.,!?:;_\-+=/\\(){}[\]$@#%^&*<>~`'"]*[A-Za-z0-9]|[A-Za-z0-9]+)/g);

  const runs: TextRun[] = [];

  for (const token of tokens) {
    if (!token) continue;

    const isLatin = /[A-Za-z]/.test(token);
    runs.push(
      new TextRun({
        text: token,
        font: {
          name: isLatin ? englishFont : persianFont,
          ascii: isLatin ? englishFont : persianFont,
          cs: isLatin ? englishFont : persianFont,
          hAnsi: isLatin ? englishFont : persianFont,
        },
        size: sizePt * 2, // docx sizes are in half-points (14pt = 28)
        bold,
        color,
        rightToLeft: !isLatin,
        noProof: true, // Disables red/blue grammar squiggles in Word
      })
    );
  }

  return runs;
}

/**
 * Builds standard Document Header with Session title
 */
function createDocHeader(sessionTitle: string, subtitle: string, settings: AppSettings): Header {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: `${sessionTitle} — ${subtitle}`,
            font: { name: settings.persianHeadingFont, cs: settings.persianHeadingFont, ascii: settings.englishFont },
            size: 20, // 10pt
            color: WARM_COLORS.mutedMeta,
            rightToLeft: true,
            noProof: true,
          }),
        ],
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 4,
            color: WARM_COLORS.borderLight,
          },
        },
      }),
    ],
  });
}

/**
 * Builds standard Document Footer with Page numbering
 */
function createDocFooter(settings: AppSettings): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        children: [
          new TextRun({
            text: 'صفحه ',
            font: { name: settings.persianBodyFont, cs: settings.persianBodyFont, ascii: settings.englishFont },
            size: 18,
            color: WARM_COLORS.mutedMeta,
            rightToLeft: true,
            noProof: true,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: { name: settings.englishFont },
            size: 18,
            color: WARM_COLORS.mutedMeta,
            noProof: true,
          }),
          new TextRun({
            text: ' از ',
            font: { name: settings.persianBodyFont, cs: settings.persianBodyFont, ascii: settings.englishFont },
            size: 18,
            color: WARM_COLORS.mutedMeta,
            rightToLeft: true,
            noProof: true,
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            font: { name: settings.englishFont },
            size: 18,
            color: WARM_COLORS.mutedMeta,
            noProof: true,
          }),
        ],
      }),
    ],
  });
}

// -------------------------------------------------------------
// 1. خروجی اول: متن کامل و وفادار به گفتار استاد
// -------------------------------------------------------------
export function buildFullTranscriptDocument(
  session: ProcessedSession,
  settings: AppSettings
): Document {
  const paragraphs: Paragraph[] = [];

  // Title Block
  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { before: 200, after: 120 },
      children: createBiDiRuns(`${session.sessionTitle} ـ متن کامل و وفادار به گفتار`, {
        persianFont: settings.persianHeadingFont,
        englishFont: settings.englishFont,
        sizePt: settings.headingFontSize + 2,
        bold: true,
        color: WARM_COLORS.burgundy,
      }),
    })
  );

  // Metadata block (Course, Instructor, Date)
  const metaItems = [
    session.courseTitle ? `درس: ${session.courseTitle}` : null,
    session.instructorName ? `استاد: ${session.instructorName}` : null,
    session.date ? `تاریخ: ${session.date}` : null,
    `تعداد پاراگراف‌ها: ${session.transcriptParagraphs.length}`,
  ].filter(Boolean).join('  |  ');

  if (metaItems) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { after: 280 },
        children: createBiDiRuns(metaItems, {
          persianFont: settings.persianBodyFont,
          englishFont: settings.englishFont,
          sizePt: 11,
          color: WARM_COLORS.mutedMeta,
        }),
      })
    );
  }

  // Iterate over paragraphs
  let currentPart = '';
  for (const p of session.transcriptParagraphs) {
    // Add section heading if part changed
    if (p.partTitle && p.partTitle !== currentPart) {
      currentPart = p.partTitle;
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.RIGHT,
          bidirectional: true,
          spacing: { before: 280, after: 120 },
          children: createBiDiRuns(currentPart, {
            persianFont: settings.persianHeadingFont,
            englishFont: settings.englishFont,
            sizePt: settings.headingFontSize,
            bold: true,
            color: WARM_COLORS.brickRed,
          }),
        })
      );
    }

    // Paragraph with time tag and speaker
    const isTeacher = p.speaker.includes('استاد');
    const speakerPrefix = isTeacher ? '«استاد»: ' : `«${p.speaker}»: `;
    const speakerColor = isTeacher ? WARM_COLORS.burgundy : WARM_COLORS.warmBrown;

    const children: TextRun[] = [
      // Precise time tag in muted brackets
      new TextRun({
        text: `${p.formattedTimeTag} `,
        font: { name: settings.englishFont, ascii: settings.englishFont, cs: settings.persianBodyFont },
        size: 20, // 10pt
        color: WARM_COLORS.mutedMeta,
        bold: true,
        noProof: true,
      }),
      // Speaker label
      ...createBiDiRuns(speakerPrefix, {
        persianFont: settings.persianBodyFont,
        englishFont: settings.englishFont,
        sizePt: settings.bodyFontSize,
        bold: true,
        color: speakerColor,
      }),
      // Content with highlight if unclear
      ...createBiDiRuns(p.text, {
        persianFont: settings.persianBodyFont,
        englishFont: settings.englishFont,
        sizePt: settings.bodyFontSize,
        color: WARM_COLORS.darkText,
      }),
    ];

    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { line: 360, before: 60, after: 120 }, // Generous line spacing
        children,
      })
    );
  }

  return new Document({
    sections: [
      {
        headers: {
          default: createDocHeader(session.sessionTitle, 'متن کامل و وفادار', settings),
        },
        footers: {
          default: createDocFooter(settings),
        },
        children: paragraphs,
      },
    ],
  });
}

export async function generateFullTranscriptDocx(
  session: ProcessedSession,
  settings: AppSettings
): Promise<Blob> {
  const doc = buildFullTranscriptDocument(session, settings);
  return await Packer.toBlob(doc);
}

// -------------------------------------------------------------
// 2. خروجی دوم: سؤالات جلسه
// -------------------------------------------------------------
export function buildQuestionsDocument(
  session: ProcessedSession,
  settings: AppSettings
): Document {
  const paragraphs: Paragraph[] = [];

  // Title
  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { before: 200, after: 120 },
      children: createBiDiRuns(`${session.sessionTitle} ـ مجموعه کامل سؤالات و پرسش‌ها`, {
        persianFont: settings.persianHeadingFont,
        englishFont: settings.englishFont,
        sizePt: settings.headingFontSize + 2,
        bold: true,
        color: WARM_COLORS.burgundy,
      }),
    })
  );

  // Intro note
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { after: 240 },
      children: createBiDiRuns(
        'شامل تمامی سؤالات تستی، تشریحی، شفاهی و پرسش‌های کلاسی مطرح‌شده با مشخصات، ارجاع زمانی و پاسخ‌های صوتی.',
        {
          persianFont: settings.persianBodyFont,
          englishFont: settings.englishFont,
          sizePt: 11,
          color: WARM_COLORS.mutedMeta,
        }
      ),
    })
  );

  if (session.questions.length === 0) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 200 },
        children: createBiDiRuns('در فایل‌های صوتی این جلسه هیچ سؤالی مطرح نشده است.', {
          persianFont: settings.persianBodyFont,
          englishFont: settings.englishFont,
          sizePt: settings.bodyFontSize,
          bold: true,
          color: WARM_COLORS.darkText,
        }),
      })
    );
  } else {
    session.questions.forEach((q, idx) => {
      // Question Header / Number & Type
      const questionTag = `سؤال ${idx + 1} (${q.type || 'تشریحی'}) [${q.partTitle || ''} | ${q.fileName || ''} | ${q.formattedTime || '۰۰:۰۰'}]`;

      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.RIGHT,
          bidirectional: true,
          spacing: { before: 240, after: 80 },
          children: createBiDiRuns(questionTag, {
            persianFont: settings.persianHeadingFont,
            englishFont: settings.englishFont,
            sizePt: settings.headingFontSize - 1,
            bold: true,
            color: WARM_COLORS.brickRed,
          }),
        })
      );

      // Topic if present
      if (q.topic) {
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            spacing: { after: 60 },
            children: [
              ...createBiDiRuns('موضوع: ', {
                persianFont: settings.persianBodyFont,
                englishFont: settings.englishFont,
                sizePt: 11,
                bold: true,
                color: WARM_COLORS.mutedMeta,
              }),
              ...createBiDiRuns(q.topic, {
                persianFont: settings.persianBodyFont,
                englishFont: settings.englishFont,
                sizePt: 11,
                color: WARM_COLORS.mutedMeta,
              }),
            ],
          })
        );
      }

      // Question body
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          bidirectional: true,
          spacing: { line: 340, after: 100 },
          children: createBiDiRuns(`متن سؤال: ${q.questionText}`, {
            persianFont: settings.persianBodyFont,
            englishFont: settings.englishFont,
            sizePt: settings.bodyFontSize,
            bold: true,
            color: WARM_COLORS.darkText,
          }),
        })
      );

      // Options if test question
      if (q.options && q.options.length > 0) {
        q.options.forEach((opt, optIdx) => {
          paragraphs.push(
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              bidirectional: true,
              indent: { right: 360 },
              spacing: { after: 40 },
              children: createBiDiRuns(`${optIdx + 1}) ${opt}`, {
                persianFont: settings.persianBodyFont,
                englishFont: settings.englishFont,
                sizePt: settings.bodyFontSize,
                color: WARM_COLORS.darkText,
              }),
            })
          );
        });
      }

      // Answer & Teacher Explanation
      const answerText = q.isAnswerStated && q.answer
        ? `پاسخ و تحلیل استاد: ${q.answer}`
        : 'پاسخ: پاسخ در فایل‌های صوتی این جلسه بیان نشده است.';

      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          bidirectional: true,
          spacing: { before: 80, after: 200 },
          children: createBiDiRuns(answerText, {
            persianFont: settings.persianBodyFont,
            englishFont: settings.englishFont,
            sizePt: settings.bodyFontSize,
            bold: !q.isAnswerStated,
            color: q.isAnswerStated ? WARM_COLORS.warmBrown : WARM_COLORS.burntOrange,
          }),
        })
      );
    });
  }

  return new Document({
    sections: [
      {
        headers: {
          default: createDocHeader(session.sessionTitle, 'بانک سؤالات', settings),
        },
        footers: {
          default: createDocFooter(settings),
        },
        children: paragraphs,
      },
    ],
  });
}

export async function generateQuestionsDocx(
  session: ProcessedSession,
  settings: AppSettings
): Promise<Blob> {
  const doc = buildQuestionsDocument(session, settings);
  return await Packer.toBlob(doc);
}

// -------------------------------------------------------------
// 3. خروجی سوم: جزوه کلاسیک و دسته‌بندی‌شده
// -------------------------------------------------------------
export function buildClassicNoteDocument(
  session: ProcessedSession,
  settings: AppSettings
): Document {
  const paragraphs: Paragraph[] = [];
  const note = session.classicNote;

  // Title
  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { before: 200, after: 120 },
      children: createBiDiRuns(note.title || `${session.sessionTitle} ـ جزوه کلاسیک و موضوع‌بندی‌شده`, {
        persianFont: settings.persianHeadingFont,
        englishFont: settings.englishFont,
        sizePt: settings.headingFontSize + 3,
        bold: true,
        color: WARM_COLORS.burgundy,
      }),
    })
  );

  // Metadata block
  const metaItems = [
    note.courseTitle || session.courseTitle ? `درس: ${note.courseTitle || session.courseTitle}` : null,
    note.instructor || session.instructorName ? `مدرس: ${note.instructor || session.instructorName}` : null,
    note.sessionNumber || session.sessionNumber ? `جلسه: ${note.sessionNumber || session.sessionNumber}` : null,
    session.date ? `تاریخ: ${session.date}` : null,
  ].filter(Boolean).join('  |  ');

  if (metaItems) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { after: 280 },
        children: createBiDiRuns(metaItems, {
          persianFont: settings.persianBodyFont,
          englishFont: settings.englishFont,
          sizePt: 11,
          color: WARM_COLORS.mutedMeta,
        }),
      })
    );
  }

  // Introduction
  if (note.introduction) {
    paragraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 180, after: 80 },
        children: createBiDiRuns('مقدمه و اهداف آموزشی', {
          persianFont: settings.persianHeadingFont,
          englishFont: settings.englishFont,
          sizePt: settings.headingFontSize,
          bold: true,
          color: WARM_COLORS.brickRed,
        }),
      })
    );

    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { line: 360, after: 240 },
        children: createBiDiRuns(note.introduction, {
          persianFont: settings.persianBodyFont,
          englishFont: settings.englishFont,
          sizePt: settings.bodyFontSize,
          color: WARM_COLORS.darkText,
        }),
      })
    );
  }

  // Sections
  if (note.sections && note.sections.length > 0) {
    note.sections.forEach((sec, idx) => {
      // Main Heading
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.RIGHT,
          bidirectional: true,
          spacing: { before: 280, after: 100 },
          children: createBiDiRuns(`${idx + 1}. ${sec.heading}`, {
            persianFont: settings.persianHeadingFont,
            englishFont: settings.englishFont,
            sizePt: settings.headingFontSize,
            bold: true,
            color: WARM_COLORS.burgundy,
          }),
        })
      );

      // Subheading
      if (sec.subheading) {
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            spacing: { before: 60, after: 80 },
            children: createBiDiRuns(sec.subheading, {
              persianFont: settings.persianHeadingFont,
              englishFont: settings.englishFont,
              sizePt: settings.bodyFontSize + 1,
              bold: true,
              color: WARM_COLORS.burntOrange,
            }),
          })
        );
      }

      // Content text
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          bidirectional: true,
          spacing: { line: 360, after: 140 },
          children: createBiDiRuns(sec.content, {
            persianFont: settings.persianBodyFont,
            englishFont: settings.englishFont,
            sizePt: settings.bodyFontSize,
            color: WARM_COLORS.darkText,
          }),
        })
      );

      // Teacher Emphasis Points (Highlighted in warm color)
      if (sec.teacherEmphasisPoints && sec.teacherEmphasisPoints.length > 0) {
        sec.teacherEmphasisPoints.forEach((point) => {
          paragraphs.push(
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              bidirectional: true,
              indent: { right: 280 },
              spacing: { before: 40, after: 80 },
              children: [
                new TextRun({
                  text: '★ نکته مهم و تأکید استاد: ',
                  font: { name: settings.persianBodyFont, cs: settings.persianBodyFont, ascii: settings.englishFont },
                  size: settings.bodyFontSize * 2,
                  bold: true,
                  color: WARM_COLORS.burgundy,
                  rightToLeft: true,
                  noProof: true,
                }),
                ...createBiDiRuns(point, {
                  persianFont: settings.persianBodyFont,
                  englishFont: settings.englishFont,
                  sizePt: settings.bodyFontSize,
                  bold: true,
                  color: WARM_COLORS.brickRed,
                }),
              ],
            })
          );
        });
      }

      // Key definitions
      if (sec.keyDefinitions && sec.keyDefinitions.length > 0) {
        sec.keyDefinitions.forEach((def) => {
          paragraphs.push(
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              bidirectional: true,
              indent: { right: 280 },
              spacing: { after: 60 },
              children: [
                new TextRun({
                  text: `• تعریف «${def.term}»: `,
                  font: { name: settings.persianBodyFont, cs: settings.persianBodyFont, ascii: settings.englishFont },
                  size: settings.bodyFontSize * 2,
                  bold: true,
                  color: WARM_COLORS.warmBrown,
                  rightToLeft: true,
                  noProof: true,
                }),
                ...createBiDiRuns(def.definition, {
                  persianFont: settings.persianBodyFont,
                  englishFont: settings.englishFont,
                  sizePt: settings.bodyFontSize,
                  color: WARM_COLORS.darkText,
                }),
              ],
            })
          );
        });
      }

      // Examples
      if (sec.examples && sec.examples.length > 0) {
        sec.examples.forEach((ex) => {
          paragraphs.push(
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              bidirectional: true,
              indent: { right: 280 },
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: 'مثال کلاسی: ',
                  font: { name: settings.persianBodyFont, cs: settings.persianBodyFont, ascii: settings.englishFont },
                  size: settings.bodyFontSize * 2,
                  bold: true,
                  color: WARM_COLORS.burntOrange,
                  rightToLeft: true,
                  noProof: true,
                }),
                ...createBiDiRuns(ex, {
                  persianFont: settings.persianBodyFont,
                  englishFont: settings.englishFont,
                  sizePt: settings.bodyFontSize,
                  color: WARM_COLORS.darkText,
                }),
              ],
            })
          );
        });
      }
    });
  }

  // Conclusion
  if (note.conclusion) {
    paragraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 240, after: 80 },
        children: createBiDiRuns('جمع‌بندی و نتیجه‌گیری جلسه', {
          persianFont: settings.persianHeadingFont,
          englishFont: settings.englishFont,
          sizePt: settings.headingFontSize,
          bold: true,
          color: WARM_COLORS.burgundy,
        }),
      })
    );

    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { line: 360, after: 200 },
        children: createBiDiRuns(note.conclusion, {
          persianFont: settings.persianBodyFont,
          englishFont: settings.englishFont,
          sizePt: settings.bodyFontSize,
          color: WARM_COLORS.darkText,
        }),
      })
    );
  }

  return new Document({
    sections: [
      {
        headers: {
          default: createDocHeader(session.sessionTitle, 'جزوه کلاسیک', settings),
        },
        footers: {
          default: createDocFooter(settings),
        },
        children: paragraphs,
      },
    ],
  });
}

export async function generateClassicNoteDocx(
  session: ProcessedSession,
  settings: AppSettings
): Promise<Blob> {
  const doc = buildClassicNoteDocument(session, settings);
  return await Packer.toBlob(doc);
}
