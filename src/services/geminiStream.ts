// Read SSE incrementally, including UTF-8 characters and events split across network packets.
export async function readGeminiStream(response: Response, signal: AbortSignal,
  onProgress?: (length: number) => void, idleMs = 180_000): Promise<string> {
  if (!response.body) throw new Error('مرورگر جریان پاسخ Gemini را دریافت نکرد.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let text = '';
  let finishReason = '';
  const consume = (event: string) => {
    const data = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data || data.trim() === '[DONE]') return;
    const payload = JSON.parse(data);
    if (payload.error) throw new Error(`Gemini: ${payload.error.message || payload.error.status}`);
    const candidate = payload.candidates?.[0];
    if (candidate?.finishReason) finishReason = candidate.finishReason;
    for (const part of candidate?.content?.parts || []) if (typeof part.text === 'string' && !part.thought) text += part.text;
    onProgress?.(text.length);
  };
  try {
    for (;;) {
      signal.throwIfAborted();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let abort: (() => void) | undefined;
      const interrupted = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('جریان پاسخ Gemini برای ۱۸۰ ثانیه داده‌ای نفرستاد.')), idleMs);
        abort = () => reject(signal.reason || new DOMException('Aborted', 'AbortError'));
        signal.addEventListener('abort', abort, { once: true });
      });
      let packet: ReadableStreamReadResult<Uint8Array>;
      try { packet = await Promise.race([reader.read(), interrupted]); }
      finally { clearTimeout(timer); if (abort) signal.removeEventListener('abort', abort); }
      pending += decoder.decode(packet.value, { stream: !packet.done });
      pending = pending.replace(/\r\n/g, '\n');
      let index: number;
      while ((index = pending.indexOf('\n\n')) >= 0) {
        consume(pending.slice(0, index)); pending = pending.slice(index + 2);
      }
      if (packet.done) { if (pending.trim()) consume(pending); break; }
    }
    if (finishReason !== 'STOP') throw new Error(`پاسخ جریانی کامل نشد: ${finishReason || 'اتصال پیش از پایان قطع شد'}`);
    if (!text) throw new Error('Gemini پاسخ متنی برنگرداند.');
    return text;
  } finally {
    // Never wait on a broken network while releasing the reader.
    void reader.cancel().catch(() => {});
  }
}
