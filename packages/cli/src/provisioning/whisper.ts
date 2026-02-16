import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import * as https from 'node:https';
import * as os from 'node:os';
import ora from 'ora';
import { createLogger } from '@consuelo/logger';

import { captureError } from '../sentry.js';

const logger = createLogger('CLI:Whisper');

const MODELS = {
  tiny: {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    size: '75 MB',
    bytes: 78_000_000,
  },
  base: {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    size: '150 MB',
    bytes: 148_000_000,
  },
} as const;

const MODELS_DIR = path.join(os.homedir(), '.consuelo', 'models');

export type WhisperModelSize = keyof typeof MODELS;

export async function setupWhisper(modelSize: WhisperModelSize): Promise<string> {
  const model = MODELS[modelSize];
  const modelPath = path.join(MODELS_DIR, `whisper-${modelSize}.bin`);

  fs.mkdirSync(MODELS_DIR, { recursive: true });

  const spinner = ora(`Downloading whisper ${modelSize} model...`).start();
  try {
    await downloadWithProgress(model.url, modelPath, model.bytes, (progress) => {
      spinner.text = `Downloading whisper ${modelSize} model... ${progress}%`;
    });
    spinner.succeed('Model downloaded');
  } catch (err: unknown) {
    spinner.fail('Download failed');
    try { fs.unlinkSync(modelPath); } catch { /* cleanup best-effort */ }
    throw err;
  }

  spinner.start('Installing pywhispercpp...');
  try {
    execSync('pip install pywhispercpp', { stdio: 'ignore' });
    spinner.succeed('pywhispercpp installed');
  } catch {
    spinner.warn('pywhispercpp install skipped (pip not available)');
  }

  spinner.start('Verifying model...');
  const stats = fs.statSync(modelPath);
  if (stats.size < model.bytes * 0.9) {
    spinner.fail('Model file appears corrupted');
    try { fs.unlinkSync(modelPath); } catch { /* cleanup best-effort */ }
    throw new Error('Model file appears corrupted');
  }
  spinner.succeed('Model verified');

  logger.info(`\n✓ Local speech-to-text ready!\n  Model location: ${modelPath}\n`);
  return modelPath;
}

const MAX_REDIRECTS = 5;

function downloadWithProgress(
  url: string,
  dest: string,
  totalBytes: number,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    let downloaded = 0;
    let redirects = 0;

    file.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(new Error(`Failed to write model file: ${err.message}`, { cause: err }));
    });

    const doRequest = (targetUrl: string): void => {
      const client = targetUrl.startsWith('https') ? https : http;
      client.get(targetUrl, (response) => {
        if (response.statusCode && [301, 302, 307, 308].includes(response.statusCode)) {
          if (++redirects > MAX_REDIRECTS) {
            file.close();
            fs.unlink(dest, () => {});
            reject(new Error('Too many redirects'));
            return;
          }
          const loc = response.headers.location;
          if (loc) { response.resume(); doRequest(loc); return; }
        }

        if (!response.statusCode || response.statusCode >= 400) {
          file.close();
          fs.unlink(dest, () => {});
          const err = new Error(`Download failed: HTTP ${response.statusCode}`);
          captureError(err); // Sentry.captureException via wrapper
          reject(err);
          return;
        }

        response.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          const percent = Math.round((downloaded / totalBytes) * 100);
          onProgress(Math.min(percent, 100));
        });

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        file.close();
        fs.unlink(dest, () => {});
        reject(new Error(`Whisper model download error: ${err.message}`, { cause: err }));
      });
    };

    doRequest(url);
  });
}
