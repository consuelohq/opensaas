import { Dialer } from '@consuelo/dialer';
import { normalizePhone } from '@consuelo/contacts';
import { createLogger } from '@consuelo/logger';
import { loadConfig } from '../config.js';
import { log, error, json, isJson } from '../output.js';
import { captureError } from '../sentry.js';

const E164_RE = /^\+1\d{10}$/;

function maskPhone(phone: string): string {
  return phone.length > 4 ? '***' + phone.slice(-4) : phone;
}

export async function callCommand(number: string): Promise<void> {
  if (!number) {
    if (isJson()) {
      json({ error: { code: 'VALIDATION_ERROR', message: 'provide a number: consuelo call <number>' } });
    } else {
      error('provide a number: consuelo call <number>');
    }
    process.exit(1);
  }

  const to = normalizePhone(number);

  if (!E164_RE.test(to)) {
    if (isJson()) {
      json({ error: { code: 'VALIDATION_ERROR', message: 'invalid phone number — expected US format like +15551234567' } });
    } else {
      error('invalid phone number — expected US format like +15551234567');
    }
    process.exit(1);
  }

  const config = loadConfig();
  if (!config.twilioAccountSid || !config.twilioAuthToken) {
    if (isJson()) {
      json({ error: { code: 'VALIDATION_ERROR', message: 'not configured — run `consuelo init` to set your Twilio credentials' } });
    } else {
      error('not configured — run `consuelo init` to set your Twilio credentials');
    }
    process.exit(1);
  }
  if (!config.twilioPhoneNumber) {
    if (isJson()) {
      json({ error: { code: 'VALIDATION_ERROR', message: 'no phone number configured — run `consuelo init` to set your Twilio number' } });
    } else {
      error('no phone number configured — run `consuelo init` to set your Twilio number');
    }
    process.exit(1);
  }

  log(`calling ${maskPhone(to)}...`);

  try {
    const dialer = new Dialer({
      credentials: {
        accountSid: config.twilioAccountSid,
        authToken: config.twilioAuthToken,
      },
      defaultNumber: config.twilioPhoneNumber,
    });

    const dialOutcome = await dialer.dial({
      to,
      from: config.twilioPhoneNumber,
      userId: 'cli',
    });

    if (!dialOutcome.success) {
      error(dialOutcome.error ?? 'call failed');
      process.exit(1);
    }

    if (isJson()) {
      json({
        callSid: dialOutcome.callSid,
        to,
        from: dialOutcome.fromNumber,
        status: 'initiated',
      });
    } else {
      log(`call initiated — sid: ${dialOutcome.callSid}`);
      log(`from: ${dialOutcome.fromNumber ?? config.twilioPhoneNumber}`);
      log(`to: ${maskPhone(to)}`);
    }

    try {
      const logger = createLogger('cli:call');
      logger.info('call initiated', {
        action: 'call.initiated',
        to: `***${to.slice(-4)}`,
        from: dialOutcome.fromNumber ?? config.twilioPhoneNumber,
        callSid: dialOutcome.callSid,
      });
    } catch {
      // fall silent if logger unavailable
    }
  } catch (err: unknown) {
    captureError(err, { command: 'call' });

    try {
      const logger = createLogger('cli:call');
      logger.error('call failed', {
        action: 'call.failed',
        to: `***${to.slice(-4)}`,
        reason: err instanceof Error ? err.message : 'unknown error',
      });
    } catch {
      // fall silent if logger unavailable
    }

    const raw = err instanceof Error ? err.message : 'unknown error';
    if (isJson()) {
      json({ error: { code: 'CALL_FAILED', message: raw } });
    } else {
      error('call failed — check your credentials and try again');
    }
    process.exit(1);
  }
}
