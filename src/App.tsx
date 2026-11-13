/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect , useCallback} from 'react';
import confetti from 'canvas-confetti';
import { AudioFileItem, ProcessedSession, AppSettings, DEFAULT_PROMPT } from './types';
import { Header } from './components/Header';
import { MenuDropdown } from './components/MenuDropdown';
import { UploadZone } from './components/UploadZone';
import { ProgressView, ProcessingStep } from './components/ProgressView';
import { OutputView } from './components/OutputView';
import { ReaderModal } from './components/ReaderModal';
import { LibraryModal } from './components/LibraryModal';
import { SettingsModal } from './components/SettingsModal';
import { PromptModal } from './components/PromptModal';
import { HelpModal } from './components/HelpModal';
import { InstallModal } from './components/InstallModal';
import { ConnectionDiagnostic } from './components/ConnectionDiagnostic';
import { ApiKeyPanel } from './components/ApiKeyPanel';
import { DEFAULT_CHUNK_MINUTES, sliceAudioFile } from './utils/audioChunker';
import { groupFilesBySessionAndPart } from './utils/fileOrganizer';
import {
  loadSessions,
  saveSession,
  deleteSession,
  loadSettings,
  saveSettings,
  loadCustomPrompt,
  saveCustomPrompt,
  loadQueueState,
  saveQueueState,
  loadUploadedFiles,
  saveUploadedFiles,
  QueueStateSnapshot,
  DEFAULT_SETTINGS,
} from './utils/storage';
import {
  createGeminiClient,
  runBrowserConnectionDiagnostic,
  transcribeChunk,
  synthesizeSession,
  wait,
} from './services/geminiClient';
import { SAMPLE_SESSION } from './utils/sampleData';
import { clearGeminiApiKey, saveGeminiApiKey } from './utils/apiKeyStorage';

export default function App() {
  const [initialized, setInitialized] = useState(false);
  const [storageError, setStorageError] = useState('');
  // App views: 'upload' | 'progress' | 'output'
  const [currentView, setCurrentView] = useState<'upload' | 'progress' | 'output'>('upload');
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');

  // Files and active processing state
  const [files, setFiles] = useState<AudioFileItem[]>([]);
  const [sessions, setSessions] = useState<ProcessedSession[]>([]);
  const [activeSession, setActiveSession] = useState<ProcessedSession | null>(null);
  const [queueSnapshot, setQueueSnapshot] = useState<QueueStateSnapshot | null>(null);

  // Optional course info
  const [courseTitle, setCourseTitle] = useState('');
  const [instructorName, setInstructorName] = useState('');

  // Settings & Prompt
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [customPrompt, setCustomPrompt] = useState<string>(DEFAULT_PROMPT);

  // Progress metrics
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [completedChunksCount, setCompletedChunksCount] = useState<number>(0);
  const [totalChunksCount, setTotalChunksCount] = useState<number>(0);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [currentPartName, setCurrentPartName] = useState<string>('');
  const [currentSessionTitle, setCurrentSessionTitle] = useState<string>('');
  const [processingErrors, setProcessingErrors] = useState<string[]>([]);

  // Modals
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReaderOpen, setIsReaderOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isInstallOpen, setIsInstallOpen] = useState(false);

  // AbortController ref for cleaning up async operations
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Connectivity
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // PWA Install Prompt Event
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Save files automatically whenever user adds/changes them so they never vanish
  const handleFilesChanged = useCallback(async (updatedFiles: AudioFileItem[]) => {
    setFiles(updatedFiles);
    try { await saveUploadedFiles(updatedFiles); setStorageError(''); }
    catch { setStorageError('ذخیره فایل‌ها ناموفق بود؛ فضای ذخیره‌سازی مرورگر را بررسی کنید.'); }
  }, []);

  // Initialize storage, settings, saved files, and network listeners
  useEffect(() => {
    async function init() {
      const savedSessions = await loadSessions();
      setSessions(savedSessions);

      const savedSettings = await loadSettings();
      setSettings(savedSettings);

      const savedPrompt = await loadCustomPrompt();
      setCustomPrompt(savedPrompt);

      const savedQueue = await loadQueueState();
      setQueueSnapshot(savedQueue);
      if (savedQueue) { setCourseTitle(savedQueue.courseTitle); setInstructorName(savedQueue.instructorName); }

      const savedFiles = await loadUploadedFiles();
      if (savedFiles && savedFiles.length > 0) {
        setFiles(savedFiles);
      }
    }
    init().then(() => setInitialized(true)).catch(() => {
      setStorageError('خواندن اطلاعات ذخیره‌شده ناموفق بود. صفحه را دوباره باز کنید.');
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      abortControllerRef.current?.abort();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setIsHelpOpen(true);
    }
  };

  // Start Full Automated Processing Pipeline with inline-safe audio chunks.
  const handleStartProcessing = async () => {
    if (!initialized || files.length === 0 || abortControllerRef.current) return;


    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    setProcessingErrors([]);
    setCurrentView('progress');

    try {
      await saveUploadedFiles(files);
      const ai = await createGeminiClient(settings, signal);
      const connection = await runBrowserConnectionDiagnostic(settings, signal);
      if (!connection.ok) {
        const locationBlocked = /User location is not supported|FAILED_PRECONDITION/i.test(connection.raw);
        const guidance = locationBlocked
          ? 'اتصال Gemini از IP خروجی فعلی مجاز نیست. VPN داخلی Firefox را برای این صفحهٔ HTTPS روی یک کشور پشتیبانی‌شده فعال کنید و تست مرورگر را دوباره اجرا کنید.'
          : 'پیش‌آزمون اتصال Gemini ناموفق بود. جزئیات خام در ادامه آمده است.';
        throw new Error(`${guidance}\nHTTP ${connection.status ?? 'NETWORK'}\n${connection.raw}`);
      }
      const previousQueue = await loadQueueState();
      const existingSessions = await loadSessions();
      // Step 1: Slice audio locally; time and byte limits keep inline requests safe.
      setProcessingStep('slicing');
      setProgressPercent(5);

      const groupedSessions = groupFilesBySessionAndPart(files);
      let totalAllChunks = 0;
      const sessionChunksMap = new Map<number, Array<{ chunk: any; file: AudioFileItem }>>();

      for (const sess of groupedSessions) {
        if (signal.aborted) return;
        const sessionChunks: Array<{ chunk: any; file: AudioFileItem }> = [];
        for (const part of sess.parts) {
          for (const fileItem of part.files) {
            if (signal.aborted) return;
            if (fileItem.file) {
              try {
                setCurrentFileName(fileItem.name);
                setCurrentPartName(fileItem.partName);
                setCurrentSessionTitle(fileItem.sessionName);

                const chunks = await sliceAudioFile(
                  fileItem.file,
                  fileItem.id,
                  settings.maxChunkMinutes || DEFAULT_CHUNK_MINUTES
                );
                chunks.forEach((c) => sessionChunks.push({ chunk: c, file: fileItem }));
                totalAllChunks += chunks.length;
              } catch (err: any) {
                if (signal.aborted) return;
                console.error('Error slicing audio:', err);
                throw new Error(`خطا در تقطیع ${fileItem.name}: ${err?.message || 'نامشخص'}`);
              }
            } else { throw new Error(`فایل صوتی ${fileItem.name} در دسترس نیست.`); }
          }
        }
        sessionChunksMap.set(sess.sessionNumber, sessionChunks);
      }

      if (signal.aborted) return;

      if (!totalAllChunks) throw new Error('هیچ قطعه صوتی قابل پردازشی پیدا نشد.');
      const safeTotalChunks = Math.max(1, totalAllChunks);
      setTotalChunksCount(safeTotalChunks);
      setCompletedChunksCount(0);
      setProgressPercent(10);

      // Step 2: Sequential Transcribing Chunks (One by One)
      let lastProcessedSession: ProcessedSession | null = null;
      let globalCompletedChunks = 0;

      for (const sess of groupedSessions) {
        if (signal.aborted) return;

        const chunks = sessionChunksMap.get(sess.sessionNumber) || [];
        const sessionTitle = sess.sessionName;
        setCurrentSessionTitle(sessionTitle);

        const fingerprint = JSON.stringify({ files: chunks.map(c => [c.file.id, c.file.name, c.file.sessionName, c.file.partName]), minutes: settings.maxChunkMinutes, customPrompt, courseTitle, instructorName });
        const bytes = new TextEncoder().encode(fingerprint);
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const jobId = Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, '0')).join('');
        const sessionId = `session-${jobId}`;
        const existing = existingSessions.find(s => s.id === sessionId);
        if (existing) { lastProcessedSession = existing; globalCompletedChunks += chunks.length; continue; }
        const recovered = previousQueue?.jobId === jobId ? previousQueue : null;
        const startIndex = recovered?.completedChunks || 0;
        globalCompletedChunks += startIndex;
        const accumulatedParagraphs: any[] = [...(recovered?.accumulatedParagraphs || [])];
        const accumulatedQuestions: any[] = [...(recovered?.accumulatedQuestions || [])];
        const accumulatedSummaryPoints: string[] = [...(recovered?.summaryPoints || [])];
        const checkpoint = async (completed: number) => {
          const snapshot: QueueStateSnapshot = {
            jobId, activeSessionId: sessionId, sessionTitle, courseTitle, instructorName,
            sessionNumber: sess.sessionNumber, date: new Date().toLocaleDateString('fa-IR'),
            totalChunks: chunks.length, completedChunks: completed,
            pendingChunkIds: chunks.slice(completed).map(c => c.chunk.chunkId),
            accumulatedParagraphs, accumulatedQuestions, summaryPoints: accumulatedSummaryPoints,
            updatedAt: new Date().toISOString(),
          };
          await saveQueueState(snapshot);
          setQueueSnapshot(snapshot);
        };
        await checkpoint(startIndex);

        setProcessingStep('transcribing');

        for (let i = startIndex; i < chunks.length; i++) {
          if (signal.aborted) return;

          const { chunk, file } = chunks[i];
          setCurrentFileName(file.name);
          setCurrentPartName(file.partName);

          let success = false;
          let attempts = 0;

          while (!success && attempts < 3 && !signal.aborted) {
            attempts++;
            try {
              const data = await transcribeChunk(ai, {
                audioBlob: chunk.audioBlob,
                sessionTitle, partTitle: file.partName, fileName: file.name,
                chunkIndex: chunk.chunkIndex, totalChunks: chunk.totalChunks,
                timeOffsetSeconds: chunk.timeOffsetSeconds, customPrompt,
              }, signal);
              if (data.paragraphs) accumulatedParagraphs.push(...data.paragraphs);
              if (data.questions) accumulatedQuestions.push(...data.questions);
              if (data.summaryPoints) accumulatedSummaryPoints.push(...data.summaryPoints);

              success = true;
            } catch (err: any) {
              if (signal.aborted) return;
              console.warn(`Chunk ${chunk.chunkId} attempt ${attempts} failed:`, err);
              const retryable = /NetworkError|fetch|مهلت|timeout|HTTP (?:429|5\d\d)/i.test(err?.message || String(err));
              if (attempts >= 3 || !retryable) {
                setProcessingErrors((prev) => [
                  ...prev,
                  `قطعه ${chunk.chunkIndex + 1} از فایل ${file.name} پردازش نشد: ${err.message}`,
                ]);
                break;
              } else {
                // Give the Firefox VPN tunnel time to release an aborted request.
                await wait(attempts === 1 ? 15000 : 30000, signal);
              }
            }
          }

          if (signal.aborted) return;

          if (!success) throw new Error(`پردازش قطعه ${chunk.chunkIndex + 1} از ${file.name} متوقف شد؛ نتایج قبلی ذخیره‌اند.`);
          await checkpoint(i + 1);
          globalCompletedChunks++;
          setCompletedChunksCount(globalCompletedChunks);
          const currentChunkPercent = 10 + Math.round((globalCompletedChunks / safeTotalChunks) * 60);
          setProgressPercent(Math.min(70, currentChunkPercent));


        }

        if (signal.aborted) return;

        // Step 3: Extracting & Structuring Questions
        setProcessingStep('extracting_questions');
        setProgressPercent(76);
        await new Promise((r) => setTimeout(r, 400));

        if (signal.aborted) return;

        // Step 4: Synthesizing Session into Classic Study Notes
        setProcessingStep('generating_notes');
        setProgressPercent(84);

        const classicNote = await synthesizeSession(ai, {
          sessionTitle, courseTitle, instructorName,
          sessionNumber: String(sess.sessionNumber), date: new Date().toLocaleDateString('fa-IR'),
          allParagraphs: accumulatedParagraphs,
        }, signal);
        if (signal.aborted) return;
        accumulatedQuestions.forEach((q, i) => { q.number = i + 1; });

        // Step 5: Building Documents & Packaging
        setProcessingStep('building_documents');
        setProgressPercent(94);
        await new Promise((r) => setTimeout(r, 350));

        if (signal.aborted) return;

        const newSession: ProcessedSession = {
          id: sessionId,
          sessionTitle,
          sessionNumber: sess.sessionNumber,
          courseTitle,
          instructorName,
          date: new Date().toLocaleDateString('fa-IR'),
          parts: sess.parts,
          transcriptParagraphs: accumulatedParagraphs,
          questions: accumulatedQuestions,
          classicNote,
          createdAt: new Date().toISOString(),
        };

        await saveSession(newSession);
        setSessions((prev) => [newSession, ...prev.filter((s) => s.id !== newSession.id)]);
        lastProcessedSession = newSession;
      }

      if (signal.aborted) return;

      await saveQueueState(null);
      setQueueSnapshot(null);

      // Step 6: Completed state transition
      setProcessingStep('completed');
      setProgressPercent(100);

      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // Ignore in non-browser env
      }

      if (lastProcessedSession) {
        setActiveSession(lastProcessedSession);
        setCurrentView('output');
      }
    } catch (err: any) {
      if (signal.aborted || err?.name === 'AbortError') {
        setProcessingStep('idle');
        setCurrentView('upload');
        return;
      }
      console.error('Processing lifecycle error:', err);
      setProcessingErrors((prev) => [...prev, err?.message || 'خطای غیرمنتظره در پردازش']);
      setProcessingStep('error');
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  // Resume previous unfinished work from IndexedDB
  const handleResumePrevious = async () => {
    await handleStartProcessing();
  };

  const handleCancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setProcessingStep('idle');
    setCurrentView('upload');
  };

  const handleLoadSample = async () => {
    await saveSession(SAMPLE_SESSION);
    setSessions((prev) => [SAMPLE_SESSION, ...prev.filter((s) => s.id !== SAMPLE_SESSION.id)]);
    setActiveSession(SAMPLE_SESSION);
    setCurrentView('output');
  };

  const handleNewJob = async () => {
    handleCancelProcessing();
    await saveQueueState(null);
    setQueueSnapshot(null);
    setFiles([]);
    await saveUploadedFiles([]);
    setActiveSession(null);
    setCurrentView('upload');
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSession?.id === id) {
      setActiveSession(null);
      setCurrentView('upload');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {storageError && <div role="alert" className="p-3 text-red-800 bg-red-50">{storageError}</div>}
      {!initialized && <div className="p-3">در حال بازیابی اطلاعات…</div>}
      <Header
        onToggleMenu={() => setIsMenuOpen(!isMenuOpen)}
        isMenuOpen={isMenuOpen}
        isOnline={isOnline}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenReader={() => setIsReaderOpen(true)}
        canInstallPWA={Boolean(deferredPrompt)}
        onInstallPWA={handleInstallPWA}
        onOpenInstall={() => setIsInstallOpen(true)}
      />

      <MenuDropdown
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNewJob={handleNewJob}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenReader={() => setIsReaderOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPrompt={() => setIsPromptOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenInstall={() => setIsInstallOpen(true)}
        onLoadSample={handleLoadSample}
      />

      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6">
        {initialized && currentView === 'upload' && (
          <ApiKeyPanel
            apiKey={settings.userGeminiApiKey || ''}
            onSave={(apiKey) => {
              saveGeminiApiKey(apiKey);
              setSettings(current => ({ ...current, userGeminiApiKey: apiKey }));
            }}
            onClear={() => {
              clearGeminiApiKey();
              setSettings(current => ({ ...current, userGeminiApiKey: undefined }));
            }}
          />
        )}
        {initialized && currentView === 'upload' && <ConnectionDiagnostic settings={settings} />}
        {initialized && currentView === 'upload' && (
          <UploadZone
            files={files}
            onFilesChanged={handleFilesChanged}
            onStartProcessing={handleStartProcessing}
            hasPreviousWork={Boolean(queueSnapshot)}
            onResumePrevious={handleResumePrevious}
            courseTitle={courseTitle}
            setCourseTitle={setCourseTitle}
            instructorName={instructorName}
            setInstructorName={setInstructorName}
            onLoadSample={handleLoadSample}
            isProcessing={!initialized || (processingStep !== 'idle' && processingStep !== 'completed' && processingStep !== 'error')}
          />
        )}

        {currentView === 'progress' && (
          <ProgressView
            currentStep={processingStep}
            currentSessionTitle={currentSessionTitle}
            currentFileName={currentFileName}
            currentPartName={currentPartName}
            completedChunks={completedChunksCount}
            totalChunks={totalChunksCount}
            percent={progressPercent}
            isOnline={isOnline}
            errors={processingErrors}
            onRetryFailed={handleStartProcessing}
            onCancel={handleCancelProcessing}
          />
        )}

        {currentView === 'output' && activeSession && (
          <OutputView
            session={activeSession}
            settings={settings}
            onOpenReader={() => setIsReaderOpen(true)}
            onNewJob={handleNewJob}
          />
        )}
      </main>

      <ReaderModal
        isOpen={isReaderOpen}
        onClose={() => setIsReaderOpen(false)}
        sessions={sessions.length > 0 ? sessions : activeSession ? [activeSession] : []}
        activeSessionId={activeSession?.id}
      />

      <LibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        sessions={sessions}
        settings={settings}
        onSelectForReader={(id) => {
          const sess = sessions.find((s) => s.id === id);
          if (sess) setActiveSession(sess);
          setIsLibraryOpen(false);
          setIsReaderOpen(true);
        }}
        onDeleteSession={handleDeleteSession}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={async (newSettings) => {
          setSettings(newSettings);
          await saveSettings(newSettings);
        }}
      />

      <PromptModal
        isOpen={isPromptOpen}
        onClose={() => setIsPromptOpen(false)}
        prompt={customPrompt}
        onSavePrompt={async (newPrompt) => {
          setCustomPrompt(newPrompt);
          await saveCustomPrompt(newPrompt);
        }}
      />

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        canInstallPWA={Boolean(deferredPrompt)}
        onInstallPWA={handleInstallPWA}
      />

      <InstallModal
        isOpen={isInstallOpen}
        onClose={() => setIsInstallOpen(false)}
        canInstallPWA={Boolean(deferredPrompt)}
        onInstallPWA={handleInstallPWA}
      />
    </div>
  );
}
