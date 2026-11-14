import { describe, expect, it } from 'bun:test';
import { createAudioChunker } from './audio';

describe('bounded mu-law utterance chunks', () => {
  it('bounds continuous speech latency, retains source time and deduplicates overlapping audio', () => {
    const chunker = createAudioChunker({
      maxBytes: 16000,
      overlapBytes: 1600,
      vad: false,
    });
    const chunks = [];
    for (let i = 0; i < 110; i++)
      chunks.push(
        ...chunker.push({
          audio: new Uint8Array(160).fill(0x20),
          timestampMs: i * 20,
          sequence: String(i + 1),
        }),
      );
    chunks.push(...chunker.flush());
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ startMs: 0, endMs: 2000, overlapMs: 0 });
    expect(chunks[1]).toMatchObject({
      startMs: 1800,
      endMs: 2200,
      overlapMs: 200,
    });
    expect(
      chunker.push({
        audio: new Uint8Array(160),
        timestampMs: 2000,
        sequence: '1',
      }),
    ).toEqual([]);
    expect(chunker.bufferedBytes).toBe(0);
  });
  it('flushes at gaps instead of inventing contiguous audio and ignores pure silence', () => {
    const chunker = createAudioChunker({
      maxBytes: 16000,
      overlapBytes: 1600,
      vad: true,
    });
    for (let i = 0; i < 100; i++)
      expect(
        chunker.push({
          audio: new Uint8Array(160).fill(0xff),
          timestampMs: i * 20,
          sequence: String(i + 1),
        }),
      ).toEqual([]);
    expect(chunker.flush()).toEqual([]);
    chunker.push({
      audio: new Uint8Array(1600).fill(0x20),
      timestampMs: 2100,
      sequence: '101',
    });
    const beforeGap = chunker.push({
      audio: new Uint8Array(1600).fill(0x20),
      timestampMs: 2500,
      sequence: '102',
    });
    expect(beforeGap).toHaveLength(1);
    const afterGap = chunker.flush();
    expect(afterGap[0]?.gapBefore).toEqual({ startMs: 2300, endMs: 2500 });
    expect(afterGap[0]?.startMs).toBe(2500);
  });
  it('ends a spoken utterance after bounded silence without making a request per silent frame', () => {
    const chunker = createAudioChunker({
      maxBytes: 16000,
      overlapBytes: 0,
      vad: true,
    });
    chunker.push({
      audio: new Uint8Array(4000).fill(0x20),
      timestampMs: 0,
      sequence: '1',
    });
    const chunks = chunker.push({
      audio: new Uint8Array(3200).fill(0xff),
      timestampMs: 500,
      sequence: '2',
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.endMs).toBe(900);
    expect(chunker.flush()).toEqual([]);
  });
});
