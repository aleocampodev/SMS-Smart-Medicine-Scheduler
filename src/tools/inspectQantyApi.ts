import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';

async function inspectQantyApi() {
  console.log('===========================================================');
  console.log('🔍 INICIANDO DESCUBRIMIENTO DE LA API DE QANTY (IP-001)');
  console.log('===========================================================');

  const dumpsDir = path.resolve(process.cwd(), 'dumps', 'api');
  if (!fs.existsSync(dumpsDir)) {
    fs.mkdirSync(dumpsDir, { recursive: true });
  }

  const targetUrl = env.QANTY_PORTAL_URL;
  console.log(`[Sniffer] URL Objetivo: ${targetUrl}`);
  console.log(`[Sniffer] Guardando volcados de red en: ${dumpsDir}\n`);

  const browser = await chromium.launch({
    headless: false, // Abrir ventana visible para que el usuario pueda ver/interactuar si lo desea
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

  // 1. Interceptar solicitudes salientes
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

  // 2. Interceptar respuestas entrantes
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('qanty.com/p/') || url.includes('qanty.com/api/')) {
      const status = response.status();
      console.log(`⬅️ [RESPONSE] Status ${status} para ${url}`);

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
        // Ignorar si no es parseable
      }
    }
  });

  console.log('[Sniffer] Navegando al portal...');
  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (err: any) {
    console.warn(`[Sniffer] Advertencia al cargar:`, err.message);
  }

  console.log('\n👀 La ventana del navegador permanecerá abierta por 45 segundos.');
  console.log('   (Puedes hacer clic en la página o seleccionar sede para capturar el tráfico)');

  await page.waitForTimeout(45000);

  // Guardar resumen consolidado
  const summaryPath = path.join(dumpsDir, 'discovered_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(discoveredEndpoints, null, 2));
  console.log(`\n✅ Resumen consolidado guardado en: ${summaryPath}`);

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
