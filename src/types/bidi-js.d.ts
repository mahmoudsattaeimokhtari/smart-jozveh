declare module 'bidi-js' {
  export default function bidiFactory(): {
    getEmbeddingLevels(text: string, direction: 'rtl' | 'ltr'): unknown;
    getReorderedString(text: string, levels: unknown): string;
  };
}
