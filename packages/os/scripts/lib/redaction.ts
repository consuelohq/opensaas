const REDACTED = '[REDACTED]';
const REDACTED_SECRET = '[REDACTED_SECRET]';
const REDACTED_RAW_PAYLOAD = '[REDACTED_RAW_PAYLOAD]';

const SENSITIVE_KEY_PATTERN = /(?:password|passphrase|secret|token|api[_-]?key|authorization|cookie|credential|private[_-]?key|client[_-]?secret|session|jwt)/i;
const RAW_PAYLOAD_KEY_PATTERN = /^(?:raw|rawPayload|rawBody|requestBody|responseBody|body|payload)$/i;
const SENSITIVE_QUERY_KEY_PATTERN = /(?:password|passphrase|secret|token|api[_-]?key|authorization|cookie|credential|private[_-]?key|client[_-]?secret|session|jwt)/i;

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function approximateBytes(value) {
  try {
    return Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    return 0;
  }
}

function looksLikeSensitiveKey(key) {
  return SENSITIVE_KEY_PATTERN.test(key);
}

function looksLikeRawPayloadKey(key) {
  return RAW_PAYLOAD_KEY_PATTERN.test(key);
}

function redactUrlQuery(value) {
  try {
    const parsed = new URL(value);
    let changed = false;
    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEY_PATTERN.test(key)) {
        parsed.searchParams.set(key, REDACTED);
        changed = true;
      }
    }
    return changed ? parsed.toString() : value;
  } catch {
    return value;
  }
}

export function redactText(value) {
  let text = redactUrlQuery(String(value));
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, `Bearer ${REDACTED_SECRET}`);
  text = text.replace(/\b(sk|pk|rk|xox[baprs]|gh[pousr])_[A-Za-z0-9_=-]{12,}\b/g, REDACTED_SECRET);
  text = text.replace(/\b[A-Za-z0-9+/=_-]{40,}\b/g, (match) => {
    if (match.startsWith('trc_')) return match;
    return REDACTED_SECRET;
  });
  text = text.replace(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) return match;
    return `[REDACTED_PHONE:${digits.slice(-4)}]`;
  });
  return text;
}

function redactValueInternal(value, key, seen) {
  if (key && looksLikeSensitiveKey(key)) return REDACTED_SECRET;
  if (key && looksLikeRawPayloadKey(key)) {
    return {
      redacted: true,
      type: REDACTED_RAW_PAYLOAD,
      bytes: approximateBytes(value),
    };
  }

  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'bigint') return value.toString();
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (seen.has(value)) return '[REDACTED_CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactValueInternal(item, undefined, seen));
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactText(value.message),
    };
  }

  if (!isPlainObject(value)) {
    return redactText(String(value));
  }

  const output = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    output[entryKey] = redactValueInternal(entryValue, entryKey, seen);
  }
  return output;
}

export function redactJson(value) {
  return redactValueInternal(value, undefined, new WeakSet());
}

export function redactValue(value) {
  return redactJson(value);
}
