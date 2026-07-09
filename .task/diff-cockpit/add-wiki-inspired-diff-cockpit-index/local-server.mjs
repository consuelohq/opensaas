import { createWorker } from '../../../packages/diff-cockpit/src/index.ts';

const worker = createWorker();
const env = { DIFF_COCKPIT_DEFAULT_REPO: 'consuelohq/opensaas' };

Bun.serve({
  port: 8788,
  fetch(request) {
    return worker.fetch(request, env);
  },
});

console.log('diff cockpit local server http://127.0.0.1:8788');
