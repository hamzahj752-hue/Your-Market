import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:4028';

const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '1440x900', width: 1440, height: 900 },
];

const ROUTES = [
  '/',
  '/products',
  '/cart',
  '/account',
  '/checkout',
  '/account/send-product',
];

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];
  const consoleErrors = [];
  const networkErrors = [];

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });

    const errors = [];
    const nets = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('requestfailed', (req) => {
      nets.push(`FAIL ${req.url()} - ${req.failure()?.errorText || 'unknown'}`);
    });

    page.on('response', (res) => {
      if (res.status() >= 400 && !res.url().includes('favicon')) {
        const status = res.status();
        const url = res.url();
        if (status >= 400) {
          nets.push(`${status} ${url.replace(BASE, '')}`);
        }
      }
    });

    for (const route of ROUTES) {
      const url = `${BASE}${route}`;
      try {
        const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        const status = resp?.status() || 'N/A';

        // Body overflow check
        const overflow = await page.evaluate(() => {
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            overflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          };
        });

        results.push({
          viewport: vp.name,
          route,
          status,
          overflow: overflow.overflows ? `${overflow.scrollWidth} > ${overflow.clientWidth}` : 'OK',
        });
      } catch (e) {
        results.push({ viewport: vp.name, route, status: 'ERROR', overflow: e.message });
      }
    }

    consoleErrors.push({ viewport: vp.name, errors });
    networkErrors.push({ viewport: vp.name, nets });

    await page.close();
  }

  await browser.close();

  console.log('\n=== ROUTE STATUS ===');
  console.log('Route'.padEnd(30) + '320x568'.padEnd(12) + '360x800'.padEnd(12) + '390x844'.padEnd(12) + '430x932'.padEnd(12) + '1440x900');
  for (const route of ROUTES) {
    const row = [route.padEnd(30)];
    for (const vp of VIEWPORTS) {
      const r = results.find((x) => x.route === route && x.viewport === vp.name);
      row.push(String(r?.status || '?').padEnd(12));
    }
    console.log(row.join(''));
  }

  console.log('\n=== BODY OVERFLOW ===');
  console.log('Route'.padEnd(30) + '320x568'.padEnd(12) + '360x800'.padEnd(12) + '390x844'.padEnd(12) + '430x932'.padEnd(12) + '1440x900');
  for (const route of ROUTES) {
    const row = [route.padEnd(30)];
    for (const vp of VIEWPORTS) {
      const r = results.find((x) => x.route === route && x.viewport === vp.name);
      row.push(String(r?.overflow || '?').padEnd(12));
    }
    console.log(row.join(''));
  }

  console.log('\n=== NETWORK 4xx/5xx ===');
  for (const { viewport, nets } of networkErrors) {
    const errors45xx = nets.filter((n) => n.startsWith('4') || n.startsWith('5'));
    if (errors45xx.length > 0) {
      console.log(`${viewport}:`);
      errors45xx.forEach((n) => console.log(`  ${n}`));
    }
  }

  console.log('\n=== CONSOLE ERRORS ===');
  for (const { viewport, errors } of consoleErrors) {
    if (errors.length > 0) {
      console.log(`${viewport}: ${errors.length} errors`);
      errors.slice(0, 3).forEach((e) => console.log(`  ${e.slice(0, 150)}`));
    }
  }
}

run().catch(console.error);
