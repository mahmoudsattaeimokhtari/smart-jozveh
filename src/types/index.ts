export interface AudioFileItem {
  id: string;
  file?: File;
  name: string;
  size: number;
  durationSeconds?: number;
  sessionName: string;
  sessionNumber: number;
  partName: string;
  partNumber: number;
  fileOrder: number;
  isAmbiguous?: boolean;
  isDuplicateSuspect?: boolean;
  status: 'pending' | 'slicing' | 'transcribing' | 'completed' | 'failed';
  error?: string;
  chunksCount?: number;
  audioUrl?: string;
}

export interface AudioChunk {
  chunkId: string;
  parentFileId: string;
  chunkIndex: number;
  totalChunks: number;
  timeOffsetSeconds: number;
  durationSeconds: number;
  audioBlob?: Blob;
  audioBase64?: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  error?: string;
  retries: number;
}

export interface TranscriptParagraph {
  speaker: 'استاد' | 'دانشجو' | string;
  text: string;
  startSec: number;
  endSec: number;
  originalStartSec: number;
  originalEndSec: number;
  formattedTimeTag: string;
  partTitle: string;
  fileName: string;
  isUnclear?: boolean;
}

export interface SessionQuestion {
  id: string;
  number: number;
  type: 'تستی' | 'تشریحی' | 'شفاهی' | 'کلاسی' | string;
  topic: string;
  questionText: string;
  options?: string[];
  answer: string;
  isAnswerStated: boolean;
  isComplete: boolean;
  asker: 'استاد' | 'دانشجو' | string;
  partTitle: string;
  fileName: string;
  timeSec: number;
  formattedTime: string;
}

export interface ClassicNoteSection {
  heading: string;
  subheading?: string;
  content: string;
  keyDefinitions?: Array<{ term: string; definition: string }>;
  teacherEmphasisPoints?: string[];
  examples?: string[];
}

export interface ClassicNote {
  title: string;
  courseTitle?: string;
  instructor?: string;
  sessionNumber?: string;
  date?: string;
  introduction?: string;
  sections: ClassicNoteSection[];
  conclusion?: string;
  keyTermsList?: string[];
}

export interface ProcessedSession {
  id: string;
  sessionTitle: string;
  sessionNumber: number;
  courseTitle: string;
  instructorName: string;
  date: string;
  parts: Array<{
    partNumber: number;
    partName: string;
    files: AudioFileItem[];
  }>;
  transcriptParagraphs: TranscriptParagraph[];
  questions: SessionQuestion[];
  classicNote: ClassicNote;
  createdAt: string;
  wordFullTranscriptBlob?: Blob;
  wordQuestionsBlob?: Blob;
  wordClassicNoteBlob?: Blob;
  epubBlob?: Blob;
}

export interface AppSettings {
  bodyFontSize: number;
  headingFontSize: number;
  persianBodyFont: string;
  persianHeadingFont: string;
  englishFont: string;
  maxChunkMinutes: number;
  autoSaveToDevice: boolean;
  serverUrl?: string;
  userGeminiApiKey?: string;
}

export const DEFAULT_PROMPT = `فایلهای صوتی ورودی را بهترتیب پردازش کن. هر جلسه ممکن است چند قسمت و هر قسمت چند فایل کوتاه داشته باشد. دستهبندی را از نام فایلها و پوشهها استخراج کن و ابهامها را ثبت کن. پس از شروع، تمام عملیات را بدون پرسش یا تأیید مجدد تا آمادهشدن خروجیها ادامه بده.

برای هر جلسه سه فایل Word مستقل تهیه کن:
۱. متن کامل وفادار به گفتار؛
۲. تمام سؤالات جلسه؛
۳. جزوه کلاسیک موضوعبندیشده.

در متن کامل، واژگان و ترتیب گفتار را حفظ کن و فقط خطاهای روشن تشخیص گفتار، املا، نشانهگذاری و فاصلهگذاری را اصلاح کن. کنار تکتک پاراگرافها، قسمت، نام فایل مبدأ و زمان شروع و پایان در همان فایل را بنویس. بخش نامفهوم و زمان تقریبی را صریحاً مشخص کن.

تمام سؤالات را همراه مشخصات و ارجاع زمانی جمعآوری کن. پاسخ را فقط در صورت بیانشدن در صوت درج کن.

در جزوه کلاسیک، محتوای تمام فایلهای جلسه را روان و موضوعبندیشده بازنویسی کن و نکات آموزشی را حفظ کن. اطلاعات، پاسخ یا ترجمه اضافه نکن.

متن فارسی راستبهچپ، متن اصلی با B Nazanin، تیترهای فارسی با B Zar و تمام عبارتهای انگلیسی با Times New Roman باشند. نکات مهم را برای جلب توجه و سرعت مطالعه با رنگهای گرم و خوانا برجسته کن؛ رنگها نیاز به معنای ثابت ندارند. فاصلههای اضافی را حذف کن.

هر سه فایل را خودکار آماده کن و در صورت وجود دسترسی، در پوشه تعیینشده ذخیره کن. هر نقص یا ابهام را در گزارش پایان کار مشخص کن و خروجی ناقص را کامل معرفی نکن.`;
