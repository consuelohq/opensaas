import { describe, expect, it } from 'bun:test';
import { createAudioChunker } from './audio';
import { FairTranscriptionLimiter } from './limiter';

describe('fixture transcription capacity and billing model', () => {
  for (const calls of [1, 5, 20]) {
    it(
      calls +
        ' calls keep provider concurrency bounded and report request amplification',
      async () => {
        const limiter = new FairTranscriptionLimiter(4, calls * 2);
        let active = 0,
          peak = 0,
          requests = 0,
          billedSeconds = 0,
          submittedSeconds = 0;
        const started = performance.now();
        const tasks = Array.from({ length: calls }, (_, call) =>
          Promise.all(
            ['inbound', 'outbound'].map(async (track) => {
              const chunker = createAudioChunker({
                maxBytes: 16000,
                overlapBytes: 1600,
                vad: true,
              });
              const chunks = [];
              // Deterministic 10s track: 2s speech, 3s silence, 2s speech, 3s silence.
              for (let frame = 0; frame < 500; frame++)
                chunks.push(
                  ...chunker.push({
                    audio: new Uint8Array(160).fill(
                      frame < 100 || (frame >= 250 && frame < 350)
                        ? 0x20
                        : 0xff,
                    ),
                    timestampMs: frame * 20,
                    sequence: String(frame + 1),
                  }),
                );
              chunks.push(...chunker.flush());
              for (const chunk of chunks)
                await limiter.run(
                  String(call),
                  new AbortController().signal,
                  async () => {
                    active++;
                    peak = Math.max(peak, active);
                    requests++;
                    submittedSeconds += chunk.audio.length / 8000;
                    billedSeconds += Math.max(10, chunk.audio.length / 8000);
                    await new Promise((resolve) => setTimeout(resolve, 1));
                    active--;
                  },
                );
              expect(track).toBeTruthy();
            }),
          ),
        );
        await Promise.all(tasks);
        expect(peak).toBeLessThanOrEqual(4);
        expect(requests).toBe(calls * 4);
        expect(billedSeconds / (calls * 20)).toBe(2);
        expect(submittedSeconds).toBeLessThan(calls * 12);
        expect(performance.now() - started).toBeLessThan(5000);
      },
    );
  }
});
