import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { startDocumentationPreviewServer, stopDocumentationServer } from './lib/documentation-browser-test.mjs';

const reserve = (port = 0) => new Promise((resolve, reject) => {
  const listener = createServer();
  listener.once('error', reject);
  listener.listen(port, '127.0.0.1', () => resolve(listener));
});
const close = (listener) => new Promise((resolve) => listener.close(resolve));
await assert.rejects(
  startDocumentationPreviewServer({ port: -1 }),
  /Unable to start documentation preview on port -1/,
  'Invalid port input must produce a bounded startup diagnostic',
);
const unrelated = await reserve();
const occupiedPort = unrelated.address().port;
try {
  await assert.rejects(startDocumentationPreviewServer({ port: occupiedPort }), { code: 'EADDRINUSE' });
  assert.equal(unrelated.listening, true, 'An unrelated server must stay running');
} finally { await close(unrelated); }

for (const shouldFail of [false, true]) {
  const reservation = await reserve();
  const port = reservation.address().port;
  await close(reservation);
  const server = await startDocumentationPreviewServer({ port });
  let output = '';
  server.stdout.on('data', (chunk) => { output = (output + chunk).slice(-3000); });
  server.stderr.on('data', (chunk) => { output = (output + chunk).slice(-3000); });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Preview did not become ready: ' + output)), 30000);
      server.once('message', () => { clearTimeout(timer); resolve(); });
      server.once('exit', (code) => { clearTimeout(timer); reject(new Error('Preview exited: ' + code + ' ' + output)); });
    });
    assert.equal((await fetch('http://127.0.0.1:' + port)).status, 200);
    if (shouldFail) throw new Error('fixture failure');
  } catch (error) {
    if (!shouldFail || error.message !== 'fixture failure') throw error;
  } finally { await stopDocumentationServer(server); }
  const proof = await reserve(port);
  await close(proof);
}
process.stdout.write('Preview pass/failure cleanup and occupied-port isolation passed.\n');
