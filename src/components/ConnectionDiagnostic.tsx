import React, { useEffect, useRef, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Loader2, Network } from 'lucide-react';
import type { AppSettings } from '../types';
import {
  GEMINI_API_VERSION,
  GEMINI_GENERATE_ENDPOINT,
  GEMINI_MODEL,
  runBrowserConnectionDiagnostic,
  type ConnectionDiagnosticResult,
} from '../services/geminiClient';

interface Props { settings: AppSettings }

export const ConnectionDiagnostic: React.FC<Props> = ({ settings }) => {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ConnectionDiagnosticResult | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setResult(null);
    try {
      const value = await runBrowserConnectionDiagnostic(settings, controller.signal);
      setResult(value);
    } catch (error: any) {
      setResult({
        route: 'browser-direct',
        endpoint: GEMINI_GENERATE_ENDPOINT, apiVersion: GEMINI_API_VERSION, model: GEMINI_MODEL,
        ok: false, status: null, durationMs: 0,
        raw: `${error?.name || 'Error'}: ${error?.message || String(error)}`,
      });
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setRunning(false);
    }
  };

  return (
    <section className="w-full max-w-4xl mx-auto mb-3 rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button" onClick={() => setOpen(value => !value)}
        className="w-full flex items-center justify-between gap-3 p-3 text-right"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Activity className="w-4 h-4 text-amber-700" />
          عیب‌یابی سریع اتصال Gemini
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 p-3 space-y-3 text-xs">
          <div dir="ltr" className="rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-600 break-all">
            POST {GEMINI_GENERATE_ENDPOINT}<br />API: {GEMINI_API_VERSION} · Model: {GEMINI_MODEL} · Prompt: hello
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" disabled={running || !settings.userGeminiApiKey} onClick={run}
              className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
              تست مستقیم از مرورگر
            </button>
          </div>
          <p className="text-[11px] leading-5 text-slate-500">
            این تست مستقیماً از همین صفحهٔ HTTPS به Google ارسال می‌شود و هیچ سرور میانی در کار نیست.
          </p>

          {result && (
            <div className={`rounded-lg border p-3 ${result.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <div className="mb-2 font-bold">
                {result.ok ? 'اتصال موفق' : 'اتصال ناموفق'} · HTTP {result.status ?? 'NETWORK'} · {result.durationMs}ms
              </div>
              {result.attempts && result.attempts.length > 0 && (
                <div className="mb-2 space-y-1">
                  {result.attempts.map((attempt, index) => (
                    <div key={`${attempt.route}-${index}`} dir="ltr" className="font-mono text-[11px]">
                      {attempt.route} {attempt.proxy || '(no proxy)'} → {attempt.status ?? 'NETWORK'} · {attempt.durationMs}ms
                    </div>
                  ))}
                </div>
              )}
              <pre dir="ltr" className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-950 p-3 text-left font-mono text-[11px] text-slate-100">
                {result.raw || '(empty response)'}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
