import { AudioChunk } from '../types';

export const DEFAULT_CHUNK_MINUTES = 8;
export const MAX_INLINE_AUDIO_BYTES = 8 * 1024 * 1024;

export async function getAudioDuration(file: File): Promise<number> {
  return new Promise(resolve => {
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(file);
    const done = (duration: number) => {
      clearTimeout(timer); audio.removeAttribute('src'); audio.load();
      URL.revokeObjectURL(url); resolve(duration);
    };
    const timer = setTimeout(() => done(0), 15000);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.onerror = () => done(0);
    audio.src = url;
  });
}

function wavChunk(buffer: AudioBuffer, start: number, end: number): Blob {
  const frames = end - start;
  const bytes = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(bytes);
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + frames * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, frames * 2, true);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  for (let i = 0; i < frames; i++) {
    const sample = Math.max(-1, Math.min(1, channels.reduce((n, channel) => n + channel[start + i], 0) / channels.length));
    view.setInt16(44 + i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

export async function sliceAudioFile(file: File, parentFileId: string, maxMinutes = DEFAULT_CHUNK_MINUTES): Promise<AudioChunk[]> {
  if (!Number.isFinite(maxMinutes) || maxMinutes <= 0) throw new Error('مدت قطعه باید مثبت باشد.');
  const duration = await getAudioDuration(file);
  const make = (blob: Blob, i: number, total: number, offset: number, seconds: number): AudioChunk => ({
    chunkId: `${parentFileId}-chunk-${i}`, parentFileId, chunkIndex: i, totalChunks: total,
    timeOffsetSeconds: offset, durationSeconds: seconds, audioBlob: blob, status: 'pending', retries: 0,
  });
  const mimeTypes: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac' };
  if (duration > 0 && duration <= maxMinutes * 60 && file.size <= MAX_INLINE_AUDIO_BYTES) {
    const type = file.type || mimeTypes[file.name.split('.').pop()?.toLowerCase() || ''];
    if (!type) throw new Error('نوع فایل صوتی قابل تشخیص نیست.');
    return [make(file.slice(0, file.size, type), 0, 1, 0, duration)];
  }
  // Decode the container before splitting: byte slices of MP4/MP3 are not reliable audio files.
  const context = new AudioContext({ sampleRate: 16000 });
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    // Inline Base64 adds about 33% overhead. Keep the raw mono WAV at or below 8 MiB.
    const framesByTime = Math.max(1, Math.floor(maxMinutes * 60 * buffer.sampleRate));
    const framesBySize = Math.max(1, Math.floor((MAX_INLINE_AUDIO_BYTES - 44) / 2));
    const framesPerChunk = Math.min(framesByTime, framesBySize);
    const total = Math.ceil(buffer.length / framesPerChunk);
    return Array.from({ length: total }, (_, i) => {
      const start = i * framesPerChunk;
      const end = Math.min(buffer.length, start + framesPerChunk);
      return make(wavChunk(buffer, start, end), i, total, start / buffer.sampleRate, (end - start) / buffer.sampleRate);
    });
  } finally { await context.close(); }
}
