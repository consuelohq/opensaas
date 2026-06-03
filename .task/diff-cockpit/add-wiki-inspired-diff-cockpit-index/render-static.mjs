import { renderIndexPage, renderReviewPage } from '../../../packages/diff-cockpit/src/index.ts';
import { writeFileSync } from 'node:fs';

writeFileSync('/tmp/diff-cockpit-index.html', renderIndexPage({ owner: 'consuelohq', repo: 'opensaas' }));
writeFileSync('/tmp/diff-cockpit-review.html', renderReviewPage({ owner: 'consuelohq', repo: 'opensaas', number: 722 }));
console.log('/tmp/diff-cockpit-index.html');
console.log('/tmp/diff-cockpit-review.html');
