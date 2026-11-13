/**
 * Persian & Arabic text normalizer for high-recall in-app search.
 * Neutralizes:
 * - 'ي' and 'ئ' to 'ی'
 * - 'ك' to 'ک'
 * - 'ة' to 'ه' or 'ت'
 * - Tanween & Harakat (فتحه، ضمه، کسره، تشدید، تنوین)
 * - Zero-Width Non-Joiner (نیم‌فاصله \u200c) treated gracefully
 * - Persian/Arabic numerals to ASCII digits
 */
export function normalizePersianText(input: string): string {
  if (!input) return '';

  return input
    // Unify Arabic Yeh
    .replace(/[يىئ]/g, 'ی')
    // Unify Arabic Kaf
    .replace(/[ك]/g, 'ک')
    // Unify Teh Marbuta
    .replace(/[ة]/g, 'ه')
    // Remove Persian / Arabic Diacritics (Harakat / Tanween / Tashdid / Sukun)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize Alef variants (آ، أ، إ) to generic ا
    .replace(/[آأإ]/g, 'ا')
    // Convert Zero-Width Non-Joiner (نیم‌فاصله) to space for indexing/matching
    .replace(/\u200C/g, ' ')
    // Normalize Persian/Arabic digits
    .replace(/[۰٠]/g, '0')
    .replace(/[۱١]/g, '1')
    .replace(/[۲٢]/g, '2')
    .replace(/[۳٣]/g, '3')
    .replace(/[۴٤]/g, '4')
    .replace(/[۵٥]/g, '5')
    .replace(/[۶٦]/g, '6')
    .replace(/[۷٧]/g, '7')
    .replace(/[۸٨]/g, '8')
    .replace(/[۹٩]/g, '9')
    // Lowercase Latin characters
    .toLowerCase()
    // Collapse multiple whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Searches text using normalized matching.
 * Returns true if query matches within target.
 */
export function fuzzyPersianIncludes(target: string, query: string): boolean {
  if (!query) return true;
  if (!target) return false;

  const normTarget = normalizePersianText(target);
  const normQuery = normalizePersianText(query);

  return normTarget.includes(normQuery);
}

/**
 * Returns snippets with surrounding context for search results
 */
export function extractSearchSnippet(
  fullText: string,
  query: string,
  radius: number = 60
): { snippet: string; matchIndex: number } | null {
  if (!fullText || !query) return null;

  const normTarget = normalizePersianText(fullText);
  const normQuery = normalizePersianText(query);
  const index = normTarget.indexOf(normQuery);

  if (index === -1) return null;

  const start = Math.max(0, index - radius);
  const end = Math.min(fullText.length, index + query.length + radius);

  const prefix = start > 0 ? '...' : '';
  const suffix = end < fullText.length ? '...' : '';

  return {
    snippet: `${prefix}${fullText.slice(start, end)}${suffix}`,
    matchIndex: index,
  };
}
