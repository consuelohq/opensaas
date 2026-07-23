import { redactText } from '../../scripts/lib/redaction';

const REDACTED = '[REDACTED_SECRET]';
const SENSITIVE_QUERY_KEY = /^(?:token|access_token|refresh_token|authorization|cookie|password|secret|api[_-]?key|credential|client[_-]?secret)$/i;

const redactUrl = (value: string): string => {
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) {
      parsed.username = REDACTED;
      parsed.password = '';
    }
    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEY.test(key)) parsed.searchParams.set(key, REDACTED);
    }
    return parsed.toString();
  } catch {
    return value;
  }
};

export const redactProviderText = (value: string): string => {
  let output = String(value).replace(/https?:\/\/[^\s]+/gi, (url) => redactUrl(url));
  output = output
    .replace(/\bAuthorization\s*[:=]\s*(?:Bearer|Basic)\s+[^\s,;]+/gi, `Authorization=${REDACTED}`)
    .replace(/\bBearer\s+[^\s,;]+/gi, `Bearer ${REDACTED}`)
    .replace(/\b(?:Cookie|Set-Cookie)\s*[:=]\s*[^\s]+/gi, `Cookie=${REDACTED}`)
    .replace(
      /\b(token|access_token|refresh_token|api[_-]?key|client[_-]?secret|secret|password|credential)\s*[:=]\s*[^\s,;]+/gi,
      `$1=${REDACTED}`,
    );
  return redactText(output);
};
