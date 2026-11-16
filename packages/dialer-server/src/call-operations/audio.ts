export type AudioChunk = {
  audio: Uint8Array;
  startMs: number;
  endMs: number;
  sequenceStart: string;
  sequenceEnd: string;
  overlapMs: number;
  gapBefore?: { startMs: number; endMs: number };
};

const concatenate = (parts: Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

// G.711 mu-law linear PCM energy; this is a conservative silence gate, not diarization.
export const mulawRms = (audio: Uint8Array): number => {
  let energy = 0;
  for (const sample of audio) {
    const value = ~sample & 0xff;
    const magnitude = (((value & 15) << 3) + 132) << ((value >> 4) & 7);
    const pcm = magnitude - 132;
    energy += pcm * pcm;
  }
  return Math.sqrt(energy / Math.max(1, audio.length));
};

export const createAudioChunker = (config: {
  maxBytes: number;
  overlapBytes?: number;
  vad?: boolean;
  silenceMs?: number;
  minUtteranceMs?: number;
}) => {
  const maxBytes = Math.max(1, Math.floor(config.maxBytes));
  const overlapBytes = Math.max(
    0,
    Math.min(Math.floor(config.overlapBytes ?? 0), Math.floor(maxBytes / 4)),
  );
  let parts: Uint8Array[] = [];
  let bytes = 0;
  let startMs = 0;
  let endMs = 0;
  let sequenceStart = '0';
  let sequenceEnd = '0';
  let overlapMs = 0;
  let tail = new Uint8Array();
  let lastEndMs: number | null = null;
  let lastSequence = -1;
  let silenceBytes = 0;
  let gapBefore: AudioChunk['gapBefore'];
  const take = (retainOverlap: boolean): AudioChunk | null => {
    if (bytes === 0) return null;
    const audio = concatenate(parts);
    const chunk: AudioChunk = {
      audio,
      startMs,
      endMs,
      sequenceStart,
      sequenceEnd,
      overlapMs,
      ...(gapBefore ? { gapBefore } : {}),
    };
    tail =
      retainOverlap && overlapBytes
        ? audio.slice(-overlapBytes)
        : new Uint8Array();
    parts = [];
    bytes = 0;
    overlapMs = 0;
    gapBefore = undefined;
    silenceBytes = 0;
    return chunk;
  };
  return {
    get bufferedBytes() {
      return bytes + tail.length;
    },
    push(frame: {
      audio: Uint8Array;
      timestampMs: number;
      sequence: string;
    }): AudioChunk[] {
      const output: AudioChunk[] = [];
      const sequence = Number(frame.sequence);
      if (sequence <= lastSequence || !Number.isSafeInteger(sequence))
        return output;
      lastSequence = sequence;
      let audio = frame.audio;
      let timestampMs = frame.timestampMs;
      if (lastEndMs !== null && timestampMs < lastEndMs) {
        const trim = Math.min(
          audio.length,
          Math.round((lastEndMs - timestampMs) * 8),
        );
        audio = audio.subarray(trim);
        timestampMs += trim / 8;
      }
      if (!audio.length) return output;
      if (lastEndMs !== null && timestampMs > lastEndMs + 0.125) {
        const previous = take(false);
        if (previous) output.push(previous);
        tail = new Uint8Array();
        gapBefore = { startMs: lastEndMs, endMs: timestampMs };
      }
      lastEndMs = timestampMs + audio.length / 8;
      const silent = config.vad === true && mulawRms(audio) < 200;
      if (silent && bytes === 0) {
        tail = new Uint8Array();
        return output;
      }
      if (bytes === 0) {
        if (tail.length) {
          parts.push(tail);
          bytes += tail.length;
          overlapMs = tail.length / 8;
        }
        startMs = timestampMs - overlapMs;
        sequenceStart = frame.sequence;
      }
      let offset = 0;
      while (offset < audio.length) {
        const length = Math.min(maxBytes - bytes, audio.length - offset);
        parts.push(audio.subarray(offset, offset + length));
        bytes += length;
        offset += length;
        sequenceEnd = frame.sequence;
        endMs = timestampMs + offset / 8;
        silenceBytes = silent ? silenceBytes + length : 0;
        const utteranceDone =
          silenceBytes / 8 >= (config.silenceMs ?? 320) &&
          endMs - startMs >= (config.minUtteranceMs ?? 240);
        if (bytes >= maxBytes || utteranceDone) {
          const chunk = take(!utteranceDone);
          if (chunk) output.push(chunk);
          if (offset < audio.length && !silent) {
            if (tail.length) {
              parts.push(tail);
              bytes = tail.length;
              overlapMs = tail.length / 8;
            }
            startMs = timestampMs + offset / 8 - overlapMs;
            sequenceStart = frame.sequence;
          } else if (silent) break;
        }
      }
      return output;
    },
    flush(): AudioChunk[] {
      const chunk = take(false);
      tail = new Uint8Array();
      return chunk ? [chunk] : [];
    },
    clear(): void {
      parts = [];
      bytes = 0;
      tail = new Uint8Array();
    },
  };
};

export const buildMulawWav = (audio: Uint8Array): Uint8Array => {
  const header = Buffer.alloc(46);
  const sampleRate = 8_000;
  const channels = 1;
  const bitsPerSample = 8;
  header.write('RIFF', 0);
  header.writeUInt32LE(38 + audio.byteLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(18, 16);
  header.writeUInt16LE(7, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels, 28);
  header.writeUInt16LE(channels, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.writeUInt16LE(0, 36);
  header.write('data', 38);
  header.writeUInt32LE(audio.byteLength, 42);
  const wav = new Uint8Array(header.byteLength + audio.byteLength);
  wav.set(header, 0);
  wav.set(audio, header.byteLength);
  return wav;
};
