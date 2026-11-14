import { existsSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';
import { describe, expect, it } from 'vitest';
import { buildObservabilityTracesSite } from '../scripts/lib/observability-traces-site';

const browserTest = existsSync(chromium.executablePath()) ? it : it.skip;
const longSession = 'task/dialer/improve-approved-script-matching-and-authoring';
const longSource = '# Task Workflow\\n' + 'readable data '.repeat(1500);
const rows = [
  {
    id:'t1', traceId:'t1', name:'fs.read', branch:longSession,
    startTime:'2026-11-14T04:45:09Z', durationMs:317, inputTokens:14158,
    outputTokens:376, ok:true,status:'success',
    rawResolvedInputJson:{path:'packages/os/scripts/lib/observability-traces-site.ts',full:true},
    rawResultJson:{ok:true,code:'OK',data:{content:longSource}},
  },
  {
    id:'t2', traceId:'t2', name:'code.call', branch:longSession,
    startTime:'2026-11-14T04:45:07Z',durationMs:916,inputTokens:1250,
    outputTokens:250,ok:true,status:'success',
    rawResolvedInputJson:{language:'bun',mode:'verify',code:'const result = Bun.spawnSync({cmd:["bun","test","foo"]});'},
    rawResultJson:{ok:true,code:'OK',data:{stdout:'1 test passed'}},
  },
];

async function openFixture(browser: Browser, width: number, scheme: 'dark'|'light' = 'dark', fixtureRows: typeof rows = rows): Promise<Page> {
  const page = await browser.newPage({viewport:{width,height:820}, colorScheme:scheme});
  await page.route('**/*', route => {
    const pathname = new URL(route.request().url()).pathname;
    if(pathname==='/tracing') return route.fulfill({contentType:'text/html',body:buildObservabilityTracesSite()});
    if(pathname==='/gateway/traces/recent') return route.fulfill({json:{ok:true,data:{direction:'older',rows:fixtureRows,nextCursor:null}}});
    if(pathname==='/gateway/traces/events') return route.fulfill({contentType:'text/event-stream',body:'event: heartbeat\\ndata: {}\\n\\n'});
    return route.fulfill({status:404,body:''});
  });
  await page.goto('https://trace.test/tracing',{waitUntil:'domcontentloaded'});
  await page.locator('.trxRow[data-trace-key]').first().waitFor({state:'visible'});
  return page;
}

async function layout(page: Page) {
  return page.evaluate(() => {
    const get = (q:string) => document.querySelector<HTMLElement>(q)!;
    const rect = (q:string) => get(q).getBoundingClientRect();
    const scroll = get('.trxTableScroll');
    const visible = [...get('.trxHead').children]
      .filter(node => getComputedStyle(node).display !== 'none')
      .map(node => node.textContent?.trim() || '')
      .filter(Boolean);
    const session = get('.trxRow .trxBranch');
    const tokens = get('.trxRow .trxTokens');
    const input = get('.trxRow .trxInputCell');
    const output = get('.trxRow .trxOutputCell');
    return {
      visible,
      clientWidth:scroll.clientWidth,
      scrollWidth:scroll.scrollWidth,
      overflowX:getComputedStyle(scroll).overflowX,
      sessionWidth:session.getBoundingClientRect().width,
      tokensWidth:tokens.getBoundingClientRect().width,
      tokensClipped:tokens.clientWidth < tokens.scrollWidth,
      inputRight:input.getBoundingClientRect().right,
      outputRight:output.getBoundingClientRect().right,
      contentRight:scroll.getBoundingClientRect().right,
      timeHeaderCount:visible.filter(x=>x==='Time').length,
      headingPseudo:getComputedStyle(get('.trxHead > div:nth-child(2)'),'::before').content,
      rowRight:get('.trxRow').getBoundingClientRect().right,
      headerRight:get('.trxHead').getBoundingClientRect().right,
      rowGrid:getComputedStyle(get('.trxRow')).gridTemplateColumns,
      headerGrid:getComputedStyle(get('.trxHead')).gridTemplateColumns,
    };
  });
}

describe('Tracing responsive refinements', () => {
  browserTest('desktop restores horizontal access while showing everything through Output at wide widths',async () => {
    const browser = await chromium.launch({headless:true});
    try {
      const page = await openFixture(browser,1600);
      const wide = await layout(page);
      expect(wide.visible).toEqual(['Time','Tool','Latency','Tokens','Session','Input','Output','Node','Trace','Status','Cost']);
      expect(wide.scrollWidth).toBeGreaterThan(wide.clientWidth+200);
      expect(wide.overflowX).toBe('auto');
      expect(wide.sessionWidth).toBeGreaterThanOrEqual(340);
      expect(wide.tokensWidth).toBeGreaterThanOrEqual(78);
      expect(wide.tokensClipped).toBe(false);
      expect(wide.outputRight).toBeLessThanOrEqual(wide.contentRight+10);
      await page.evaluate(() => {
        const scroller = document.querySelector<HTMLElement>('.trxTableScroll')!;
        scroller.scrollLeft = scroller.scrollWidth;
      });
      await page.waitForTimeout(70);
      const cost = await page.locator('.trxRow .trxCost').first().boundingBox();
      expect(cost!.x+cost!.width).toBeLessThanOrEqual(1600);
      await page.close();

      const laptop = await openFixture(browser,1200);
      const smaller = await layout(laptop);
      expect(smaller.scrollWidth).toBeGreaterThan(smaller.clientWidth);
      expect(smaller.visible).toContain('Input');
      expect(smaller.inputRight).toBeLessThanOrEqual(smaller.contentRight+12);
      expect(smaller.sessionWidth).toBeGreaterThanOrEqual(270);
    } finally {await browser.close();}
  },30000);

  browserTest('tablet prioritizes Time, Tool, Session, Input without irrelevant Status and Cost',async () => {
    const browser=await chromium.launch({headless:true});
    try {
      const page=await openFixture(browser,820);
      const l=await layout(page);
      expect(l.visible).toContain('Time');
      expect(l.visible).toContain('Tool');
      expect(l.visible).toContain('Session');
      expect(l.visible).toContain('Input');
      expect(l.visible).not.toContain('Status');
      expect(l.visible).not.toContain('Cost');
      expect(l.sessionWidth).toBeGreaterThanOrEqual(260);
      expect(l.scrollWidth).toBeLessThanOrEqual(l.clientWidth+1);
    } finally {await browser.close();}
  },25000);

  browserTest('phone shows only Time, Tool and a readable Session, without duplicate headings or side-scrolling',async()=>{
    const browser=await chromium.launch({headless:true});
    try {
      for(const width of [390,430]){
        const page=await openFixture(browser,width);
        const l=await layout(page);
        expect(l.visible).toEqual(['Time','Tool','Session']);
        expect(l.timeHeaderCount).toBe(1);
        expect(l.headingPseudo).not.toBe('"Time"');
        expect(l.sessionWidth).toBeGreaterThanOrEqual(140);
        expect(l.scrollWidth).toBeLessThanOrEqual(l.clientWidth+1);
        await page.close();
      }
    }finally{await browser.close();}
  },25000);

  browserTest('wide tables stretch virtual rows to the same full width as the header',async()=>{
    const browser=await chromium.launch({headless:true});
    try{
      for(const width of [2000,2560]){
        const page=await openFixture(browser,width);
        const l=await layout(page);
        expect(l.rowRight).toBeCloseTo(l.headerRight,0);
        expect(l.rowGrid).toBe(l.headerGrid);
        expect(l.sessionWidth).toBeGreaterThanOrEqual(430);
        await page.close();
      }
    }finally{await browser.close();}
  },25000);

  browserTest('removes the visible ? button but still opens keyboard help with ?',async()=>{
    const browser=await chromium.launch({headless:true});
    try{
      const page=await openFixture(browser,1200);
      expect(await page.locator('[data-workspace-shortcuts]').count()).toBe(0);
      await page.keyboard.press('Shift+/');
      await page.getByRole('dialog',{name:'Keyboard shortcuts'}).waitFor({state:'visible'});
      await page.keyboard.press('Escape');
      expect(await page.getByRole('dialog',{name:'Keyboard shortcuts'}).count()).toBe(0);
    }finally{await browser.close();}
  },25000);

  browserTest('both color schemes unify main header/footer and subtly differentiate inset tool inspector',async()=>{
    const browser=await chromium.launch({headless:true});
    try{
      for(const scheme of ['dark','light'] as const){
        const page=await openFixture(browser,1400,scheme);
        const before=await page.evaluate(()=>{
          const background=(q:string)=>getComputedStyle(document.querySelector(q)!).backgroundColor;
          return {main:background('.trxTablePane'),header:background('.trxChrome'),footer:background('.trxFooter'),
            hoverButton:getComputedStyle(document.querySelector('.trxRow .trxToolCell')!).transform};
        });
        expect(before.header).toBe(before.main);
        expect(before.footer).toBe(before.main);
        expect(before.main).toBe(scheme==='dark'?'rgb(33, 33, 33)':'rgb(250, 250, 250)');
        // The Session cell intentionally filters; open via Tool instead.
        await page.locator('.trxRow[data-trace-key] .trxToolCell').first().click();
        await page.locator('.tiInspector .tiPeerList').waitFor({state:'visible',timeout:4000});
        const inner=await page.evaluate(()=>{
          const e=document.querySelector('.tiInspector')!;
          const p=document.querySelector('.tiPeer + .tiPeer')!;
          const style=getComputedStyle(p,'::before');
          return {bg:getComputedStyle(e).backgroundColor,left:style.left,right:style.right,underline:getComputedStyle(p).boxShadow};
        });
        expect(inner.bg).not.toBe(before.main);
        expect(parseFloat(inner.left)).toBeLessThan(parseFloat(inner.right));
        expect(inner.underline).not.toContain('rgb(215, 181, 109)');
        await page.close();
      }
    }finally{await browser.close();}
  },30000);

  browserTest('filter controls are borderless, search remains clearly editable, and text hover is restrained',async()=>{
    const browser=await chromium.launch({headless:true});
    try{
      const page=await openFixture(browser,1400);
      const inputCell = page.locator('.trxRow .trxInputCell').first();
      const outputCell = page.locator('.trxRow .trxOutputCell').first();
      expect(await inputCell.getAttribute('data-trace-tooltip'))
        .toContain('packages/os/scripts/lib/observability-traces-site.ts');
      expect(await outputCell.getAttribute('data-trace-tooltip'))
        .toMatch(/^(?:Read: Task Workflow|Returned [\d,]+ characters)$/);
      expect(await inputCell.evaluate(el => getComputedStyle(el).cursor)).toBe('pointer');
      expect(await outputCell.evaluate(el => getComputedStyle(el).cursor)).toBe('pointer');
      expect(await page.locator('.trxRow .trxTokens').first().evaluate(el => getComputedStyle(el).cursor)).toBe('pointer');
      const row=page.locator('.trxRow[data-trace-key]').first();
      await row.hover();
      const hover=await page.evaluate(()=>{
        const el=document.querySelector('.trxRow .trxToolCell')!;
        return {transform:getComputedStyle(el).transform,filter:getComputedStyle(el).filter};
      });
      const scalar=Number(hover.transform.startsWith('matrix(') ? hover.transform.slice(7).split(',')[0] : 1);
      expect(scalar).toBeLessThanOrEqual(1.02);
      expect(hover.filter).toMatch(/brightness/);
      await page.locator('[data-show-filters]').first().click();
      const css=await page.evaluate(()=>{
        const selectors=['[data-show-filters]','[data-trace-font-toggle]','.trxFilterSearch input','[data-filter-clear]'];
        return selectors.map(q=>{const e=document.querySelector(q);if(!e)return null;const s=getComputedStyle(e);return {q,border:s.borderTopWidth,bg:s.backgroundColor};});
      });
      for(const x of css.filter(Boolean) as Array<{q:string,border:string}>){
        expect(parseFloat(x.border)).toBe(0);
      }
    }finally{await browser.close();}
  },30000);

  browserTest('repeated arrows ignore synthetic pointerover after navigation until the pointer actually moves',async()=>{
    const browser=await chromium.launch({headless:true});
    try{
      const fixtures=Array.from({length:32},(_,i)=>({
        ...rows[0],
        id:'keyboard-'+i,traceId:'keyboard-'+i,
        startTime:new Date(Date.parse('2026-11-14T04:45:09Z')-i*1000).toISOString()
      }));
      const page=await openFixture(browser,1200,'dark',fixtures);
      const first=page.locator('.trxRow[data-trace-key="keyboard-0"]');
      await first.hover();
      await page.keyboard.press('ArrowDown');
      expect(await page.evaluate(()=>(window as typeof window & {__traceKeyboardKey?:string}).__traceKeyboardKey)).toBe('keyboard-1');
      // Scroll and virtualization can fire a pointerover at the stationary mouse.
      await first.dispatchEvent('pointerover',{pointerType:'mouse',clientX:120,clientY:210});
      await page.keyboard.press('ArrowDown');
      expect(await page.evaluate(()=>(window as typeof window & {__traceKeyboardKey?:string}).__traceKeyboardKey)).toBe('keyboard-2');
      await page.keyboard.press('ArrowDown');
      expect(await page.evaluate(()=>(window as typeof window & {__traceKeyboardKey?:string}).__traceKeyboardKey)).toBe('keyboard-3');
      expect(await page.locator('html').evaluate(el=>el.classList.contains('trace-keyboard-navigation'))).toBe(true);
      await page.keyboard.press('Enter');
      await page.waitForFunction(()=>document.querySelector('.tiInspector')?.getAttribute('data-ti-trace-key')==='keyboard-3');
      expect(await page.locator('.tiInspector').getAttribute('data-ti-trace-key')).toBe('keyboard-3');
      // Only a real cursor movement gives hover navigation back control.
      await page.mouse.move(350,600);
      expect(await page.locator('html').evaluate(el=>el.classList.contains('trace-keyboard-navigation'))).toBe(false);
      await page.close();
    }finally{await browser.close();}
  },30000);
});
