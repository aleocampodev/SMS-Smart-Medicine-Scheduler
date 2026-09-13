import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';

async function inspectQantyApi() {
  console.log('===========================================================');
  console.log('🔍 STARTING QANTY API DISCOVERY & TRAFFIC SNIFFER (IP-001)');
  console.log('===========================================================');

  const dumpsDir = path.resolve(process.cwd(), 'dumps', 'api');
  if (!fs.existsSync(dumpsDir)) {
    fs.mkdirSync(dumpsDir, { recursive: true });
  }

  const targetUrl = env.QANTY_PORTAL_URL;
  console.log(`[Sniffer] Target URL: ${targetUrl}`);
  console.log(`[Sniffer] Saving network dumps at: ${dumpsDir}\n`);

  const browser = await chromium.launch({
    headless: false, // Visible window so user can interact and select clinic/service
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  let captureCount = 0;
  const discoveredEndpoints: any[] = [];

  // 1. Intercept outgoing requests
  page.on('request', async (request) => {
    const url = request.url();
    if (url.includes('qanty.com/p/') || url.includes('qanty.com/api/')) {
      const method = request.method();
      const postData = request.postData();
      console.log(`\n➡️ [REQUEST ${++captureCount}] ${method} ${url}`);
      if (postData) {
        console.log(`   Payload: ${postData.slice(0, 300)}`);
      }

      const dump = {
        timestamp: new Date().toISOString(),
        method,
        url,
        headers: request.headers(),
        payload: postData ? safeParse(postData) : null,
      };

      const filename = `req_${captureCount}_${sanitizeUrl(url)}.json`;
      fs.writeFileSync(path.join(dumpsDir, filename), JSON.stringify(dump, null, 2));
    }
  });

  // 2. Intercept incoming responses
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('qanty.com/p/') || url.includes('qanty.com/api/')) {
      const status = response.status();
      console.log(`⬅️ [RESPONSE] Status ${status} for ${url}`);

      try {
        const text = await response.text();
        const json = safeParse(text);

        discoveredEndpoints.push({
          url,
          status,
          responseSample: json || text.slice(0, 200),
        });

        const filename = `res_${captureCount}_${sanitizeUrl(url)}.json`;
        fs.writeFileSync(
          path.join(dumpsDir, filename),
          JSON.stringify(
            {
              url,
              status,
              headers: response.headers(),
              body: json || text,
            },
            null,
            2
          )
        );
      } catch {
        // Ignore if unparseable
      }
    }
  });

  console.log('[Sniffer] Navigating to target portal...');
  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (err: any) {
    console.warn(`[Sniffer] Load notice:`, err.message);
  }

  console.log('\n👀 Browser window will remain open for 45 seconds.');
  console.log('   (Feel free to click or select branches in the UI to capture network traffic)');

  await page.waitForTimeout(45000);

  // Save consolidated summary
  const summaryPath = path.join(dumpsDir, 'discovered_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(discoveredEndpoints, null, 2));
  console.log(`\n✅ Consolidated summary saved to: ${summaryPath}`);

  await browser.close();
}

function safeParse(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function sanitizeUrl(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1].split('?')[0].replace(/[^a-zA-Z0-9_-]/g, '_');
}

inspectQantyApi().catch((err) => {
  console.error('[Sniffer Error]:', err);
  process.exit(1);
});
