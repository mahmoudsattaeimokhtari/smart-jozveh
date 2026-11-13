import React, { useState } from 'react';
import { X, FileCode, Check, RotateCcw } from 'lucide-react';
import { DEFAULT_PROMPT } from '../types';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: string;
  onSavePrompt: (prompt: string) => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  onClose,
  prompt,
  onSavePrompt,
}) => {
  const [currentText, setCurrentText] = useState(prompt);

  if (!isOpen) return null;

  const handleSave = () => {
    onSavePrompt(currentText);
    onClose();
  };

  const handleReset = () => {
    setCurrentText(DEFAULT_PROMPT);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-purple-700" />
            <h2 className="text-base font-bold text-slate-900">مشاهده و ویرایش پرامپت پردازش هوشمند</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Textarea */}
        <div className="p-6 flex-1 overflow-y-auto">
          <p className="text-xs text-slate-500 mb-2 leading-relaxed">
            این دستور به عنوان چارچوب استاندارد به مدل هوش مصنوعی ارسال می‌شود تا نحوه استخراج کلمات،
            درج ارجاع‌های زمانی، جمع‌آوری سؤالات و تولید جزوه کلاسیک را هدایت کند:
          </p>
          <textarea
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
            rows={14}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-sans leading-relaxed text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-400 font-normal"
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>بازنشانی به متن پیش‌فرض اصلی</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition"
            >
              انصراف
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>ذخیره پرامپت</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
