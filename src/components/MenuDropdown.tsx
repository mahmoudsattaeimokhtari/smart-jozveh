import React, { useEffect, useRef } from 'react';
import {
  PlusCircle,
  FolderArchive,
  BookOpen,
  Settings,
  FileCode,
  HelpCircle,
  Sparkles,
  Download,
} from 'lucide-react';

interface MenuDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onNewJob: () => void;
  onOpenLibrary: () => void;
  onOpenReader: () => void;
  onOpenSettings: () => void;
  onOpenPrompt: () => void;
  onOpenHelp: () => void;
  onOpenInstall: () => void;
  onLoadSample: () => void;
}

export const MenuDropdown: React.FC<MenuDropdownProps> = ({
  isOpen,
  onClose,
  onNewJob,
  onOpenLibrary,
  onOpenReader,
  onOpenSettings,
  onOpenPrompt,
  onOpenHelp,
  onOpenInstall,
  onLoadSample,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute top-16 right-4 sm:right-8 z-40 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-400">
        منوی جزوه‌نگار هوشمند
      </div>

      <div className="py-1">
        <button
          onClick={() => {
            onNewJob();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition text-right"
        >
          <PlusCircle className="w-4 h-4 text-emerald-600" />
          <span>شروع کار جدید</span>
        </button>

        <button
          onClick={() => {
            onOpenLibrary();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition text-right"
        >
          <FolderArchive className="w-4 h-4 text-blue-600" />
          <span>کارهای قبلی و کتابخانه</span>
        </button>

        <button
          onClick={() => {
            onOpenReader();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition text-right"
        >
          <BookOpen className="w-4 h-4 text-amber-600" />
          <span>کتابخوان و مطالعه داخلی</span>
        </button>

        <div className="my-1 border-t border-slate-100" />

        <button
          onClick={() => {
            onOpenSettings();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition text-right"
        >
          <Settings className="w-4 h-4 text-slate-500" />
          <span>تنظیمات خروجی و فونت‌ها</span>
        </button>

        <button
          onClick={() => {
            onOpenPrompt();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition text-right"
        >
          <FileCode className="w-4 h-4 text-purple-600" />
          <span>پرامپت پردازش هوشمند</span>
        </button>

        <button
          onClick={() => {
            onLoadSample();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-amber-800 hover:bg-amber-50 transition text-right"
        >
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>بارگذاری جلسه نمونه (تست فوری)</span>
        </button>

        <div className="my-1 border-t border-slate-100" />

        <button
          onClick={() => {
            onOpenInstall();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50/50 hover:bg-blue-100/60 transition text-right"
        >
          <Download className="w-4 h-4 text-blue-600" />
          <span>نصب ویندوز و اندروید (EXE / APK)</span>
        </button>

        <button
          onClick={() => {
            onOpenHelp();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition text-right"
        >
          <HelpCircle className="w-4 h-4 text-slate-500" />
          <span>راهنمای کاربری سامانه</span>
        </button>
      </div>
    </div>
  );
};
