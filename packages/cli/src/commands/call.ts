import { Dialer } from '@consuelo/dialer';
import { normalizePhone } from '@consuelo/contacts';
import { loadConfig } from '../config.js';
import { log, error, json, isJson } from '../output.js';
import { captureError } from '../sentry.js';

const E164_RE = /^\+1\d{10}$/;

export async function callCommand(number: string): Promise<void> {
  if (!number) {
    error('provide a number: consuelo call <number>');
    process.exit(1);
  }

  const to = normalizePhone(number);

  if (!E164_RE.test(to)) {
    error(`invalid phone number: ${number} — expected US format like +15551234567`);
    process.exit(1);
  }

  const config = loadConfig();
  if (!config.twilioAccountSid || !config.twilioAuthToken) {
    error('not configured — run `consuelo init` to set your Twilio credentials');
    process.exit(1);
  }
  if (!config.twilioPhoneNumber) {
    error('no phone number configured — run `consuelo init` to set your Twilio number');
    process.exit(1);
  }

  log(`calling ${to}...`);

  try {
    const dialer = new Dialer({
      credentials: {
        accountSid: config.twilioAccountSid,
        authToken: config.twilioAuthToken,
      },
      defaultNumber: config.twilioPhoneNumber,
    });

    const result = await dialer.dial({
      to,
      from: config.twilioPhoneNumber,
      userId: 'cli',
    });

    if (!result.success) {
      error(result.error ?? 'call failed');
      process.exit(1);
    }

    if (isJson()) {
      json({ callSid: result.callSid, to, from: result.fromNumber, status: 'initiated' });
    } else {
      log(`call initiated — sid: ${result.callSid}`);
      log(`from: ${result.fromNumber ?? config.twilioPhoneNumber}`);
      log(`to: ${to}`);
    }
  } catch (err: unknown) {
    captureError(err, { command: 'call' });
    error(err instanceof Error ? err.message : 'call failed');
    process.exit(1);
  }
}
