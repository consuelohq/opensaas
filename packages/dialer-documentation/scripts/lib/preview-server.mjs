import { preview } from 'astro';
import { fileURLToPath } from 'node:url';

const server = await preview({ root: fileURLToPath(new URL('../../', import.meta.url)), server: { host: '127.0.0.1', port: Number(process.argv[2]) } });
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  try { await server.stop(); } finally { process.exit(0); }
};
process.on('message', (message) => { if (message === 'stop') void stop(); });
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
process.send?.('ready');
