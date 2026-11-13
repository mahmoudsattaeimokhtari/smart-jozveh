import { get, set, del, update } from 'idb-keyval';
import { ProcessedSession, AppSettings, DEFAULT_PROMPT, AudioFileItem } from '../types';
import { loadGeminiApiKey, saveGeminiApiKey } from './apiKeyStorage';
import { DEFAULT_CHUNK_MINUTES } from './audioChunker';

const SESSIONS_KEY = 'smart_jozveh_sessions_v1';
const SETTINGS_KEY = 'smart_jozveh_settings_v1';
const PROMPT_KEY = 'smart_jozveh_custom_prompt_v1';
const QUEUE_KEY = 'smart_jozveh_queue_state_v1';
const UPLOADED_FILES_KEY = 'smart_jozveh_uploaded_files_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  bodyFontSize: 14,
  headingFontSize: 18,
  persianBodyFont: 'B Nazanin',
  persianHeadingFont: 'B Zar',
  englishFont: 'Times New Roman',
  maxChunkMinutes: DEFAULT_CHUNK_MINUTES,
  autoSaveToDevice: true,
};

export async function loadSessions(): Promise<ProcessedSession[]> {
  return (await get<ProcessedSession[]>(SESSIONS_KEY)) || [];
}

export async function saveSession(session: ProcessedSession): Promise<void> {
  await update<ProcessedSession[]>(SESSIONS_KEY, previous => [session, ...(previous || []).filter(s => s.id !== session.id)]);
}

export async function deleteSession(id: string): Promise<void> {
  await update<ProcessedSession[]>(SESSIONS_KEY, previous => (previous || []).filter(s => s.id !== id));
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const settings = await get<AppSettings>(SETTINGS_KEY);
    const legacyKey = settings?.userGeminiApiKey?.trim();
    if (legacyKey && !loadGeminiApiKey()) {
      try { saveGeminiApiKey(legacyKey); } catch { /* Ignore invalid legacy values. */ }
    }
    const storedSettings: AppSettings = settings || DEFAULT_SETTINGS;
    const { userGeminiApiKey: _legacyKey, serverUrl: _legacyServerUrl, ...safeSettings } = storedSettings;
    const savedMinutes = Number(safeSettings.maxChunkMinutes);
    return {
      ...DEFAULT_SETTINGS,
      ...safeSettings,
      maxChunkMinutes: Number.isFinite(savedMinutes)
        ? Math.min(DEFAULT_CHUNK_MINUTES, Math.max(1, savedMinutes))
        : DEFAULT_CHUNK_MINUTES,
      userGeminiApiKey: loadGeminiApiKey(),
    };
  } catch (err) {
    return { ...DEFAULT_SETTINGS, userGeminiApiKey: loadGeminiApiKey() };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const { userGeminiApiKey: _apiKey, serverUrl: _serverUrl, ...safeSettings } = settings;
  await set(SETTINGS_KEY, {
    ...safeSettings,
    maxChunkMinutes: Math.min(DEFAULT_CHUNK_MINUTES, Math.max(1, Number(safeSettings.maxChunkMinutes) || DEFAULT_CHUNK_MINUTES)),
  });
}

export async function loadCustomPrompt(): Promise<string> {
  try {
    const prompt = await get<string>(PROMPT_KEY);
    return prompt || DEFAULT_PROMPT;
  } catch (err) {
    return DEFAULT_PROMPT;
  }
}

export async function saveCustomPrompt(prompt: string): Promise<void> {
  await set(PROMPT_KEY, prompt);
}

// File/Blob and metadata are structured-cloned into IndexedDB; object URLs are transient.
export async function saveUploadedFiles(files: AudioFileItem[]): Promise<void> {
  await set(UPLOADED_FILES_KEY, files.map(({ audioUrl, ...item }) => item));
}

export async function loadUploadedFiles(): Promise<AudioFileItem[]> {
  const data = (await get<AudioFileItem[]>(UPLOADED_FILES_KEY)) || [];
  return data.map(item => ({ ...item, file: item.file instanceof Blob
    ? new File([item.file], item.name, { type: item.file.type, lastModified: (item.file as File).lastModified || Date.now() })
    : undefined }));
}

// Queue state persistence for resilient recovery after network drops
export interface QueueStateSnapshot {
  jobId?: string;
  activeSessionId: string;
  sessionTitle: string;
  courseTitle: string;
  instructorName: string;
  sessionNumber: number;
  date: string;
  totalChunks: number;
  completedChunks: number;
  pendingChunkIds: string[];
  accumulatedParagraphs: any[];
  accumulatedQuestions: any[];
  summaryPoints: string[];
  updatedAt: string;
}

export async function saveQueueState(state: QueueStateSnapshot | null): Promise<void> {
  if (!state) {
    await del(QUEUE_KEY);
  } else {
    await set(QUEUE_KEY, state);
  }
}

export async function loadQueueState(): Promise<QueueStateSnapshot | null> {
  return (await get<QueueStateSnapshot>(QUEUE_KEY)) || null;
}
