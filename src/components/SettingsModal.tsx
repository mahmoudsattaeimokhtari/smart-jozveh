import React, { useState } from 'react';
import { X, Settings, Check, RotateCcw } from 'lucide-react';
import { AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../utils/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(formData);
    onClose();
  };

  const handleReset = () => {
    setFormData(DEFAULT_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">تنظیمات خروجی و فونت‌ها</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* Persian body font size */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              اندازه متن اصلی در Word (پیش‌فرض ۱۴):
            </label>
            <input
              type="number"
              min="10"
              max="24"
              value={formData.bodyFontSize}
              onChange={(e) =>
                setFormData({ ...formData, bodyFontSize: parseInt(e.target.value, 10) || 14 })
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          {/* Persian heading font size */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              اندازه تیترهای فارسی در Word (پیش‌فرض ۱۸):
            </label>
            <input
              type="number"
              min="12"
              max="28"
              value={formData.headingFontSize}
              onChange={(e) =>
                setFormData({ ...formData, headingFontSize: parseInt(e.target.value, 10) || 18 })
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          {/* Persian Body font name */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              فونت متن اصلی فارسی (پیش‌فرض B Nazanin):
            </label>
            <input
              type="text"
              value={formData.persianBodyFont}
              onChange={(e) => setFormData({ ...formData, persianBodyFont: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          {/* Persian Heading font name */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              فونت تیترهای فارسی (پیش‌فرض B Zar):
            </label>
            <input
              type="text"
              value={formData.persianHeadingFont}
              onChange={(e) => setFormData({ ...formData, persianHeadingFont: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          {/* English font */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              فونت عبارات و واژگان انگلیسی (ثابت Times New Roman):
            </label>
            <input
              type="text"
              value={formData.englishFont}
              onChange={(e) => setFormData({ ...formData, englishFont: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          {/* Max chunk duration */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              سقف زمان قطعه‌بندی محلی صوت (دقیقه، پیش‌فرض ۳۰):
            </label>
            <input
              type="number"
              min="5"
              max="60"
              value={formData.maxChunkMinutes}
              onChange={(e) =>
                setFormData({ ...formData, maxChunkMinutes: parseInt(e.target.value, 10) || 30 })
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              فایل‌های طولانی‌تر پیش از ارسال روی مرورگر شما به این اندازه بریده می‌شوند.
            </p>
          </div>

          <p className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            کلید Gemini از بخش بالای صفحه مدیریت می‌شود و داخل تنظیمات خروجی ذخیره نمی‌شود.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>بازنشانی به پیش‌فرض</span>
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
              className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>ذخیره تنظیمات</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
