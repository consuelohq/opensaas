import { runDialerProductionSmoke } from '../src/release/production-release.js';

const baseUrl = process.env.DIALER_PRODUCTION_ORIGIN?.trim();
if (!baseUrl) throw new Error('DIALER_PRODUCTION_ORIGIN is required');
const result = await runDialerProductionSmoke({ baseUrl });
process.stdout.write(`${JSON.stringify(result)}\n`);
if (!result.ok) process.exit(1);
