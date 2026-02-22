import { Dialer } from '@consuelo/dialer';
import { normalizePhone } from '@consuelo/contacts';
import { createLogger } from '@consuelo/logger';
import { loadConfig } from '../config.js';
import { log, error, json, isJson } from '../output.js';
import { handleCommandError } from '../errors.js';

const E164_RE = /^\+1\d{10}$/;

function maskPhone(phone: string): string {
  return phone.length > 4 ? '***' + phone.slice(-4) : '****';
}

const auditLog = {
  info: (msg: string, data: Record<string, unknown>) => {
    try { createLogger('cli:call').info(msg, data); } catch { /* logger unavailable */ }
  },
  error: (msg: string, data: Record<string, unknown>) => {
    try { createLogger('cli:call').error(msg, data); } catch { /* logger unavailable */ }
  },
};

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
      const message = dialOutcome.error ?? 'call failed';
      if (isJson()) {
        json({ error: { code: 'DIAL_FAILED', message } });
      } else {
        error(message);
      }
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

    auditLog.info('call.initiated', {
      action: 'call.initiated',
      to: `***${to.slice(-4)}`,
      from: maskPhone(dialOutcome.fromNumber ?? config.twilioPhoneNumber),
      callSid: dialOutcome.callSid,
    });
  } catch (err: unknown) {
    auditLog.error('call.failed', {
      action: 'call.failed',
      to: `***${to.slice(-4)}`,
      from: maskPhone(config.twilioPhoneNumber),
      reason: err instanceof Error ? err.message : 'unknown error',
    });

    handleCommandError(err, {
      code: 'CALL_FAILED',
      friendlyMessage: 'call failed — check your credentials and try again',
      command: 'call',
    });
  }
}
