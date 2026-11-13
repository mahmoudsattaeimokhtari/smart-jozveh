const GEMINI_API_KEY_STORAGE_KEY = 'smart_jozveh_gemini_api_key_v1';

export function isValidGeminiApiKey(value: string): boolean {
  return /^(?:AIza[\w-]{35}|AQ\.[\w.-]{20,})$/.test(value.trim());
}

export function loadGeminiApiKey(): string {
  try {
    return window.localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function saveGeminiApiKey(value: string): void {
  const normalized = value.trim();
  if (!isValidGeminiApiKey(normalized)) {
    throw new Error('قالب کلید Gemini معتبر نیست.');
  }
  window.localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, normalized);
}

export function clearGeminiApiKey(): void {
  window.localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
}
