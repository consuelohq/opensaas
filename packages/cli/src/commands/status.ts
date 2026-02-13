import { loadConfig } from '../config.js';
import { json, isJson } from '../output.js';
import { captureError } from '../sentry.js';
import { printBanner, info } from '../utils/ui.js';

export async function statusCommand(): Promise<void> {
  try {
    const config = loadConfig();
    if (isJson()) {
      json({ configured: !!config.twilioAccountSid || !!config.managed, config });
    } else {
      printBanner();
      if (config.managed) {
        info('mode: managed');
      } else if (config.twilioAccountSid) {
        info(`twilio: ${config.twilioAccountSid}`);
        info(`llm: ${config.llmProvider ?? 'groq'}`);
        info(`phone: ${config.twilioPhoneNumber ?? '(not set)'}`);
      } else {
        info('not configured — run `consuelo init`');
      }
    }
  } catch (err: unknown) {
    captureError(err, { command: 'status' });
    throw err;
  }
}
