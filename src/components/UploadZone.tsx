import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileAudio,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  AlertTriangle,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from 'lucide-react';
import { AudioFileItem } from '../types';
import { organizeFilesIntoHierarchy, groupFilesBySessionAndPart } from '../utils/fileOrganizer';

interface UploadZoneProps {
  files: AudioFileItem[];
  onFilesChanged: (items: AudioFileItem[]) => void;
  onStartProcessing: () => void;
  hasPreviousWork: boolean;
  onResumePrevious: () => void;
  courseTitle: string;
  setCourseTitle: (val: string) => void;
  instructorName: string;
  setInstructorName: (val: string) => void;
  onLoadSample: () => void;
  isProcessing: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  files,
  onFilesChanged,
  onStartProcessing,
  hasPreviousWork,
  onResumePrevious,
  courseTitle,
  setCourseTitle,
  instructorName,
  setInstructorName,
  onLoadSample,
  isProcessing,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showMetadataInputs, setShowMetadataInputs] = useState(false);
  const [showHierarchyReview, setShowHierarchyReview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const audioFiles = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('audio/') ||
        /\.(mp3|wav|m4a|aac|ogg|wma|opus|flac)$/i.test(file.name)
      );

      if (audioFiles.length > 0) {
        const newItems = organizeFilesIntoHierarchy(audioFiles);
        onFilesChanged([...files, ...newItems.filter(item => !files.some(old => old.name === item.name && old.size === item.size && old.file?.lastModified === item.file?.lastModified))]);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const audioFiles = Array.from(e.target.files).filter((file) =>
        file.type.startsWith('audio/') ||
        /\.(mp3|wav|m4a|aac|ogg|wma|opus|flac)$/i.test(file.name)
      );
      if (audioFiles.length > 0) {
        const newItems = organizeFilesIntoHierarchy(audioFiles);
        onFilesChanged([...files, ...newItems.filter(item => !files.some(old => old.name === item.name && old.size === item.size && old.file?.lastModified === item.file?.lastModified))]);
      }
    }
  };

  const grouped = groupFilesBySessionAndPart(files);
  const totalFiles = files.length;
  const totalSizeMb = (files.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(1);
  const ambiguousFiles = files.filter((f) => f.isAmbiguous);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center py-4 px-2">
      {/* Intro Header (Concise & Clean) */}
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
          تبدیل صوت کلاس به متن، سؤالات و جزوه Word
        </h1>
        <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
          فایل‌های صوتی جلسات را انتخاب کنید. سامانه جلسات، قسمت‌ها و فایل‌ها را خودکار مرتب کرده
          و ۳ خروجی مستقل <span className="font-semibold text-slate-800">Word (.docx)</span> و یک{' '}
          <span className="font-semibold text-slate-800">کتاب الکترونیک (.epub)</span> تحویل می‌دهد.
        </p>
      </div>

      {/* Main Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-amber-600 bg-amber-50/70 scale-[0.99]'
            : files.length > 0
            ? 'border-slate-300 bg-white shadow-sm hover:border-slate-400'
            : 'border-slate-300 bg-white shadow-sm hover:border-amber-500 hover:bg-slate-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus"
          className="hidden"
          onChange={handleFileInputChange}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is standard for folder upload
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={handleFileInputChange}
        />

        <div className="flex flex-col items-center justify-center">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
              files.length > 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {files.length > 0 ? (
              <FileAudio className="w-7 h-7" />
            ) : (
              <UploadCloud className="w-7 h-7" />
            )}
          </div>

          {files.length === 0 ? (
            <>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                فایل‌های صوتی را اینجا بکشید یا کلیک کنید
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                پشتیبانی از انواع فرمت‌های MP3، M4A، WAV، OGG و ساختار پوشه‌ای
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  انتخاب فایل‌ها
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    folderInputRef.current?.click();
                  }}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>انتخاب پوشه کامل</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-bold text-slate-900 mb-1">
                {totalFiles} فایل صوتی انتخاب شد ({totalSizeMb} مگابایت)
              </div>
              <p className="text-xs text-slate-500 mb-2">
                تشخیص خودکار: {grouped.length} جلسه و{' '}
                {grouped.reduce((acc, s) => acc + s.parts.length, 0)} قسمت مجزا
              </p>
              <span className="text-xs text-amber-700 font-medium underline">
                برای افزودن فایل‌های بیشتر کلیک کنید
              </span>
            </>
          )}
        </div>
      </div>

      {/* Ambiguous files notice if any */}
      {ambiguousFiles.length > 0 && (
        <div className="w-full mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              شماره جلسه یا قسمت {ambiguousFiles.length} فایل از نام آن‌ها کاملاً قطعی نبود؛ ترتیب موقت
              طبیعی اعمال شد.
            </span>
          </div>
          <button
            onClick={() => setShowHierarchyReview(!showHierarchyReview)}
            className="text-xs font-semibold text-amber-900 underline hover:text-amber-950 mr-2 shrink-0"
          >
            {showHierarchyReview ? 'بستن بازبینی' : 'بررسی و اصلاح اختیاری'}
          </button>
        </div>
      )}

      {/* Optional Metadata Drawer (Instructor Name & Course Title) */}
      <div className="w-full mt-3">
        <button
          onClick={() => setShowMetadataInputs(!showMetadataInputs)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition py-1"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>مشخصات اختیاری (نام استاد و عنوان درس)</span>
          {showMetadataInputs ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {showMetadataInputs && (
          <div className="mt-2 p-3 bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                عنوان درس (اختیاری):
              </label>
              <input
                type="text"
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                placeholder="مثال: یادگیری ماشین پیشرفته"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                نام استاد (اختیاری):
              </label>
              <input
                type="text"
                value={instructorName}
                onChange={(e) => setInstructorName(e.target.value)}
                placeholder="مثال: دکتر رضایی"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* Optional Hierarchy Inspector & Editor */}
      {showHierarchyReview && files.length > 0 && (
        <div className="w-full mt-3 p-4 bg-white border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
          <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
            <span>ساختار سلسله‌مراتبی: جلسه ← قسمت ← فایل صوتی</span>
            <span className="text-[11px] text-slate-500 font-normal">
              ترتیب عددی خودکار اعمال شده است
            </span>
          </div>
          <div className="space-y-3 text-xs">
            {grouped.map((sess) => (
              <div key={sess.sessionNumber} className="border-r-2 border-amber-600 pr-3 py-1">
                <div className="font-bold text-slate-900">{sess.sessionName}</div>
                {sess.parts.map((part) => (
                  <div key={part.partNumber} className="mr-3 mt-1.5">
                    <div className="font-semibold text-slate-700">{part.partName}</div>
                    <div className="mr-3 space-y-1 mt-1 text-slate-600">
                      {part.files.map((file, fIdx) => (
                        <div key={file.id} className="flex items-center justify-between py-0.5">
                          <span>
                            {fIdx + 1}. {file.name}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {(file.size / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Single-Click Action Button & Secondary Actions */}
      <div className="w-full mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={onStartProcessing}
          disabled={files.length === 0 || isProcessing}
          className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
            files.length > 0 && !isProcessing
              ? 'bg-amber-800 hover:bg-amber-900 text-white shadow-amber-900/20 active:scale-95'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          <span>شروع پردازش هوشمند و ساخت خروجی‌ها</span>
        </button>

        {hasPreviousWork && (
          <button
            onClick={onResumePrevious}
            className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ادامه کار قبلی</span>
          </button>
        )}

        {files.length === 0 && (
          <button
            onClick={onLoadSample}
            className="w-full sm:w-auto px-4 py-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 hover:bg-amber-100/70 text-amber-900 font-medium text-xs transition flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            <span>تست فوری با جلسه نمونه</span>
          </button>
        )}
      </div>
    </div>
  );
};
