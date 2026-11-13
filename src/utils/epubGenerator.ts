import JSZip from 'jszip';
import { ProcessedSession } from '../types';

/**
 * Generates an EPUB 3 compliant electronic book for a lecture session.
 * Features: RTL direction, accessible XHTML, clickable TOC, and embedded CSS.
 */
export async function generateSessionEpub(session: ProcessedSession): Promise<Blob> {
  const zip = new JSZip();

  // 1. mimetype (must be uncompressed at the root)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  // 3. CSS Stylesheet for clean RTL rendering
  const css = `
body {
  direction: rtl;
  text-align: right;
  font-family: 'Vazirmatn', 'B Nazanin', Tahoma, sans-serif;
  line-height: 1.8;
  color: #1e293b;
  margin: 1.5rem;
  background-color: #ffffff;
}
h1, h2, h3, h4 {
  font-family: 'Vazirmatn', 'B Zar', Tahoma, sans-serif;
  color: #881337;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}
h1 { font-size: 1.8rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
h2 { font-size: 1.4rem; color: #9a3412; }
h3 { font-size: 1.2rem; color: #78350f; }
p { margin-bottom: 1rem; }
.meta {
  color: #64748b;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}
.timetag {
  color: #64748b;
  font-size: 0.85rem;
  font-weight: bold;
}
.teacher-emphasis {
  background-color: #fef2f2;
  border-right: 4px solid #991b1b;
  padding: 0.75rem 1rem;
  margin: 1rem 0;
  color: #7f1d1d;
  font-weight: 500;
}
.definition {
  background-color: #fffbeb;
  border-right: 4px solid #b45309;
  padding: 0.75rem 1rem;
  margin: 1rem 0;
}
.latin {
  direction: ltr;
  display: inline-block;
  font-family: 'Times New Roman', serif;
}
.question-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}
`;
  zip.file('OEBPS/styles.css', css);

  // 4. Content files
  // A. Title Page
  const titleXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fa" dir="rtl">
<head>
  <title>${escapeXml(session.sessionTitle)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <div style="text-align: center; margin-top: 20vh;">
    <h1>${escapeXml(session.sessionTitle)}</h1>
    ${session.courseTitle ? `<h2>${escapeXml(session.courseTitle)}</h2>` : ''}
    ${session.instructorName ? `<p class="meta">مدرس: ${escapeXml(session.instructorName)}</p>` : ''}
    ${session.date ? `<p class="meta">تاریخ: ${escapeXml(session.date)}</p>` : ''}
    <p class="meta" style="margin-top: 3rem;">تهیه شده توسط جزوه‌نگار هوشمند</p>
  </div>
</body>
</html>`;
  zip.file('OEBPS/title.xhtml', titleXhtml);

  // B. Classic Note
  const note = session.classicNote;
  let classicSectionsHtml = '';
  if (note.sections && note.sections.length > 0) {
    note.sections.forEach((sec, idx) => {
      classicSectionsHtml += `
      <h2>${idx + 1}. ${escapeXml(sec.heading)}</h2>
      ${sec.subheading ? `<h3>${escapeXml(sec.subheading)}</h3>` : ''}
      <p>${escapeXml(sec.content)}</p>
      `;

      if (sec.teacherEmphasisPoints && sec.teacherEmphasisPoints.length > 0) {
        sec.teacherEmphasisPoints.forEach((point) => {
          classicSectionsHtml += `<div class="teacher-emphasis">★ نکته مهم و تأکید استاد: ${escapeXml(point)}</div>`;
        });
      }

      if (sec.keyDefinitions && sec.keyDefinitions.length > 0) {
        sec.keyDefinitions.forEach((def) => {
          classicSectionsHtml += `<div class="definition"><strong>تعریف «${escapeXml(def.term)}»:</strong> ${escapeXml(def.definition)}</div>`;
        });
      }

      if (sec.examples && sec.examples.length > 0) {
        sec.examples.forEach((ex) => {
          classicSectionsHtml += `<p><em>مثال کلاسی:</em> ${escapeXml(ex)}</p>`;
        });
      }
    });
  }

  const classicNoteXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fa" dir="rtl">
<head>
  <title>جزوه کلاسیک</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>جزوه کلاسیک و موضوع‌بندی‌شده</h1>
  ${note.introduction ? `<p><strong>مقدمه:</strong> ${escapeXml(note.introduction)}</p>` : ''}
  ${classicSectionsHtml}
  ${note.conclusion ? `<h2>جمع‌بندی و نتیجه‌گیری</h2><p>${escapeXml(note.conclusion)}</p>` : ''}
</body>
</html>`;
  zip.file('OEBPS/classic-note.xhtml', classicNoteXhtml);

  // C. Questions
  let questionsHtml = '';
  if (session.questions.length === 0) {
    questionsHtml = '<p>در فایل‌های صوتی این جلسه هیچ سؤالی مطرح نشده است.</p>';
  } else {
    session.questions.forEach((q, idx) => {
      questionsHtml += `
      <div class="question-card">
        <h3>سؤال ${idx + 1} (${escapeXml(q.type || 'تشریحی')}) <span class="timetag">[${escapeXml(q.partTitle || '')} | ${escapeXml(q.fileName || '')} | ${escapeXml(q.formattedTime || '')}]</span></h3>
        ${q.topic ? `<p class="meta">موضوع: ${escapeXml(q.topic)}</p>` : ''}
        <p><strong>متن سؤال:</strong> ${escapeXml(q.questionText)}</p>
        ${
          q.options && q.options.length > 0
            ? `<ol>${q.options.map((opt) => `<li>${escapeXml(opt)}</li>`).join('')}</ol>`
            : ''
        }
        <p><strong>${q.isAnswerStated ? 'پاسخ و تحلیل استاد:' : 'پاسخ:'}</strong> ${escapeXml(
        q.isAnswerStated && q.answer
          ? q.answer
          : 'پاسخ در فایل‌های صوتی این جلسه بیان نشده است.'
      )}</p>
      </div>`;
    });
  }

  const questionsXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fa" dir="rtl">
<head>
  <title>سؤالات جلسه</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>بانک سؤالات و پرسش‌های جلسه</h1>
  ${questionsHtml}
</body>
</html>`;
  zip.file('OEBPS/questions.xhtml', questionsXhtml);

  // D. Full Transcript
  let transcriptHtml = '';
  let currentPart = '';
  for (const p of session.transcriptParagraphs) {
    if (p.partTitle && p.partTitle !== currentPart) {
      currentPart = p.partTitle;
      transcriptHtml += `<h2>${escapeXml(currentPart)}</h2>`;
    }
    transcriptHtml += `
    <p>
      <span class="timetag">${escapeXml(p.formattedTimeTag)}</span>
      <strong>«${escapeXml(p.speaker)}»:</strong>
      ${escapeXml(p.text)}
    </p>`;
  }

  const transcriptXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fa" dir="rtl">
<head>
  <title>متن کامل و وفادار</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>متن کامل و وفادار به گفتار استاد</h1>
  ${transcriptHtml}
</body>
</html>`;
  zip.file('OEBPS/transcript.xhtml', transcriptXhtml);

  // 5. Navigation Document (nav.xhtml - EPUB 3 TOC)
  const navXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fa" dir="rtl">
<head>
  <title>فهرست مطالب</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>فهرست مطالب</h1>
    <ol>
      <li><a href="title.xhtml">صفحه عنوان</a></li>
      <li><a href="classic-note.xhtml">۱. جزوه کلاسیک و موضوع‌بندی‌شده</a></li>
      <li><a href="questions.xhtml">۲. بانک سؤالات جلسه</a></li>
      <li><a href="transcript.xhtml">۳. متن کامل و وفادار به گفتار</a></li>
    </ol>
  </nav>
</body>
</html>`;
  zip.file('OEBPS/nav.xhtml', navXhtml);

  // 6. NCX for backward compatibility (toc.ncx)
  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${session.id}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(session.sessionTitle)}</text></docTitle>
  <navMap>
    <navPoint id="np-1" playOrder="1"><navLabel><text>صفحه عنوان</text></navLabel><content src="title.xhtml"/></navPoint>
    <navPoint id="np-2" playOrder="2"><navLabel><text>جزوه کلاسیک</text></navLabel><content src="classic-note.xhtml"/></navPoint>
    <navPoint id="np-3" playOrder="3"><navLabel><text>بانک سؤالات</text></navLabel><content src="questions.xhtml"/></navPoint>
    <navPoint id="np-4" playOrder="4"><navLabel><text>متن کامل و وفادار</text></navLabel><content src="transcript.xhtml"/></navPoint>
  </navMap>
</ncx>`;
  zip.file('OEBPS/toc.ncx', tocNcx);

  // 7. Package Document (content.opf)
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="pub-id" version="3.0" prefix="rendition: http://www.idpf.org/vocab/rendition/#" xml:lang="fa" dir="rtl">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:${session.id}</dc:identifier>
    <dc:title>${escapeXml(session.sessionTitle)}</dc:title>
    <dc:language>fa</dc:language>
    ${session.instructorName ? `<dc:creator>${escapeXml(session.instructorName)}</dc:creator>` : ''}
    <dc:date>${new Date().toISOString()}</dc:date>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.[0-9]+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="styles" href="styles.css" media-type="text/css"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>
    <item id="classic-note" href="classic-note.xhtml" media-type="application/xhtml+xml"/>
    <item id="questions" href="questions.xhtml" media-type="application/xhtml+xml"/>
    <item id="transcript" href="transcript.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx" page-progression-direction="rtl">
    <itemref idref="title"/>
    <itemref idref="classic-note"/>
    <itemref idref="questions"/>
    <itemref idref="transcript"/>
  </spine>
</package>`;
  zip.file('OEBPS/content.opf', opf);

  return await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}

function escapeXml(unsafe?: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
