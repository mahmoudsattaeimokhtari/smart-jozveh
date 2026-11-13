export interface TextParagraph { id: string; text: string; timestamp?: string }
export interface TextSource { name: string; text: string }
export interface BatchSection { heading: string; content: string; sourceIds: string[]; examPoints: string[] }
export interface ClassroomQuestion { question: string; answer: string; evidence: string; sourceIds: string[] }
export interface PracticeQuestion { question: string; options: string[]; correctIndex: number; explanation: string; sourceIds: string[] }
export interface BatchAnalysis {
  sections: BatchSection[];
  classroomQuestions: ClassroomQuestion[];
  practiceQuestions: PracticeQuestion[];
}
export interface BatchSession {
  id: string; number: number; title: string; sources: TextSource[]; paragraphs: TextParagraph[];
  status: 'pending' | 'processing' | 'done' | 'error'; error?: string;
  analysis?: BatchAnalysis;
  documents?: { combined: Blob; questions: Blob; classic: Blob };
}
export interface NotebookBundle { id: string; start: number; end: number; numbers: number[]; signature: string; pdf: Blob }
export interface BatchState { sessions: BatchSession[]; bundles: NotebookBundle[]; autoPdf: boolean; autoDownload: boolean }
