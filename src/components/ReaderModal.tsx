import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  BookOpen,
  FileText,
  HelpCircle,
  BookMarked,
  Type,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Share2,
} from 'lucide-react';
import { ProcessedSession } from '../types';
import { normalizePersianText, extractSearchSnippet } from '../utils/persianNormalizer';

interface ReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ProcessedSession[];
  activeSessionId?: string;
}

export const ReaderModal: React.FC<ReaderModalProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    activeSessionId || (sessions[0]?.id ?? '')
  );
  const [activeTab, setActiveTab] = useState<'classic' | 'questions' | 'transcript'>('classic');
  const [fontSize, setFontSize] = useState<number>(16);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [highlightedSnippet, setHighlightedSnippet] = useState<string>('');
  const [bookmarkedSections, setBookmarkedSections] = useState<string[]>([]);

  // Update selected session if activeSessionId changed
  React.useEffect(() => {
    if (activeSessionId) {
      setSelectedSessionId(activeSessionId);
    } else if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);

  const currentSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) || sessions[0],
    [sessions, selectedSessionId]
  );

  // Persian search logic across current session or all sessions
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !currentSession) return [];

    const normQuery = normalizePersianText(searchQuery);
    const results: Array<{
      id: string;
      sourceType: 'جزوه کلاسیک' | 'سؤالات' | 'متن وفادار';
      sectionTitle: string;
      snippet: string;
      targetTab: 'classic' | 'questions' | 'transcript';
    }> = [];

    // Search in Classic Note
    const note = currentSession.classicNote;
    if (note) {
      if (normalizePersianText(note.introduction || '').includes(normQuery)) {
        const snippet = extractSearchSnippet(note.introduction || '', searchQuery);
        if (snippet) {
          results.push({
            id: 'note-intro',
            sourceType: 'جزوه کلاسیک',
            sectionTitle: 'مقدمه جزوه',
            snippet: snippet.snippet,
            targetTab: 'classic',
          });
        }
      }

      note.sections?.forEach((sec, idx) => {
        const textToSearch = `${sec.heading} ${sec.subheading || ''} ${sec.content} ${
          sec.teacherEmphasisPoints?.join(' ') || ''
        }`;
        if (normalizePersianText(textToSearch).includes(normQuery)) {
          const snippet = extractSearchSnippet(textToSearch, searchQuery);
          if (snippet) {
            results.push({
              id: `note-sec-${idx}`,
              sourceType: 'جزوه کلاسیک',
              sectionTitle: sec.heading,
              snippet: snippet.snippet,
              targetTab: 'classic',
            });
          }
        }
      });
    }

    // Search in Questions
    currentSession.questions?.forEach((q, idx) => {
      const qText = `${q.questionText} ${q.answer} ${q.topic} ${q.options?.join(' ') || ''}`;
      if (normalizePersianText(qText).includes(normQuery)) {
        const snippet = extractSearchSnippet(qText, searchQuery);
        if (snippet) {
          results.push({
            id: `q-${idx}`,
            sourceType: 'سؤالات',
            sectionTitle: `سؤال ${idx + 1} (${q.type})`,
            snippet: snippet.snippet,
            targetTab: 'questions',
          });
        }
      }
    });

    // Search in Full Transcript
    currentSession.transcriptParagraphs?.forEach((p, idx) => {
      if (normalizePersianText(p.text).includes(normQuery)) {
        const snippet = extractSearchSnippet(p.text, searchQuery);
        if (snippet) {
          results.push({
            id: `p-${idx}`,
            sourceType: 'متن وفادار',
            sectionTitle: `${p.formattedTimeTag} - ${p.speaker}`,
            snippet: snippet.snippet,
            targetTab: 'transcript',
          });
        }
      }
    });

    return results;
  }, [searchQuery, currentSession]);

  const toggleBookmark = (id: string) => {
    setBookmarkedSections((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Top Control Bar */}
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-800" />
            <span className="font-bold text-sm text-slate-800">کتابخوان جلسات</span>

            {/* Session Selector */}
            {sessions.length > 1 && (
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sessionTitle}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Tab switchers */}
          <div className="flex items-center bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('classic')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeTab === 'classic'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookMarked className="w-3.5 h-3.5 text-amber-700" />
              <span>جزوه کلاسیک</span>
            </button>
            <button
              onClick={() => setActiveTab('questions')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeTab === 'questions'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-purple-700" />
              <span>بانک سؤالات</span>
            </button>
            <button
              onClick={() => setActiveTab('transcript')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeTab === 'transcript'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-700" />
              <span>متن کامل</span>
            </button>
          </div>

          {/* Font scale and close */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
              <button
                onClick={() => setFontSize((f) => Math.max(13, f - 1))}
                title="کوچک‌تر کردن متن"
                className="p-1 hover:bg-slate-100 rounded text-slate-600"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] px-1.5 text-slate-500 font-mono">{fontSize}</span>
              <button
                onClick={() => setFontSize((f) => Math.min(24, f + 1))}
                title="بزرگ‌تر کردن متن"
                className="p-1 hover:bg-slate-100 rounded text-slate-600"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Header */}
        <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی هوشمند در متن کلاس، سؤالات و جزوه (بدون حساسیت به اعراب و ی/ک)..."
              className="w-full pl-3 pr-9 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-2 text-xs text-slate-400 hover:text-slate-600"
              >
                پاک کردن
              </button>
            )}
          </div>
        </div>

        {/* Main Body: Search Results drawer (if query active) or Content Reader */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-white">
          {searchQuery && (
            <div className="mb-6 p-4 bg-amber-50/70 border border-amber-200 rounded-xl">
              <div className="text-xs font-bold text-amber-900 mb-2">
                نتایج جستجو برای «{searchQuery}» ({searchResults.length} مورد یافت شد):
              </div>
              {searchResults.length === 0 ? (
                <p className="text-xs text-slate-500">موردی یافت نشد.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                  {searchResults.map((res, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setActiveTab(res.targetTab);
                        setHighlightedSnippet(res.snippet);
                      }}
                      className="p-2 bg-white rounded-lg border border-amber-200/60 hover:border-amber-400 cursor-pointer transition"
                    >
                      <div className="flex items-center justify-between text-[11px] text-amber-800 font-semibold mb-1">
                        <span>{res.sectionTitle}</span>
                        <span className="text-slate-400 font-normal">{res.sourceType}</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed font-sans">{res.snippet}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!currentSession ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              هیچ جلسه‌ای برای مطالعه بارگذاری نشده است.
            </div>
          ) : (
            <div
              style={{ fontSize: `${fontSize}px` }}
              className="max-w-3xl mx-auto leading-relaxed text-slate-800"
            >
              {/* TAB 1: CLASSIC NOTE */}
              {activeTab === 'classic' && (
                <div>
                  <h1 className="text-2xl font-black text-amber-950 border-b pb-3 mb-4">
                    {currentSession.classicNote?.title || currentSession.sessionTitle}
                  </h1>

                  {currentSession.classicNote?.introduction && (
                    <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <h4 className="font-bold text-slate-900 mb-1 text-sm">مقدمه و اهداف آموزشی</h4>
                      <p className="text-slate-700 leading-relaxed">
                        {currentSession.classicNote.introduction}
                      </p>
                    </div>
                  )}

                  {currentSession.classicNote?.sections?.map((sec, idx) => (
                    <div key={idx} className="mb-8">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-bold text-amber-900">
                          {idx + 1}. {sec.heading}
                        </h2>
                        <button
                          onClick={() => toggleBookmark(`sec-${idx}`)}
                          className="text-slate-400 hover:text-amber-800"
                        >
                          <Bookmark
                            className={`w-4 h-4 ${
                              bookmarkedSections.includes(`sec-${idx}`)
                                ? 'fill-amber-700 text-amber-700'
                                : ''
                            }`}
                          />
                        </button>
                      </div>

                      {sec.subheading && (
                        <h3 className="text-sm font-semibold text-slate-600 mb-2">
                          {sec.subheading}
                        </h3>
                      )}

                      <p className="text-slate-800 leading-loose mb-3">{sec.content}</p>

                      {/* Warm highlights for teacher emphasis points */}
                      {sec.teacherEmphasisPoints?.map((p, pIdx) => (
                        <div
                          key={pIdx}
                          className="my-2.5 p-3 rounded-xl bg-red-50/80 border-r-4 border-red-800 text-red-950 font-medium text-sm leading-relaxed"
                        >
                          ★ نکته مهم و تأکید استاد: {p}
                        </div>
                      ))}

                      {/* Definitions */}
                      {sec.keyDefinitions?.map((def, dIdx) => (
                        <div
                          key={dIdx}
                          className="my-2.5 p-3 rounded-xl bg-amber-50 border-r-4 border-amber-800 text-amber-950 text-sm leading-relaxed"
                        >
                          <strong>تعریف «{def.term}»: </strong>
                          <span>{def.definition}</span>
                        </div>
                      ))}
                    </div>
                  ))}

                  {currentSession.classicNote?.conclusion && (
                    <div className="mt-8 pt-4 border-t border-slate-200">
                      <h3 className="font-bold text-slate-900 mb-2">جمع‌بندی و نتیجه‌گیری</h3>
                      <p className="text-slate-700 leading-relaxed">
                        {currentSession.classicNote.conclusion}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: QUESTIONS */}
              {activeTab === 'questions' && (
                <div>
                  <h1 className="text-2xl font-black text-purple-950 border-b pb-3 mb-6">
                    بانک سؤالات و پرسش‌های {currentSession.sessionTitle}
                  </h1>

                  {currentSession.questions.length === 0 ? (
                    <p className="text-slate-500">در فایل‌های صوتی این جلسه هیچ سؤالی مطرح نشده است.</p>
                  ) : (
                    <div className="space-y-6">
                      {currentSession.questions.map((q, idx) => (
                        <div
                          key={q.id || idx}
                          className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="font-bold text-purple-900 text-sm">
                              سؤال {idx + 1} ({q.type || 'تشریحی'})
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              [{q.partTitle} | {q.fileName} | {q.formattedTime}]
                            </span>
                          </div>

                          {q.topic && (
                            <div className="text-xs text-slate-500 mb-2 font-medium">
                              موضوع: {q.topic}
                            </div>
                          )}

                          <p className="font-semibold text-slate-900 mb-3">{q.questionText}</p>

                          {q.options && q.options.length > 0 && (
                            <div className="space-y-1.5 mb-3 pr-2">
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className="text-slate-700 text-sm">
                                  {oIdx + 1}) {opt}
                                </div>
                              ))}
                            </div>
                          )}

                          <div
                            className={`p-3 rounded-xl text-sm ${
                              q.isAnswerStated
                                ? 'bg-emerald-50 text-emerald-950 border border-emerald-200'
                                : 'bg-slate-50 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <strong>{q.isAnswerStated ? 'پاسخ و تحلیل استاد: ' : 'پاسخ: '}</strong>
                            <span>
                              {q.isAnswerStated && q.answer
                                ? q.answer
                                : 'پاسخ در فایل‌های صوتی این جلسه بیان نشده است.'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: FAITHFUL TRANSCRIPT */}
              {activeTab === 'transcript' && (
                <div>
                  <h1 className="text-2xl font-black text-blue-950 border-b pb-3 mb-6">
                    متن کامل و وفادار به گفتار استاد
                  </h1>

                  <div className="space-y-4">
                    {currentSession.transcriptParagraphs.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl hover:bg-slate-50 transition border-r-2 border-transparent hover:border-slate-300"
                      >
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mb-1">
                          <span>{p.formattedTimeTag}</span>
                          <span
                            className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                              p.speaker.includes('استاد')
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-slate-200 text-slate-800'
                            }`}
                          >
                            {p.speaker}
                          </span>
                        </div>
                        <p className="text-slate-800 leading-relaxed">{p.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
