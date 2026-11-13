import { useEffect, useRef, useState } from 'react';
import { get, set } from 'idb-keyval';
import JSZip from 'jszip';
import { Files, FolderOpen, Play, Square, Download, FileText, Package } from 'lucide-react';
import type { BatchSession, BatchState, NotebookBundle } from '../types/batch';
import { ingestTextFiles, sessionGroups } from '../utils/textIngestion';
import { analyzeTextSession } from '../services/batchTextClient';
import { blocksMarkdown, classicBlocks, questionBlocks, createBatchDocuments, saveDownload } from '../utils/batchDocuments';

const STORAGE = 'smart_jozveh_batch_state_v1';
const defaults: BatchState = { sessions: [], bundles: [], autoPdf: true, autoDownload: true };
const sessionName = (n: number) => `Session_${String(n).padStart(2, '0')}`;
const statusText = { pending: 'در انتظار', processing: 'در حال پردازش', done: 'آماده', error: 'ناموفق؛ قابل ادامه' };

export default function BatchTextPanel({ onBusyChange }: { onBusyChange?: (busy: boolean) => void }) {
  const [state, setState] = useState<BatchState>(defaults);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const stateRef = useRef(state);
  const controllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const commit = async (next: BatchState) => {
    stateRef.current = next; setState(next); await set(STORAGE, next);
  };
  const updateSession = async (session: BatchSession) => {
    await commit({ ...stateRef.current, sessions: stateRef.current.sessions.map(s => s.id === session.id ? session : s) });
  };
  useEffect(() => {
    let active = true;
    get<BatchState>(STORAGE).then(saved => {
      if (!active) return;
      if (saved) {
        const value = { ...defaults, ...saved, sessions: saved.sessions.map(s => s.status === 'processing' ? { ...s, status: 'pending' as const } : s) };
        stateRef.current = value; setState(value);
      }
      setReady(true);
    }).catch(() => setErrors(['خواندن حافظه مرورگر ناموفق بود؛ برای حفظ نتایج ذخیره‌شده، پردازش جدید شروع نشد.']));
    return () => { active = false; controllerRef.current?.abort(); };
  }, []);

  const ingest = async (files: File[]) => {
    if (!files.length || busy) return;
    setBusy(true); onBusyChange?.(true); setErrors([]);
    try {
      const imported = await ingestTextFiles(files);
      const sessions = [...stateRef.current.sessions];
      for (const item of imported.sessions) {
        const existing = sessions.find(s => s.number === item.number);
        if (existing && existing.id !== item.id) imported.errors.push(`جلسه ${item.number} قبلاً با متن دیگری وارد شده است. برای جایگزینی، دسته جدید شروع کنید؛ متن قبلی نگه‌داری شد.`);
        else if (!existing) sessions.push(item);
      }
      await commit({ ...stateRef.current, sessions: sessions.sort((a, b) => a.number - b.number) });
      setErrors(imported.errors);
      setMessage(`${imported.sessions.length} جلسه شناسایی شد. ${imported.errors.length} مورد نیاز به بررسی دارد.`);
    } catch (error: any) { setErrors([error.message]); }
    finally { setBusy(false); onBusyChange?.(false); }
  };

  const buildBundle = async (items: BatchSession[], start: number, end: number, auto = false) => {
    const completed = items.filter(s => s.status === 'done');
    if (!completed.length) throw new Error('هنوز جلسه آماده‌ای در این گروه نیست.');
    const signature = JSON.stringify(completed.map(s => [s.id, s.analysis]));
    let bundle = stateRef.current.bundles.find(b => b.start === start && b.signature === signature);
    if (!bundle) {
      setMessage(`ساخت PDF فارسی جلسات ${completed.map(s => s.number).join('، ')}…`);
      const { buildNotebookPdf } = await import('../utils/batchPdf');
      const pdf = await buildNotebookPdf(completed);
      bundle = { id: `notebook-${start}-${end}`, start, end, numbers: completed.map(s => s.number), signature, pdf } satisfies NotebookBundle;
      await commit({ ...stateRef.current, bundles: [...stateRef.current.bundles.filter(b => b.start !== start), bundle] });
    }
    if (!auto || stateRef.current.autoDownload) saveDownload(bundle.pdf, `NotebookLM_Sessions_${bundle.numbers.map(n => String(n).padStart(2, '0')).join('-')}.pdf`);
    return bundle;
  };

  const run = async () => {
    if (busy || !ready || !stateRef.current.sessions.length) return;
    const controller = new AbortController(); controllerRef.current = controller;
    setBusy(true); onBusyChange?.(true); setErrors([]);
    const process = async () => {
      for (const original of [...stateRef.current.sessions]) {
        if (controller.signal.aborted) break;
        if (original.status === 'done') continue;
        let session = { ...original, status: 'processing' as const, error: undefined } as BatchSession;
        await updateSession(session);
        try {
          const analysis = session.analysis || await analyzeTextSession(session, controller.signal, setMessage);
          session = { ...session, analysis }; await updateSession(session);
          controller.signal.throwIfAborted();
          setMessage(`ساخت سه فایل Word جلسه ${session.number}…`);
          const documents = await createBatchDocuments(session);
          session = { ...session, documents, status: 'done' }; await updateSession(session);
        } catch (error: any) {
          session = { ...session, status: controller.signal.aborted ? 'pending' : 'error', error: controller.signal.aborted ? undefined : error.message };
          await updateSession(session);
          if (!controller.signal.aborted) setErrors(previous => [...previous, `جلسه ${session.number}: ${error.message}`]);
        }
        if (!controller.signal.aborted && stateRef.current.autoPdf) {
          for (const group of sessionGroups(stateRef.current.sessions).filter(g => g.complete)) {
            const signature = JSON.stringify(group.sessions.map(s => [s.id, s.analysis]));
            if (stateRef.current.bundles.some(b => b.start === group.start && b.signature === signature)) continue;
            try { await buildBundle(group.sessions, group.start, group.end, true); }
            catch (error: any) { setErrors(previous => [...previous, `PDF گروه ${group.start} تا ${group.end}: ${error.message}`]); }
          }
        }
      }
    };
    try {
      if (navigator.locks) await navigator.locks.request('smart-jozveh-batch-text', { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('پردازش متن در تب دیگری فعال است.');
        await process();
      });
      else await process();
      setMessage(controller.signal.aborted ? 'پردازش متوقف شد؛ نتایج قبلی محفوظ‌اند.' : 'پردازش دسته پایان یافت؛ وضعیت هر جلسه و فایل‌های آماده در جدول دیده می‌شود.');
    } catch (error: any) { setErrors(previous => [...previous, error.message]); }
    finally { controllerRef.current = null; setBusy(false); onBusyChange?.(false); }
  };

  const manualBundle = async (start: number, end: number, items: BatchSession[]) => {
    setBusy(true); onBusyChange?.(true);
    try { await buildBundle(items, start, end); setMessage('PDF ساخته و برای دانلود آماده شد.'); }
    catch (error: any) { setErrors(previous => [...previous, error.message]); }
    finally { setBusy(false); onBusyChange?.(false); }
  };
  const downloadSession = async (session: BatchSession) => {
    if (!session.documents) return;
    const zip = new JSZip(); const name = sessionName(session.number);
    zip.file(`${name}_Transcript_and_Classic.docx`, session.documents.combined);
    zip.file(`${name}_Questions.docx`, session.documents.questions);
    zip.file(`${name}_Classic.docx`, session.documents.classic);
    zip.file(`${name}_Classic.md`, blocksMarkdown(classicBlocks(session)));
    zip.file(`${name}_Questions.md`, blocksMarkdown(questionBlocks(session)));
    for (const [i, source] of session.sources.entries()) zip.file(`${name}_Original_${i + 1}.txt`, source.text);
    saveDownload(await zip.generateAsync({ type: 'blob' }), `${name}_Outputs.zip`);
  };
  const downloadAll = async () => {
    setBusy(true); onBusyChange?.(true);
    try {
      const zip = new JSZip();
      for (const session of stateRef.current.sessions.filter(s => s.status === 'done' && s.documents)) {
        const folder = zip.folder(sessionName(session.number))!;
        folder.file('01_Transcript_and_Classic.docx', session.documents!.combined);
        folder.file('02_Questions.docx', session.documents!.questions);
        folder.file('03_Classic.docx', session.documents!.classic);
        folder.file('Classic.md', blocksMarkdown(classicBlocks(session)));
        folder.file('Questions.md', blocksMarkdown(questionBlocks(session)));
        session.sources.forEach((source, i) => folder.file(`Original_${i + 1}.txt`, source.text));
      }
      for (const bundle of stateRef.current.bundles) zip.file(`NotebookLM/Sessions_${bundle.numbers.join('-')}.pdf`, bundle.pdf);
      zip.file('README.txt', 'Source text is preserved in Original files. Questions are separated into classroom and authored practice questions. PDFs contain selectable Persian text and embedded Vazirmatn fonts.');
      saveDownload(await zip.generateAsync({ type: 'blob' }), 'SmartJozveh_Text_Batch.zip');
    } catch (error: any) { setErrors(previous => [...previous, error.message]); }
    finally { setBusy(false); onBusyChange?.(false); }
  };
  const reset = async () => {
    if (busy) return;
    try {
      if (stateRef.current.sessions.length) await set(`${STORAGE}:archive:${Date.now()}`, stateRef.current);
      await commit({ ...defaults, autoPdf: stateRef.current.autoPdf, autoDownload: stateRef.current.autoDownload });
      setErrors([]); setMessage('دسته جدید آماده ورود متن است؛ دسته قبلی در حافظه مرورگر بایگانی شد.');
    } catch (error: any) { setErrors([error.message]); }
  };
  const done = state.sessions.filter(s => s.status === 'done').length;

  return <section className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm" dir="rtl">
    <h1 className="text-xl font-bold text-slate-900">پردازش دسته‌ای متن جلسات و بسته‌بندی NotebookLM</h1>
    <p className="my-3 text-sm leading-7 text-slate-600">متن چند جلسه را وارد کنید. شماره جلسه از نام فایل یا هدر تشخیص داده می‌شود؛ متن اصلی حفظ می‌شود و برای هر جلسه سه فایل Word، بانک سؤال و جزوه زمان‌دار آماده خواهد شد.</p>
    <input ref={inputRef} type="file" className="hidden" multiple accept=".md,.txt,.json" onChange={event => { void ingest(Array.from(event.target.files || [])); event.target.value = ''; }} />
    {/* @ts-expect-error Firefox supports webkitdirectory for directory selection. */}
    <input ref={folderRef} type="file" className="hidden" multiple webkitdirectory="" onChange={event => { void ingest(Array.from(event.target.files || [])); event.target.value = ''; }} />
    <div className="flex flex-wrap gap-2 my-4">
      <button disabled={!ready || busy} onClick={() => inputRef.current?.click()} className="batch-button"><Files size={17} />انتخاب چند فایل متنی</button>
      <button disabled={!ready || busy} onClick={() => folderRef.current?.click()} className="batch-button"><FolderOpen size={17} />انتخاب پوشه جلسات</button>
      <button disabled={!ready || busy || !state.sessions.some(s => s.status !== 'done')} onClick={() => void run()} className="batch-button bg-slate-900! text-white!"><Play size={17} />پردازش / ادامه جلسات</button>
      {busy && controllerRef.current && <button onClick={() => controllerRef.current?.abort()} className="batch-button text-red-700!"><Square size={17} />توقف و حفظ نتایج</button>}
      <button disabled={busy || !done} onClick={() => void downloadAll()} className="batch-button"><Package size={17} />دانلود همه خروجی‌ها ZIP</button>
      <button disabled={busy || !ready} onClick={() => void reset()} className="batch-button">شروع دسته جدید</button>
    </div>
    <div className="rounded-xl bg-amber-50 p-3 text-xs leading-6 space-y-2">
      <label className="flex gap-2"><input type="checkbox" checked={state.autoPdf} disabled={!ready || busy} onChange={event => void commit({ ...stateRef.current, autoPdf: event.target.checked }).catch(error => setErrors([error.message]))} />ساخت خودکار PDF پس از آماده‌شدن هر گروه کامل ۵ جلسه‌ای (۱ تا ۵، ۶ تا ۱۰ و…)</label>
      <label className="flex gap-2"><input type="checkbox" checked={state.autoDownload} disabled={!ready || busy} onChange={event => void commit({ ...stateRef.current, autoDownload: event.target.checked }).catch(error => setErrors([error.message]))} />دانلود خودکار PDF ساخته‌شده؛ نسخه فایل در همین مرورگر نیز حفظ می‌شود</label>
    </div>
    <p role="status" className="my-4 text-sm text-slate-700">{message || (!ready ? 'در حال بازیابی دسته قبلی…' : `${done} جلسه از ${state.sessions.length} جلسه آماده است.`)}</p>
    {errors.length > 0 && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 space-y-2">{errors.map((error, i) => <p key={i} className="whitespace-pre-wrap break-words">{error}</p>)}</div>}
    {!!state.sessions.length && <div className="overflow-x-auto my-4"><table className="w-full text-sm text-right"><thead><tr className="border-b"><th className="p-2">جلسه</th><th>فایل‌ها</th><th>وضعیت</th><th>خروجی‌ها</th></tr></thead><tbody>
      {state.sessions.map(session => <tr key={session.id} className="border-b align-top"><td className="p-2 font-bold">{session.number.toLocaleString('fa-IR')} — {session.title}</td>
        <td className="p-2 text-xs max-w-60 break-words">{session.sources.map(s => s.name).join('، ')}</td>
        <td className="p-2">{statusText[session.status]}{session.error && <p className="text-red-700 text-xs max-w-60 whitespace-pre-wrap">{session.error}</p>}</td>
        <td className="p-2">{session.documents && <div className="flex flex-wrap gap-2">
          <button disabled={busy} className="batch-link" onClick={() => saveDownload(session.documents!.combined, `${sessionName(session.number)}_Transcript_and_Classic.docx`)}>متن و جزوه Word</button>
          <button disabled={busy} className="batch-link" onClick={() => saveDownload(session.documents!.questions, `${sessionName(session.number)}_Questions.docx`)}>بانک سؤال Word</button>
          <button disabled={busy} className="batch-link" onClick={() => saveDownload(session.documents!.classic, `${sessionName(session.number)}_Classic.docx`)}>جزوه کلاسیک Word</button>
          <button disabled={busy} className="batch-link" onClick={() => void downloadSession(session).catch(error => setErrors([error.message]))}>بسته جلسه ZIP</button>
        </div>}</td></tr>)}
    </tbody></table></div>}
    {sessionGroups(state.sessions).map(group => <div key={group.start} className="my-2 rounded-xl border border-slate-200 p-3 flex items-center justify-between flex-wrap gap-2">
      <span className="text-sm">گروه جلسات {group.start} تا {group.end} — {group.complete ? 'کامل' : 'ناقص؛ PDF فقط شامل جلسات آماده خواهد بود'}</span>
      <button disabled={busy || !group.sessions.some(s => s.status === 'done')} className="batch-button" onClick={() => void manualBundle(group.start, group.end, group.sessions)}><Download size={16} />PDF برای NotebookLM</button>
    </div>)}
    <p className="mt-4 text-xs leading-6 text-slate-500"><FileText className="inline h-4 w-4" />متن‌ها و خروجی‌ها در همین مرورگر ذخیره می‌شوند. فایل اصلی به‌صورت TXT نیز در ZIP قرار می‌گیرد. برچسب زمانی موجود حفظ می‌شود؛ برای ورودی بدون زمان، زمان ساختگی تولید نمی‌شود.</p>
  </section>;
}
