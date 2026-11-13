import { Mp3Encoder } from '@breezystack/lamejs';

self.onmessage = (event: MessageEvent<{ samples: Int16Array; sampleRate: number }>) => {
  try {
    const { samples, sampleRate } = event.data;
    const encoder = new Mp3Encoder(1, sampleRate, 24);
    const parts: Uint8Array<ArrayBuffer>[] = [];
    for (let offset = 0; offset < samples.length; offset += 1152) {
      const bytes = encoder.encodeBuffer(samples.subarray(offset, offset + 1152));
      if (bytes.length) parts.push(Uint8Array.from(bytes));
      if (offset % (1152 * 256) === 0) self.postMessage({ progress: offset / samples.length });
    }
    const tail = encoder.flush();
    if (tail.length) parts.push(Uint8Array.from(tail));
    self.postMessage({ blob: new Blob(parts, { type: 'audio/mpeg' }) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
