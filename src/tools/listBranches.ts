import { chromium } from 'playwright';
import { env } from '../config/env.js';

interface BranchItem {
  id: string | number;
  name: string;
  city?: string;
  address?: string;
  state?: string;
  [key: string]: any;
}

/**
 * Branch Discovery Tool
 *
 * This script launches a browser instance to navigate to the Qanty appointment portal,
 * captures the `POST /p/get_branches` request/response, and displays a formatted
 * table of all available branches (sedes) and their corresponding IDs.
 */
async function listBranches(): Promise<void> {
  console.log('===========================================================');
  console.log('🏛️  QANTY BRANCH DISCOVERY & SELECTION TOOL');
  console.log('===========================================================');
  console.log(`[Config] Portal URL: ${env.QANTY_PORTAL_URL}`);
  console.log(`[Config] Current Target Branch: ${env.TARGET_BRANCH_NAME} (ID: ${env.TARGET_BRANCH_ID})`);
  console.log('\n[Browser] Launching browser to initialize session and intercept branches...');

  const browser = await chromium.launch({
    headless: false, // Visible browser so reCAPTCHA score is valid
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  let branchesFound: BranchItem[] = [];

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/p/get_branches')) {
      console.log(`\n[Network] Intercepted POST /p/get_branches (Status: ${response.status()})`);
      try {
        const text = await response.text();
        const json = JSON.parse(text);

        let list: BranchItem[] = [];
        if (Array.isArray(json)) {
          list = json;
        } else if (json && Array.isArray(json.branches)) {
          list = json.branches;
        } else if (json && Array.isArray(json.data)) {
          list = json.data;
        } else if (json && Array.isArray(json.items)) {
          list = json.items;
        }

        if (list.length > 0) {
          branchesFound = list;
          console.log(`\n✅ Successfully retrieved ${branchesFound.length} branches from Qanty API!\n`);
          printBranchesTable(branchesFound);
        }
      } catch (err: any) {
        console.warn('[Network] Error parsing /p/get_branches response:', err.message);
      }
    }
  });

  console.log('[Browser] Loading portal page...');
  try {
    await page.goto(env.QANTY_PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (err: any) {
    console.warn('[Browser] Navigation notice:', err.message);
  }

  console.log('[Browser] Waiting for branch list API response (up to 20 seconds)...');
  console.log('          (If the dropdown appears, click on the branch selector to trigger the API)');

  for (let i = 0; i < 20; i++) {
    if (branchesFound.length > 0) {
      break;
    }
    await page.waitForTimeout(1000);
  }

  if (branchesFound.length === 0) {
    console.log('\n⚠️  Notice: Branch call was not captured automatically in the first 20s.');
    console.log('   The browser window will remain open for 25 more seconds so you can interact with the branch selector.');
    await page.waitForTimeout(25000);
  } else {
    // Keep open 5 seconds so user can see it
    await page.waitForTimeout(5000);
  }

  await browser.close();
  console.log('\n[Finished] Discovery complete.');
}

function printBranchesTable(branches: BranchItem[]): void {
  console.log('┌────────────┬───────────────────────────────┬──────────────────────┬──────────┐');
  console.log('│ Branch ID  │ Name / Sede                   │ City / Department    │ Status   │');
  console.log('├────────────┼───────────────────────────────┼──────────────────────┼──────────┤');

  for (const b of branches) {
    const id = String(b.id || b.branch_id || '').padEnd(10);
    const name = String(b.name || b.branch_name || '').slice(0, 29).padEnd(29);
    const city = String(b.city || b.municipality || b.state || 'N/A').slice(0, 20).padEnd(20);
    const status = (b.active === false || b.status === 0 ? 'Inactive' : 'Active').padEnd(8);
    const isTarget = String(b.id) === env.TARGET_BRANCH_ID ? ' ⭐ TARGET' : '';

    console.log(`│ ${id} │ ${name} │ ${city} │ ${status}│${isTarget}`);
  }

  console.log('└────────────┴───────────────────────────────┴──────────────────────┴──────────┘');
  console.log('\n💡 To configure your target branch, update your .env file:');
  console.log(`   TARGET_BRANCH_ID="${env.TARGET_BRANCH_ID}"`);
  console.log(`   TARGET_BRANCH_NAME="${env.TARGET_BRANCH_NAME}"\n`);
}

listBranches().catch((err) => {
  console.error('[Error] Branch listing failed:', err);
  process.exit(1);
});
