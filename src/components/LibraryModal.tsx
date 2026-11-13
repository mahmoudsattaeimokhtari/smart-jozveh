import React from 'react';
import {
  X,
  FolderArchive,
  BookOpen,
  FileText,
  HelpCircle,
  BookMarked,
  Download,
  Trash2,
  Calendar,
  Layers,
} from 'lucide-react';
import { ProcessedSession, AppSettings } from '../types';
import {
  generateFullTranscriptDocx,
  generateQuestionsDocx,
  generateClassicNoteDocx,
} from '../utils/docxGenerator';
import { generateSessionEpub } from '../utils/epubGenerator';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ProcessedSession[];
  settings: AppSettings;
  onSelectForReader: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  sessions,
  settings,
  onSelectForReader,
  onDeleteSession,
}) => {
  if (!isOpen) return null;

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <FolderArchive className="w-5 h-5 text-blue-700" />
            <h2 className="text-base font-bold text-slate-900">کتابخانه خروجی‌ها و جلسات ذخیره‌شده</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              هنوز جلسه‌ای پردازش و ذخیره نشده است.
            </div>
          ) : (
            sessions.map((sess) => (
              <div
                key={sess.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base mb-1">
                      {sess.sessionTitle}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      {sess.courseTitle && <span>درس: {sess.courseTitle}</span>}
                      {sess.instructorName && <span>استاد: {sess.instructorName}</span>}
                      {sess.date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{sess.date}</span>
                        </span>
                      )}
                      <span>{sess.transcriptParagraphs?.length || 0} پاراگراف</span>
                      <span>{sess.questions?.length || 0} سؤال</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectForReader(sess.id)}
                      className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>مطالعه</span>
                    </button>
                    <button
                      onClick={() => onDeleteSession(sess.id)}
                      title="حذف از کتابخانه"
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Individual Download Chips */}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100 text-xs">
                  <button
                    onClick={async () => {
                      const blob = await generateFullTranscriptDocx(sess, settings);
                      downloadBlob(blob, `${sess.sessionTitle} ـ متن کامل.docx`);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>متن کامل Word</span>
                  </button>

                  <button
                    onClick={async () => {
                      const blob = await generateQuestionsDocx(sess, settings);
                      downloadBlob(blob, `${sess.sessionTitle} ـ سؤالات.docx`);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 transition"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>سؤالات Word</span>
                  </button>

                  <button
                    onClick={async () => {
                      const blob = await generateClassicNoteDocx(sess, settings);
                      downloadBlob(blob, `${sess.sessionTitle} ـ جزوه کلاسیک.docx`);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition"
                  >
                    <BookMarked className="w-3.5 h-3.5" />
                    <span>جزوه کلاسیک Word</span>
                  </button>

                  <button
                    onClick={async () => {
                      const blob = await generateSessionEpub(sess);
                      downloadBlob(blob, `${sess.sessionTitle} ـ کتاب الکترونیک.epub`);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>کتاب EPUB</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
