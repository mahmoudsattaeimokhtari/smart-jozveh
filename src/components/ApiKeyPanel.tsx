import React, { useEffect, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Trash2 } from 'lucide-react';
import { isValidGeminiApiKey } from '../utils/apiKeyStorage';

interface Props {
  apiKey: string;
  onSave: (apiKey: string) => void;
  onClear: () => void;
}

export const ApiKeyPanel: React.FC<Props> = ({ apiKey, onSave, onClear }) => {
  const [value, setValue] = useState(apiKey);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => setValue(apiKey), [apiKey]);

  const save = () => {
    const normalized = value.trim();
    if (!isValidGeminiApiKey(normalized)) {
      setMessage('کلید واردشده ناقص یا نامعتبر است.');
      return;
    }
    onSave(normalized);
    setMessage('کلید فقط در حافظه محلی همین مرورگر ذخیره شد.');
  };

  return (
    <section className="w-full max-w-4xl mx-auto mb-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
        <KeyRound className="h-4 w-4 text-amber-700" />
        کلید شخصی Gemini API
        {apiKey && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="کلید ذخیره شده" />}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            dir="ltr"
            type={visible ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={event => { setValue(event.target.value); setMessage(''); }}
            placeholder="کلید Gemini API را وارد کنید"
            aria-label="کلید Gemini API"
            className="w-full rounded-lg border border-amber-200 bg-white py-2.5 pl-10 pr-3 text-left font-mono text-xs outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button type="button" onClick={() => setVisible(current => !current)}
            aria-label={visible ? 'پنهان کردن کلید' : 'نمایش کلید'}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100">
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <button type="button" onClick={save}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800">
          ذخیره در این مرورگر
        </button>
        {apiKey && (
          <button type="button" onClick={() => { onClear(); setValue(''); setMessage('کلید حذف شد.'); }}
            className="flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2.5 text-xs text-red-700 hover:bg-red-50">
            <Trash2 className="h-4 w-4" /> حذف
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-slate-600">
        کلید به سرور برنامه یا GitHub ارسال نمی‌شود؛ فقط برای درخواست مستقیم مرورگر شما به Google استفاده می‌شود.
      </p>
      {message && <p role="status" className="mt-1 text-xs font-medium text-slate-700">{message}</p>}
    </section>
  );
};
