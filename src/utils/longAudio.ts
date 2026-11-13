import type { AudioChunk } from '../types';
import { get, set } from 'idb-keyval';

export const LONG_AUDIO_MINUTES = 30;
export const LONG_AUDIO_MAX_BYTES = 12 * 1024 * 1024;

async function encode(samples: Int16Array, sampleRate: number, signal: AbortSignal, onStatus: (text: string) => void): Promise<Blob> {
  signal.throwIfAborted();
  const worker = new Worker(new URL('./mp3.worker.ts', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const cleanup = () => { worker.terminate(); signal.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(signal.reason); };
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = event => { cleanup(); reject(new Error(event.message)); };
    worker.onmessage = event => {
      if (event.data.error) { cleanup(); reject(new Error(event.data.error)); }
      else if (event.data.blob) { cleanup(); resolve(event.data.blob); }
      else onStatus(`فشرده‌سازی MP3 در دستگاه: ${Math.round(event.data.progress * 100)}٪`);
    };
    worker.postMessage({ samples, sampleRate }, [samples.buffer]);
  });
}

export async function prepareLongAudio(file: File, parentFileId: string, signal: AbortSignal,
  onStatus: (text: string) => void, firstOnly = false): Promise<AudioChunk[]> {
  signal.throwIfAborted();
  const cacheKey = `smart_jozveh_mp3_30_v1:${parentFileId}:${file.size}:${file.lastModified}:${firstOnly}`;
  const cached = await get<AudioChunk[]>(cacheKey);
  if (cached?.length) return cached;
  onStatus('خواندن صوت برای آماده‌سازی فایل نیم‌ساعته…');
  const context = new AudioContext({ sampleRate: 16000 });
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    signal.throwIfAborted();
    const framesPerPart = Math.floor(buffer.sampleRate * LONG_AUDIO_MINUTES * 60);
    const total = firstOnly ? 1 : Math.ceil(buffer.length / framesPerPart);
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    const chunks: AudioChunk[] = [];
    for (let index = 0; index < total; index++) {
      signal.throwIfAborted();
      const start = index * framesPerPart;
      const count = Math.min(framesPerPart, buffer.length - start);
      const samples = new Int16Array(count);
      for (let i = 0; i < count; i++) {
        const mono = channels.reduce((sum, data) => sum + data[start + i], 0) / channels.length;
        samples[i] = Math.round(Math.max(-1, Math.min(1, mono)) * 32767);
      }
      const blob = await encode(samples, buffer.sampleRate, signal, onStatus);
      if (blob.size > LONG_AUDIO_MAX_BYTES) throw new Error('حجم MP3 آماده‌شده از سقف امن درخواست بیشتر است.');
      chunks.push({ chunkId: `${parentFileId}-long30-${index}`, parentFileId, chunkIndex: index,
        totalChunks: total, timeOffsetSeconds: start / buffer.sampleRate, durationSeconds: count / buffer.sampleRate,
        audioBlob: blob, status: 'pending', retries: 0 });
    }
    await set(cacheKey, chunks);
    return chunks;
  } finally { await context.close(); }
}
