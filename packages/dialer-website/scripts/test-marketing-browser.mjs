import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const artifactRoot = process.env.DIALER_MARKETING_ARTIFACT_DIR || '/tmp/consuelo-dialer-website-browser';
mkdirSync(artifactRoot, { recursive: true });
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain'};
const server = createServer((request, response) => {
 let route;
 try { route = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); } catch { response.writeHead(400).end(); return; }
 let file = resolve(dist, '.' + route);
 if (file !== dist && !file.startsWith(dist + '/')) { response.writeHead(404).end(); return; }
 if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
 if (!existsSync(file)) { response.writeHead(404).end(); return; }
 response.setHeader('Content-Type',mime[extname(file)] || 'application/octet-stream');
 response.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.DIALER_MARKETING_BASE_URL || 'http://127.0.0.1:' + server.address().port;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || [
 '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
 '/usr/bin/google-chrome',
 '/opt/google/chrome/chrome',
 '/usr/bin/chromium',
 '/usr/bin/chromium-browser',
].find(candidate => existsSync(candidate));
const browser = await chromium.launch({ executablePath });
const emit = (value) => process.stdout.write(JSON.stringify(value) + '\n');
const allSizes = [[320,568],[375,812],[430,932],[568,320],[667,375],[768,1024],[1024,768],[1440,960]];
const sizes = process.argv.includes('--smoke') ? [[375,812]] : allSizes;
try {
 for (const [width,height] of sizes) {
  const context = await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) errors.push(response.status() + ' ' + new URL(response.url()).pathname); });
  await page.goto(base + '/', {waitUntil:'networkidle'});
  await page.evaluate(() => document.fonts.ready);
  const geometry = await page.evaluate(() => {
   const hero=document.querySelector('[data-hero-heading]');
   const navs=[...document.querySelectorAll('header nav')].filter(n=>getComputedStyle(n).display!=='none');
   const headerBottom=Math.max(...navs.map(n=>n.getBoundingClientRect().bottom));
   return {overflow:document.documentElement.scrollWidth>innerWidth+1,headingTop:hero.getBoundingClientRect().top,headerBottom};
  });
  if (geometry.overflow || geometry.headingTop < geometry.headerBottom-1) { emit({viewport:width+'x'+height,geometry}); await page.screenshot({path:join(artifactRoot,'layout-failure.png')}); }
  assert.equal(geometry.overflow,false,'Homepage overflow at '+width+'x'+height);
  assert.ok(geometry.headingTop >= geometry.headerBottom-1,'Header overlaps headline at '+width+'x'+height);
  assert.match(await page.locator('h1').innerText(),/Turn more leads/);
  assert.equal(await page.locator('.product-story__chapter').count(),5);
  const clouds = await page.locator('.cloud-field img').count();
  const badImages = await page.locator('img').evaluateAll(images=>images.filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.getAttribute('src')));
  assert.deepEqual(badImages,[],'Missing image at '+width+'x'+height);
  const faq=page.locator('[data-home-faq-item]');
  await faq.nth(0).locator('summary').click();
  assert.equal(await faq.nth(0).getAttribute('open'),'');
  await faq.nth(1).locator('summary').click();
  await page.waitForFunction(()=>!document.querySelector('[data-home-faq-item]').open);
  assert.equal(await faq.nth(1).getAttribute('open'),'');
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  await page.waitForFunction(()=>!document.querySelector('[data-cloud-reveal]').hasAttribute('inert'));
  const close=page.locator('.cloud-cta__primary');
  const box=await close.boundingBox();
  assert.ok(box && box.y>=0 && box.y+box.height<=height+1,'Footer CTA clipped at '+width+'x'+height);
  await close.click();
  const destination = new URL(page.url()).pathname;
  assert.ok(destination === '/get-started' || destination === '/get-started/', 'Setup CTA reaches the setup page');
  assert.deepEqual(errors,[],'Browser errors at '+width+'x'+height);
  await page.goto(base+'/',{waitUntil:'networkidle'});
  if ([375,568,1440].includes(width)) await page.screenshot({path:join(artifactRoot,'home-'+width+'x'+height+'.png'),fullPage:width===1440});
  emit({viewport:width+'x'+height,passed:true,cloudImages:clouds});
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});
 const page=await context.newPage();
 await page.goto(base+'/pricing',{waitUntil:'networkidle'});
 assert.equal(await page.locator('[data-plan-code]').count(),3);
 await page.locator('[data-plan-code="standard"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-selected-plan]').textContent.includes('Standard'));
 assert.match(await page.locator('[data-selected-plan]').innerText(),/\$99/);
 assert.match(await page.locator('[data-setup-request]').getAttribute('href'),/^mailto:support@consuelohq.com\?/);
 for (const bad of ['__proto__','<img src=x onerror=alert(1)>']) {
  await page.goto(base+'/get-started?plan='+encodeURIComponent(bad),{waitUntil:'networkidle'});
  assert.match(await page.locator('[data-selected-plan]').innerText(),/^Tell us/);
  assert.equal(await page.locator('img[src="x"]').count(),0);
 }
 const paths=['/','/pricing','/get-started','/guides','/how-it-works','/contact','/privacy','/terms','/support'];
 let linkCount=0;
 const checkedTargets = new Map();
 for (const path of paths) {
  await page.goto(base+path,{waitUntil:'networkidle'});
  const hrefs=await page.locator('a[href]').evaluateAll(links=>links.map(a=>a.getAttribute('href')).filter(h=>h.startsWith('/')&&!h.startsWith('//')));
  for (const href of new Set(hrefs)) {
   const target=new URL(href,base);
   let result = checkedTargets.get(target.href);
   if (!result) {
    const response=await fetch(target, {signal:AbortSignal.timeout(8000)});
    result={status:response.status,html:await response.text()};
    checkedTargets.set(target.href,result);
   }
   const html=result.html;
   assert.equal(result.status,200,'Broken internal link '+href+' on '+path);
   if (target.hash) {
    const id=decodeURIComponent(target.hash.slice(1));
    assert.ok(html.includes('id="'+id+'"')||html.includes("id='"+id+"'"),'Missing anchor '+href);
   }
   linkCount++;
  }
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
 }
 await page.goto(base+'/pricing',{waitUntil:'networkidle'});
 await page.screenshot({path:join(artifactRoot,'pricing-1440x960.png'),fullPage:true});
 await context.close();
 const motion=await browser.newContext({viewport:{width:667,height:375},reducedMotion:'no-preference'});
 const motionPage=await motion.newPage();
 await motionPage.goto(base+'/',{waitUntil:'networkidle'});
 await motionPage.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
 await motionPage.waitForFunction(()=>!document.querySelector('[data-cloud-reveal]').hasAttribute('inert'));
 await motion.close();
 const fragmentContext = await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'no-preference'});
 const fragmentPage = await fragmentContext.newPage();
 for (const from of [null, '/pricing']) {
  if (from) await fragmentPage.goto(base+from,{waitUntil:'networkidle'});
  await fragmentPage.goto(base+'/#features',{waitUntil:'networkidle'});
  await fragmentPage.waitForFunction(() => {
   const target=document.getElementById('features');
   return target && scrollY>100 && target.getBoundingClientRect().top<innerHeight;
  }, undefined, {timeout:5000});
 }
 await fragmentContext.close();
 emit({flow:'pricing-to-setup',querySafety:'pass',internalLinks:linkCount,motion:'pass',artifacts:artifactRoot});
} finally {
 emit({cleanup:'closing browser'});
 await browser.close();
 emit({cleanup:'closing server'});
 server.closeAllConnections();
 await new Promise(resolve => server.close(resolve));
 emit({cleanup:'complete'});
}


