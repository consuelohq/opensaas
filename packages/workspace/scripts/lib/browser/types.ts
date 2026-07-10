import type { Effect } from 'effect';

export type BrowserConfig = {
  profilePath: string;
  screenshotDir: string;
  defaultTimeoutMs: number;
};

export type BrowserProcessRequest = {
  args: string[];
  timeoutMs?: number;
};

export type BrowserProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  runtimeMissing: boolean;
};

export type BrowserProcess = {
  run: (request: BrowserProcessRequest) => Effect.Effect<BrowserProcessResult, Error>;
};

export type BrowserContext = {
  config: BrowserConfig;
  process: BrowserProcess;
};

export type BrowserOpenInput = {
  url: string;
  headed?: boolean;
};

export type BrowserHeadedResult = {
  mode: 'headed';
  profilePath: string;
  url: string;
  title: string;
  leftRunning: true;
};

export type BrowserOpenResult = {
  mode: 'existing';
  profilePath: string;
  url: string;
  leftRunning: true;
};

export type BrowserStatus = {
  profilePath: string;
  reachable: boolean;
  sessionSummary: string;
  url: string;
  title: string;
};
