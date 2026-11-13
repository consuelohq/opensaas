type WaitingRequest = { start: () => void };

export class FairTranscriptionLimiter {
  private active = 0;
  private waiting = 0;
  private readonly calls = new Map<string, WaitingRequest[]>();
  private readonly rotation: string[] = [];
  constructor(
    private readonly limit: number,
    private readonly maxWaiting: number,
  ) {}

  run<T>(
    callKey: string,
    signal: AbortSignal,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (signal.aborted)
      return Promise.reject(new Error('transcription cancelled'));
    if (this.waiting >= this.maxWaiting)
      return Promise.reject(new Error('transcription queue full'));
    return new Promise<T>((resolve, reject) => {
      let started = false;
      const abort = () => {
        if (started) return;
        const queue = this.calls.get(callKey);
        const index = queue?.indexOf(request) ?? -1;
        if (queue && index >= 0) {
          queue.splice(index, 1);
          this.waiting--;
        }
        reject(new Error('transcription cancelled'));
      };
      const request: WaitingRequest = {
        start: () => {
          started = true;
          signal.removeEventListener('abort', abort);
          if (signal.aborted) {
            reject(new Error('transcription cancelled'));
            this.active--;
            this.pump();
            return;
          }
          Promise.resolve().then(operation)
            .then(resolve, reject)
            .finally(() => {
              this.active--;
              this.pump();
            });
        },
      };
      let queue = this.calls.get(callKey);
      if (!queue) {
        queue = [];
        this.calls.set(callKey, queue);
        this.rotation.push(callKey);
      }
      queue.push(request);
      this.waiting++;
      signal.addEventListener('abort', abort, { once: true });
      queueMicrotask(() => this.pump());
    });
  }

  private pump(): void {
    while (this.active < this.limit && this.rotation.length) {
      const key = this.rotation.shift();
      if (!key) continue;
      const queue = this.calls.get(key);
      const request = queue?.shift();
      if (queue?.length) this.rotation.push(key);
      else this.calls.delete(key);
      if (!request) continue;
      this.waiting--;
      this.active++; // Reserve before waking; newcomers cannot steal the released slot.
      request.start();
    }
  }
}
