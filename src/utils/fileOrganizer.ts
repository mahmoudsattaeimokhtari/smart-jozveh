import { AudioFileItem } from '../types';

// Persian word to number lookup
const PERSIAN_WORDS_NUM_MAP: Record<string, number> = {
  'اول': 1, 'نخست': 1, 'یک': 1, 'یکم': 1,
  'دوم': 2, 'دو': 2,
  'سوم': 3, 'سه': 3,
  'چهارم': 4, 'چهار': 4,
  'پنجم': 5, 'پنج': 5,
  'ششم': 6, 'شش': 6,
  'هفتم': 7, 'هفت': 7,
  'هشتم': 8, 'هشت': 8,
  'نهم': 9, 'نه': 9,
  'دهم': 10, 'ده': 10,
  'یازدهم': 11,
  'دوازدهم': 12,
  'سیزدهم': 13,
  'چهاردهم': 14,
  'پانزدهم': 15,
  'شانزدهم': 16,
  'هفدهم': 17,
  'هجدهم': 18,
  'نوزدهم': 19,
  'بیستم': 20,
  'بیست و یکم': 21,
  'بیست و دوم': 22,
  'بیست و سوم': 23,
  'بیست و چهارم': 24,
  'بیست و پنجم': 25,
  'سی‌ام': 30, 'سی ام': 30,
};

// Convert Persian and Arabic digits to English digits
export function toEnglishDigits(str: string): string {
  if (!str) return '';
  return str
    .replace(/[۰٠]/g, '0')
    .replace(/[۱١]/g, '1')
    .replace(/[۲٢]/g, '2')
    .replace(/[۳٣]/g, '3')
    .replace(/[۴٤]/g, '4')
    .replace(/[۵٥]/g, '5')
    .replace(/[۶٦]/g, '6')
    .replace(/[۷٧]/g, '7')
    .replace(/[۸٨]/g, '8')
    .replace(/[۹٩]/g, '9');
}

// Convert English digits to Persian digits for display
export function toPersianDigits(num: number | string): string {
  const str = String(num);
  return str
    .replace(/0/g, '۰')
    .replace(/1/g, '۱')
    .replace(/2/g, '۲')
    .replace(/3/g, '۳')
    .replace(/4/g, '۴')
    .replace(/5/g, '۵')
    .replace(/6/g, '۶')
    .replace(/7/g, '۷')
    .replace(/8/g, '۸')
    .replace(/9/g, '۹');
}

export function parseFileNameDetails(originalFileName: string): {
  sessionNumber: number;
  sessionName: string;
  partNumber: number;
  partName: string;
  fileOrder: number;
  isAmbiguous: boolean;
} {
  const cleanName = toEnglishDigits(originalFileName).toLowerCase();
  let sessionNumber = 1;
  let partNumber = 1;
  let fileOrder = 1;
  let isAmbiguous = false;

  // 1. Session match pattern
  // Matches: "جلسه 12", "جلسه_2", "جلسه-05", "session 3", "sess 4", "s01"
  const sessionRegex = /(?:جلسه|جلسه‌ی|جلسه\s*ی|session|sess|s)[_\s-]*(\d+)/i;
  const sessionWordRegex = /(?:جلسه|جلسه‌ی|جلسه\s*ی|session)\s+([\u0600-\u06FF\s]+)/i;

  const sessionMatch = cleanName.match(sessionRegex);
  if (sessionMatch) {
    sessionNumber = parseInt(sessionMatch[1], 10);
  } else {
    // Check Persian words like "جلسه بیستم"
    const wordMatch = originalFileName.match(sessionWordRegex);
    if (wordMatch) {
      const word = wordMatch[1].trim();
      if (PERSIAN_WORDS_NUM_MAP[word]) {
        sessionNumber = PERSIAN_WORDS_NUM_MAP[word];
      } else {
        isAmbiguous = true;
      }
    } else {
      isAmbiguous = true;
    }
  }

  // 2. Part match pattern
  // Matches: "قسمت 2", "پارت 3", "بخش 1", "part 4", "p02"
  const partRegex = /(?:قسمت|پارت|بخش|فصل|part|p)[_\s-]*(\d+)/i;
  const partWordRegex = /(?:قسمت|پارت|بخش)\s+([\u0600-\u06FF\s]+)/i;

  const partMatch = cleanName.match(partRegex);
  if (partMatch) {
    partNumber = parseInt(partMatch[1], 10);
  } else {
    const wordMatch = originalFileName.match(partWordRegex);
    if (wordMatch) {
      const word = wordMatch[1].trim();
      if (PERSIAN_WORDS_NUM_MAP[word]) {
        partNumber = PERSIAN_WORDS_NUM_MAP[word];
      }
    }
  }

  // 3. File order match
  // e.g. "فایل 03", "فایل_2", "قطعه 4", "01", "02"
  const orderRegex = /(?:فایل|file|قطعه|track|trk)[_\s-]*(\d+)/i;
  const orderMatch = cleanName.match(orderRegex);
  if (orderMatch) {
    fileOrder = parseInt(orderMatch[1], 10);
  } else {
    // Look for leading or trailing numbers like "01 - ..." or "... - 02"
    const numMatches = cleanName.match(/\b\d+\b/g);
    if (numMatches && numMatches.length > 0) {
      const lastNum = parseInt(numMatches[numMatches.length - 1], 10);
      if (lastNum !== sessionNumber && lastNum !== partNumber) {
        fileOrder = lastNum;
      }
    }
  }

  return {
    sessionNumber: sessionNumber || 1,
    sessionName: `جلسه ${toPersianDigits(sessionNumber || 1)}`,
    partNumber: partNumber || 1,
    partName: `قسمت ${toPersianDigits(partNumber || 1)}`,
    fileOrder: fileOrder || 1,
    isAmbiguous,
  };
}

export function organizeFilesIntoHierarchy(files: File[]): AudioFileItem[] {
  const nameOccurrences: Record<string, number> = {};

  const items: AudioFileItem[] = files.map((file, index) => {
    const parsed = parseFileNameDetails(file.name);

    // Track duplicate names
    nameOccurrences[file.name] = (nameOccurrences[file.name] || 0) + 1;
    const isDuplicateSuspect = nameOccurrences[file.name] > 1;

    return {
      id: `file-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
      file,
      name: file.name,
      size: file.size,
      sessionName: parsed.sessionName,
      sessionNumber: parsed.sessionNumber,
      partName: parsed.partName,
      partNumber: parsed.partNumber,
      fileOrder: parsed.fileOrder,
      isAmbiguous: parsed.isAmbiguous,
      isDuplicateSuspect,
      status: 'pending',
    };
  });

  // Sort by Session -> Part -> File Order (Numerical sorting)
  items.sort((a, b) => {
    if (a.sessionNumber !== b.sessionNumber) return a.sessionNumber - b.sessionNumber;
    if (a.partNumber !== b.partNumber) return a.partNumber - b.partNumber;
    return a.fileOrder - b.fileOrder;
  });

  return items;
}

export function groupFilesBySessionAndPart(items: AudioFileItem[]) {
  const sessionsMap = new Map<number, {
    sessionNumber: number;
    sessionName: string;
    parts: Map<number, {
      partNumber: number;
      partName: string;
      files: AudioFileItem[];
    }>;
  }>();

  for (const item of items) {
    if (!sessionsMap.has(item.sessionNumber)) {
      sessionsMap.set(item.sessionNumber, {
        sessionNumber: item.sessionNumber,
        sessionName: item.sessionName,
        parts: new Map(),
      });
    }

    const session = sessionsMap.get(item.sessionNumber)!;
    if (!session.parts.has(item.partNumber)) {
      session.parts.set(item.partNumber, {
        partNumber: item.partNumber,
        partName: item.partName,
        files: [],
      });
    }

    session.parts.get(item.partNumber)!.files.push(item);
  }

  // Convert to sorted array
  return Array.from(sessionsMap.values())
    .sort((a, b) => a.sessionNumber - b.sessionNumber)
    .map(session => ({
      ...session,
      parts: Array.from(session.parts.values())
        .sort((a, b) => a.partNumber - b.partNumber)
        .map(part => ({
          ...part,
          files: part.files.sort((a, b) => a.fileOrder - b.fileOrder),
        })),
    }));
}
