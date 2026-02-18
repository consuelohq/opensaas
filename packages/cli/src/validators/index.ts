/** Validate Twilio credentials by calling the API */
export async function validateTwilio(
  accountSid: string,
  authToken: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      {
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        },
      },
    );
    return res.ok;
  } catch (_err: unknown) {
    // fetch failed — intentional: JSON parse fail
    return false;
  }
}

/** Validate Groq API key */
export async function validateGroq(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch (_err: unknown) {
    // fetch failed — intentional: JSON parse fail
    return false;
  }
}

/** Validate database connection */
export async function validateDatabase(url: string): Promise<boolean> {
  // basic URL validation — actual connection test would require pg client
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
  } catch (_err: unknown) {
    // invalid URL — intentional: JSON parse fail
    return false;
  }
}
