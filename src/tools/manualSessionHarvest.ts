import { chromium } from "playwright";
import { env } from "../config/env.js";
import { QantyClient, BRANCH_FIRESTORE_MAP } from "../poller/qantyClient.js";
import { RulesEngine } from "../poller/rulesEngine.js";
import { SessionHarvester } from "../poller/sessionHarvester.js";

/**
 * Manual Session Harvest & Availability Check
 *
 * Anti-bot (reCAPTCHA v3) may reject fully automated browsers with code 'BOT'.
 * This tool opens a VISIBLE browser so a human can pass the verification,
 * captures the resulting Qanty session, then queries appointment availability
 * for all mapped target branches using the standard polling pipeline.
 *
 * Usage: npm run harvest:manual
 */

const MANUAL_HARVEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of human-in-the-loop patience

async function main(): Promise<void> {
  console.log("===========================================================");
  console.log("🖐️  MANUAL SESSION HARVEST & AVAILABILITY CHECK");
  console.log("===========================================================");
  console.log("A visible browser window will open. If the portal shows a");
  console.log("verification, complete it manually. The session is captured");
  console.log("automatically once the portal handshake succeeds.\n");

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });

  let capturedSessionId: string | undefined;
  let rejectionCode: string | undefined;
  let cookieString = "";

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    page.on("response", async (res) => {
      if (!res.url().includes("regular_start")) return;
      try {
        const data = await res.json();
        if (data && data.id) {
          capturedSessionId = String(data.id);
        } else if (data && data.code) {
          rejectionCode = String(data.code);
        }
      } catch {
        // Ignore unparseable responses
      }
    });

    await page.goto(env.QANTY_PORTAL_URL, {
      waitUntil: "domcontentloaded",
      timeout: env.BROWSER_TIMEOUT_MS,
    });

    const deadline = Date.now() + MANUAL_HARVEST_TIMEOUT_MS;
    let lastHintMinute = -1;
    while (!capturedSessionId && Date.now() < deadline) {
      await page.waitForTimeout(1000);
      const elapsedMin = Math.floor((MANUAL_HARVEST_TIMEOUT_MS - (deadline - Date.now())) / 60000);
      if (elapsedMin > lastHintMinute && !capturedSessionId) {
        lastHintMinute = elapsedMin;
        if (rejectionCode) {
          console.log(
            `[ManualHarvest] Waiting for human verification... (last rejection: '${rejectionCode}')`,
          );
        }
      }
    }

    if (!capturedSessionId) {
      console.error(
        "[ManualHarvest] Timed out without a valid session. No availability check performed.",
      );
      process.exitCode = 1;
      return;
    }

    const rawCookies = await context.cookies();
    cookieString = rawCookies.map((c) => `${c.name}=${c.value}`).join("; ");
    console.log(
      "[ManualHarvest] ✅ Session captured successfully. Browser will close; querying schedules...",
    );
  } finally {
    await browser.close().catch(() => {});
  }

  // Inject the manually harvested session into a QantyClient via a stub harvester
  const stubHarvester = new SessionHarvester();
  (stubHarvester as any).getSessionId = async () => capturedSessionId;
  (stubHarvester as any).getHeaders = async () => ({
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    Referer: env.QANTY_PORTAL_URL,
    Origin: "https://qanty.com",
    Cookie: cookieString,
  });

  const client = new QantyClient(undefined, stubHarvester);
  const rules = new RulesEngine();

  console.log("\n===========================================================");
  for (const branchId of env.TARGET_BRANCH_IDS) {
    const mapping = BRANCH_FIRESTORE_MAP[branchId];
    console.log(`\n🏢 Branch ${branchId}${mapping ? ` — ${mapping.name}` : ""}`);
    const slots = await client.fetchDaySchedule({ branchId });

    if (slots.length === 0) {
      console.log("   No schedule data returned (0 items).");
      continue;
    }

    const freeCount = slots.filter(
      (s: any) => String(s.status || "").toUpperCase() === "FREE",
    ).length;
    console.log(`   Slots received: ${slots.length} (FREE: ${freeCount})`);

    const evaluation = rules.evaluate(slots, { branchId });
    if (evaluation.hasAvailability && evaluation.matchingSlots.length > 0) {
      console.log(
        `   ✅ AVAILABLE per business rules: ${evaluation.matchingSlots.length} valid slot(s)`,
      );
      for (const slot of evaluation.matchingSlots.slice(0, 10)) {
        console.log(`      → ${slot.date} ${slot.time} (${slot.branch})`);
      }
    } else {
      console.log(`   ❌ No availability per business rules: ${evaluation.reasons.join("; ")}`);
    }
  }
  console.log("\n===========================================================");
  console.log("Done.");
}

main().catch((err) => {
  console.error("[ManualHarvest Error]:", err.message);
  process.exit(1);
});
