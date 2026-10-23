import { chromium, Browser, Page } from "playwright";
import { env } from "../config/env.js";

/**
 * Horizon Watcher — overnight slot publication monitor
 *
 * Qanty returns HTTP 400 for days beyond the published booking horizon.
 * When the frontier day starts returning 200 with slots, that is the exact
 * publication event. This tool watches the frontier every ~10 minutes and
 * sends a Telegram alert when:
 *   - a new day is published (horizon extension), or
 *   - FREE slots appear on any monitored day (e.g. branch 118).
 *
 * The browser stays open so the harvested session remains
 * alive; queries run inside the page context (same-origin, cookies attached).
 * Unattended mode: when no session can be harvested (e.g. reCAPTCHA 'BOT'
 * rejection on a datacenter IP), the harvest is retried every 10 minutes.
 *
 * Usage: npm run watch:horizon
 */

interface WatchConfig {
  label: string;
  branchId: string;
  lineId: string;
  /** Day offsets (from today) to scan each cycle */
  offsets: number[];
  /** Alert immediately when FREE slots are found */
  alertOnFree: boolean;
}

const WATCH_CONFIGS: WatchConfig[] = [
  {
    label: "118 (Promedan)",
    branchId: "P44gWuLwrWvKAMd7YrHF",
    lineId: "G26hsHGJQWHLWsSUghdK",
    offsets: [0, 1, 2, 3, 4],
    alertOnFree: true,
  },
  {
    label: "6035",
    branchId: "ZOLH5f1ydz6XQxFvpL0e",
    lineId: "49P4qDGm7i87QLeyjG25",
    offsets: [0, 1, 2, 3, 4],
    alertOnFree: false,
  },
];

const _CYCLE_BASE_MS = 10 * 60 * 1000; // 10 minutes (P-NET-01 compliant)
const _JITTER_MS = 2 * 60 * 1000; // ±2 min jitter (P-NET-02 spirit)
const CIRCUIT_BREAKER_MS = 10 * 60 * 1000; // 10-min pause on 429/403 (P-NET-03)
const HARVEST_RETRY_MS = 10 * 60 * 1000; // wait between harvest retries in unattended mode
// Fast cadence: cancellation sniping on already published days
const FAST_CYCLE_MS = 45 * 1000; // 45s baseline (P-NET-01 compliant, >= 30s)
const FAST_JITTER_MS = 15 * 1000; // ±15s jitter (P-NET-02)
// A slow (horizon) scan runs every N fast cycles: 13 × ~50s ≈ 11 min
const SLOW_EVERY_N_CYCLES = 13;

function dayOffsetToDate(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

async function sendTelegramAlert(text: string): Promise<void> {
  if (env.TELEGRAM_BOT_TOKEN === "mock_token" || env.TELEGRAM_CHAT_ID === "mock_chat_id") {
    console.log("[Watch:Telegram] Mock credentials detected; alert only logged here.");
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: "Markdown" }),
    });
    if (!res.ok) console.warn(`[Watch:Telegram] Failed to send alert: HTTP ${res.status}`);
  } catch (err: any) {
    console.warn(`[Watch:Telegram] Error sending alert: ${err.message}`);
  }
}

interface DayScanResult {
  offset: number;
  day: string;
  httpStatus: number;
  total: number;
  free: number;
  freeTimes: string[];
}

/**
 * Queries list_day_schedule from INSIDE the open page context so the SPA
 * session (cookies + session id) stays valid without re-harvesting.
 */
async function scanDay(
  page: Page,
  session: string,
  cfg: WatchConfig,
  offset: number,
): Promise<DayScanResult> {
  const day = dayOffsetToDate(offset);
  const result: DayScanResult = { offset, day, httpStatus: 0, total: 0, free: 0, freeTimes: [] };

  const res: any = await page.evaluate(
    async (args: any) => {
      const company = (window as any).__SMS_COMPANY__;
      const r = await fetch("/p/appointments/list_day_schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/plain, */*",
        },
        body: JSON.stringify({
          company_id: company,
          branch_id: args.branchId,
          line_id: args.lineId,
          service_id: "1",
          start_date: args.day,
          end_date: args.day,
          day: args.day,
          session: args.session,
          origin: "appointments",
        }),
      });
      return { status: r.status, body: await r.text() };
    },
    { day, session, branchId: cfg.branchId, lineId: cfg.lineId },
  );

  result.httpStatus = res.status;
  try {
    const data = JSON.parse(res.body);
    const slots: any[] = [];
    if (data && data.appointments && typeof data.appointments === "object") {
      for (const dict of Object.values(data.appointments)) {
        if (dict && typeof dict === "object") slots.push(...Object.values(dict as any));
      }
    } else if (Array.isArray(data?.items)) slots.push(...data.items);
    else if (Array.isArray(data?.data)) slots.push(...data.data);
    result.total = slots.length;
    for (const s of slots) {
      if (String(s.status || "").toUpperCase() === "FREE") {
        result.free++;
        result.freeTimes.push(String(s.name || `${s.date || day} ${s.time || ""}`));
      }
    }
  } catch {
    /* non-JSON body (e.g. 400 page) */
  }

  return result;
}

async function waitForSession(page: Page): Promise<{ session: string; company: string } | null> {
  let sessionId: string | undefined;
  let rejectionCode: string | undefined;

  page.on("response", async (res) => {
    if (!res.url().includes("regular_start")) return;
    try {
      const data = await res.json();
      if (data && data.id) sessionId = String(data.id);
      else if (data && data.code) rejectionCode = String(data.code);
    } catch {
      /* ignore */
    }
  });

  await page.goto(env.QANTY_PORTAL_URL, {
    waitUntil: "domcontentloaded",
    timeout: env.BROWSER_TIMEOUT_MS,
  });

  const deadline = Date.now() + 5 * 60 * 1000;
  while (!sessionId && Date.now() < deadline) await page.waitForTimeout(1000);
  if (!sessionId) {
    console.error(`[Watch] Session harvest failed (last code: ${rejectionCode || "none"}).`);
    return null;
  }
  return { session: sessionId, company: env.QANTY_COMPANY_CODE };
}

async function main(): Promise<void> {
  console.log("===========================================================");
  console.log("🌙 HORIZON WATCHER — overnight slot publication monitor");
  console.log("===========================================================");
  if (!env.PLAYWRIGHT_HEADLESS) {
    console.log("A visible browser will open. Complete verification if asked.");
  }
  console.log("Unattended mode: harvest is retried automatically until it succeeds.\n");

  // Unattended startup: keep retrying the harvest (browser relaunch included)
  // until reCAPTCHA lets us through. On a VPS there is no human to pass it.
  let browser: Browser | null = null;
  let page: Page | null = null;
  let session: string | undefined;

  while (!session) {
    const attemptBrowser = await chromium.launch({
      headless: env.PLAYWRIGHT_HEADLESS,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    });
    try {
      const context = await attemptBrowser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      });
      page = await context.newPage();
      const harvested = await waitForSession(page);
      if (harvested) {
        browser = attemptBrowser;
        session = harvested.session;
        await page.evaluate((company) => {
          (window as any).__SMS_COMPANY__ = company;
        }, harvested.company);
      }
    } catch (err: any) {
      console.error(`[Watch] Harvest attempt error: ${err.message}`);
    } finally {
      if (!browser) await attemptBrowser.close().catch(() => {});
    }
    if (!session) {
      console.log(
        `[Watch] Harvest rejected. Retrying in 10 min... (${new Date().toLocaleTimeString()})`,
      );
      await new Promise((r) => setTimeout(r, HARVEST_RETRY_MS));
    }
  }

  if (!page || !browser) return; // unreachable, satisfies types
  console.log(
    `[Watch] ✅ Session captured. Fast FREE-check every ~45s on published days; horizon scan every ~10 min. (start ${new Date().toLocaleTimeString()})\n`,
  );

  // Publication state: frontier day previously returned 400
  const publishedDays = new Map<string, Set<number>>(); // branch label -> published offsets
  let circuitBreakerUntil = 0;
  let baselineDone = false; // first slow cycle records current state silently

  for (const cfg of WATCH_CONFIGS) publishedDays.set(cfg.label, new Set());

  // Infinite watch loop (run overnight; Ctrl+C to stop).
  // Fast cadence (~45s, P-NET-01 compliant): cancellation sniping on already
  // published days (a freed slot can vanish in minutes).
  // Slow cadence (~10 min): horizon extension detection (new day publication).
  for (let cycle = 0; ; cycle++) {
    const isSlowCycle = cycle % SLOW_EVERY_N_CYCLES === 0;
    const jitter = Math.floor((Math.random() * 2 - 1) * FAST_JITTER_MS);
    const now = Date.now();
    if (now < circuitBreakerUntil) {
      await page.waitForTimeout(circuitBreakerUntil - now);
    }

    try {
      for (const cfg of WATCH_CONFIGS) {
        const known = publishedDays.get(cfg.label)!;
        const fastOffsets = cfg.offsets.filter((o) => known.has(o));
        const slowOffsets = isSlowCycle ? cfg.offsets.filter((o) => !known.has(o)) : [];

        for (const offset of [...fastOffsets, ...slowOffsets]) {
          const scan = await scanDay(page, session, cfg, offset);
          const dayLabel = scan.day;
          const wasPublished = known.has(offset);

          if (scan.httpStatus === 429 || scan.httpStatus === 403) {
            console.warn(
              `[Watch] HTTP ${scan.httpStatus} — circuit breaker for 10 min (P-NET-03).`,
            );
            circuitBreakerUntil = Date.now() + CIRCUIT_BREAKER_MS;
            break;
          }

          if (!wasPublished && !baselineDone && scan.httpStatus === 200 && scan.total > 0) {
            // Record initial state without alerting
            console.log(
              `[Watch] Baseline ${cfg.label} ${dayLabel}: total=${scan.total} free=${scan.free}`,
            );
            known.add(offset);
          } else if (!wasPublished && scan.httpStatus === 200 && scan.total > 0) {
            const msg =
              `🌙 *Día publicado en ${cfg.label}*\n📅 ${dayLabel} (+${offset})\n📄 Turnos: ${scan.total} | 🆓 Libres: ${scan.free}` +
              (scan.free > 0 ? `\nHorarios libres: ${scan.freeTimes.slice(0, 15).join(", ")}` : "");
            console.log(
              `[Watch] 🚨 PUBLICATION EVENT ${cfg.label} ${dayLabel}: total=${scan.total} free=${scan.free} at ${new Date().toLocaleTimeString()}`,
            );
            await sendTelegramAlert(msg);
            known.add(offset);
          } else if (cfg.alertOnFree && scan.free > 0) {
            const msg = `🚨 *Turnos LIBRES en ${cfg.label}*\n📅 ${dayLabel}\n🆓 ${scan.free} disponibles:\n${scan.freeTimes.slice(0, 15).join("\n")}`;
            console.log(
              `[Watch] 🚨 FREE SLOTS ${cfg.label} ${dayLabel}: ${scan.free} at ${new Date().toLocaleTimeString()}`,
            );
            await sendTelegramAlert(msg);
          }

          await page.waitForTimeout(800); // polite pacing between day queries
        }
      }
    } catch (err: any) {
      console.error(
        `[Watch] Cycle error: ${err.message}. Attempting page reload to refresh session...`,
      );
      try {
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(15000);
        const refreshed = await waitForSession(page);
        if (refreshed) {
          session = refreshed.session;
          await page.evaluate((company) => {
            (window as any).__SMS_COMPANY__ = company;
          }, session);
          console.log("[Watch] ✅ Session refreshed after reload.");
        }
      } catch (reloadErr: any) {
        console.error(`[Watch] Reload failed: ${reloadErr.message}`);
      }
    }

    const waitMs = FAST_CYCLE_MS + jitter;
    if (isSlowCycle) baselineDone = true;
    console.log(
      `[Watch] Cycle ${cycle + 1} (${isSlowCycle ? "fast+horizon" : "fast"}) done at ${new Date().toLocaleTimeString()}. Next in ${Math.round(waitMs / 1000)}s.`,
    );
    await page.waitForTimeout(waitMs);
  }
}

main().catch((err) => {
  console.error("[Watch Error]:", err.message);
  process.exit(1);
});
