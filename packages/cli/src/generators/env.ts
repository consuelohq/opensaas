import * as fs from 'node:fs';
import * as path from 'node:path';

export interface EnvConfig {
  deploymentType: 'hosted' | 'self-hosted';
  template?: 'full' | 'minimal' | 'api-only';
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
  groqApiKey?: string;
  databaseUrl?: string;
  apiKey?: string; // for hosted mode
  whisperModelPath?: string;
}

export function generateEnv(config: EnvConfig, outputPath = '.env'): void {
  const lines: string[] = ['# Consuelo Configuration', `# Generated at ${new Date().toISOString()}`, ''];

  lines.push(`CONSUELO_MODE="${config.deploymentType}"`);
  lines.push('');

  if (config.deploymentType === 'hosted') {
    if (config.apiKey) lines.push(`CONSUELO_API_KEY="${config.apiKey}"`);
  } else {
    lines.push('# Twilio');
    if (config.twilioAccountSid) lines.push(`TWILIO_ACCOUNT_SID="${config.twilioAccountSid}"`);
    if (config.twilioAuthToken) lines.push(`TWILIO_AUTH_TOKEN="${config.twilioAuthToken}"`);
    if (config.twilioPhoneNumber) lines.push(`TWILIO_PHONE_NUMBER="${config.twilioPhoneNumber}"`);
    lines.push('');
    lines.push('# AI');
    if (config.groqApiKey) lines.push(`GROQ_API_KEY="${config.groqApiKey}"`);
    lines.push('');
    lines.push('# Database');
    if (config.databaseUrl) lines.push(`DATABASE_URL="${config.databaseUrl}"`);
    if (config.whisperModelPath) {
      lines.push('');
      lines.push('# Local STT');
      lines.push(`WHISPER_MODEL_PATH="${config.whisperModelPath}"`);
    }
  }

  fs.writeFileSync(path.resolve(outputPath), lines.join('\n') + '\n', { mode: 0o600 });
}
