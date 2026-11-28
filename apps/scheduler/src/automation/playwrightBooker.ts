import { BRANCH_MAP } from "@SMS/poller";
import { chromium, Browser, Page } from "playwright";
import path from "path";
import fs from "fs";
import { env } from "../config/env.js";
import type { BookingPort } from "../ports.js";
import { BookingResult, Profile, QantySlot } from "../types/index.js";

const CONFIRMATION_PATTERN =
  /confirmad|agendad|exitos|comprobante|scheduled|booked|success|reserva\s+creada/i;
const ERROR_PATTERN =
  /no disponible|ocupad|expirad|inv[aá]lid|error al|no se pudo|failed|unavailable/i;
const CONFIRMATION_CODE_PATTERN =
  /(?:c[oó]digo|confirmaci[oó]n|turno|reserva|code)\s*[:#-]?\s*([A-Z0-9-]{4,20})/i;

/**
 * Resolves candidate UI labels for a Qanty branch key (e.g. PISO3 -> full name + short token).
 */
export function resolveBranchLabels(branchKey?: string): string[] {
  if (!branchKey) return [];
  const info = BRANCH_MAP[branchKey];
  if (!info) return [branchKey];

  const labels = [info.name];
  if (branchKey === "PISO3") labels.push("PISO 3");
  if (branchKey === "PISO6") labels.push("PISO 6");
  labels.push(branchKey);
  return labels;
}

/**
 * Evaluates visible page text after form submission to fail closed on silent errors.
 */
export function evaluateSubmissionOutcome(
  bodyText: string,
  submitStillVisible: boolean,
): { confirmed: boolean; reason?: string; confirmationCode?: string } {
  const trimmed = bodyText.trim();
  if (ERROR_PATTERN.test(trimmed)) {
    return { confirmed: false, reason: "Portal displayed an error or unavailable slot message." };
  }

  const codeMatch = trimmed.match(CONFIRMATION_CODE_PATTERN);
  const confirmationCode = codeMatch?.[1];

  if (CONFIRMATION_PATTERN.test(trimmed) || Boolean(confirmationCode)) {
    return { confirmed: true, confirmationCode };
  }

  if (submitStillVisible) {
    return {
      confirmed: false,
      reason: "Submit button remained visible with no confirmation message after submission.",
    };
  }

  return {
    confirmed: false,
    reason: "Portal did not display an explicit booking confirmation after submission.",
  };
}

export class PlaywrightBooker implements BookingPort {
  private screenshotsDir: string;
  private tracesDir: string;
  // Guardrail G-ACT-02: Concurrency mutex to prevent parallel overlapping browser sessions
  private isBookingInProgress: boolean = false;

  constructor() {
    this.screenshotsDir = path.resolve(process.cwd(), "screenshots");
    this.tracesDir = path.resolve(process.cwd(), "traces");

    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
    if (!fs.existsSync(this.tracesDir)) {
      fs.mkdirSync(this.tracesDir, { recursive: true });
    }
  }

  /**
   * Executes form filling and appointment booking for a specific user profile
   * applying Addy Osmani web performance and reliability patterns (resource routing + tracing)
   */
  public async bookAppointment(slot: QantySlot, profile: Profile): Promise<BookingResult> {
    const startTime = Date.now();

    // Verify if a booking session is already active
    if (this.isBookingInProgress) {
      console.warn(
        `[PlaywrightBooker:Lock] Booking rejected: another booking process is currently in progress.`,
      );
      return {
        success: false,
        profileId: profile.id,
        slotDate: slot.date,
        slotTime: slot.time,
        message:
          "Project Guardrail P-ACT-02: Another booking process is currently running. Please wait a few moments.",
      };
    }

    this.isBookingInProgress = true;
    console.log(
      `[PlaywrightBooker] 🚀 Starting appointment booking for ${profile.displayName} on ${slot.date} ${slot.time || ""}`,
    );

    let browser: Browser | null = null;
    let context: any = null;
    const timestamp = Date.now();
    const screenshotName = `booking_${profile.id}_${slot.date}_${timestamp}.png`;
    const screenshotPath = path.join(this.screenshotsDir, screenshotName);
    const tracePath = path.join(this.tracesDir, `trace_${profile.id}_${timestamp}.zip`);

    try {
      browser = await chromium.launch({
        headless: env.PLAYWRIGHT_HEADLESS,
        timeout: env.BROWSER_TIMEOUT_MS,
        args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
      });

      context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      });

      // Addy Osmani Pattern 1: Playwright Tracing for forensic snapshots upon failure
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

      // Addy Osmani Pattern 2: Resource routing to abort heavy trackers and speed up navigation
      await context.route("**/*", (route: any) => {
        const req = route.request();
        const resourceType = req.resourceType();
        const url = req.url();

        // Block analytics trackers and unnecessary media assets for appointment booking
        if (
          resourceType === "media" ||
          resourceType === "font" ||
          url.includes("google-analytics") ||
          url.includes("hotjar") ||
          url.includes("facebook") ||
          url.includes("doubleclick")
        ) {
          return route.abort();
        }
        return route.continue();
      });

      const page: Page = await context.newPage();

      // Target medicine dispensing portal URL
      const bookingUrl = slot.raw?.booking_url || env.QANTY_PORTAL_URL;
      console.log(`[PlaywrightBooker] Navigating to ${bookingUrl}...`);
      const navStart = Date.now();
      await page.goto(bookingUrl, {
        waitUntil: "domcontentloaded",
        timeout: env.BROWSER_TIMEOUT_MS,
      });
      const navDuration = Date.now() - navStart;
      console.log(`[PlaywrightBooker:Perf] ⚡ Initial page load time: ${navDuration}ms`);

      // Guardrail G-ACT-04: CAPTCHA / Cloudflare Challenge detection
      const hasCaptcha = await page.evaluate(() => {
        return Boolean(
          document.querySelector('iframe[src*="recaptcha"]') ||
          document.querySelector('iframe[src*="turnstile"]') ||
          document.querySelector(".cf-turnstile") ||
          document.querySelector("#challenge-running") ||
          document.body.innerText.includes("Verifica que eres humano") ||
          document.body.innerText.includes("Verify you are human"),
        );
      });

      if (hasCaptcha) {
        console.warn(`[PlaywrightBooker:Captcha] Detected CAPTCHA or Cloudflare Challenge.`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        return {
          success: false,
          profileId: profile.id,
          slotDate: slot.date,
          slotTime: slot.time,
          message:
            "Project Guardrail P-ACT-04: CAPTCHA or Cloudflare Challenge detected. Manual resolution required.",
          screenshotPath,
        };
      }

      // Select branch, date, and time slot when rendered in the Qanty portal
      for (const branchLabel of resolveBranchLabels(slot.branch)) {
        if (await this.clickMatchingText(page, branchLabel)) {
          break;
        }
      }
      if (slot.date) {
        await this.clickMatchingText(page, slot.date);
      }
      if (slot.time) {
        await this.clickMatchingText(page, slot.time.slice(0, 5));
      }

      // Optional document type selector when rendered
      await this.selectFirstVisible(
        page,
        ['select[name*="docType"]', 'select[name*="type"]', "#documentType"],
        profile.documentType,
      );

      // Fill required appointment booking form fields with fail-closed tracking
      const filledDocument = await this.fillFormField(
        page,
        ['input[name*="doc"]', 'input[id*="doc"]', "#documentNumber"],
        profile.documentNumber,
      );
      const filledFirstName = await this.fillFormField(
        page,
        ['input[name*="first"]', 'input[name*="name"]', 'input[id*="name"]', "#firstName"],
        profile.firstName,
      );
      const filledLastName = await this.fillFormField(
        page,
        ['input[name*="last"]', 'input[id*="last"]', "#lastName"],
        profile.lastName,
      );
      if (profile.birthDate) {
        await this.fillFormField(
          page,
          ['input[name*="birth"]', 'input[type="date"]', "#birthDate"],
          profile.birthDate,
        );
      }
      if (profile.phone) {
        await this.fillFormField(
          page,
          ['input[type="tel"]', 'input[name*="phone"]', "#phone"],
          profile.phone,
        );
      }
      const filledEmail = await this.fillFormField(
        page,
        ['input[type="email"]', 'input[name*="email"]', "#email"],
        profile.email,
      );
      if (profile.healthEntity) {
        await this.fillFormField(
          page,
          ['input[name*="eps"]', 'input[name*="entity"]', "#healthEntity"],
          profile.healthEntity,
        );
      }
      if (profile.prescriptionCode) {
        await this.fillFormField(
          page,
          ['input[name*="prescription"]', 'input[name*="formula"]', "#prescriptionCode"],
          profile.prescriptionCode,
        );
      }

      const missingRequired: string[] = [];
      if (!filledDocument) missingRequired.push("documentNumber");
      if (!filledFirstName) missingRequired.push("firstName");
      if (!filledLastName) missingRequired.push("lastName");
      if (!filledEmail) missingRequired.push("email");

      if (missingRequired.length > 0) {
        throw new Error(
          `Booking form selectors missing required field(s): ${missingRequired.join(", ")}`,
        );
      }

      // Submit the appointment form and require a visible submit control
      const submitSelectors = [
        'button[type="submit"]',
        'button:has-text("Agendar")',
        'button:has-text("Confirmar")',
      ];
      const submitted = await this.clickFirstVisible(page, submitSelectors);
      if (!submitted) {
        throw new Error("Booking submit button was not found or not visible.");
      }

      // Settle and verify explicit confirmation before reporting success
      await page.waitForTimeout(1000);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      const bodyText = await page.evaluate(() => document.body.innerText || "");
      const submitStillVisible = await this.isAnyVisible(page, submitSelectors);
      const outcome = evaluateSubmissionOutcome(bodyText, submitStillVisible);

      if (!outcome.confirmed) {
        throw new Error(outcome.reason || "Booking confirmation was not verified.");
      }

      // Addy Osmani Pattern 3: Discard trace upon confirmed success to save disk space
      if (context) {
        await context.tracing.stop();
      }

      const totalDuration = Date.now() - startTime;
      console.log(
        `[PlaywrightBooker:Perf] 🏁 Booking confirmed in ${totalDuration}ms. Screenshot: ${screenshotPath}`,
      );

      return {
        success: true,
        profileId: profile.id,
        slotDate: slot.date,
        slotTime: slot.time,
        confirmationCode: outcome.confirmationCode,
        message: `Appointment confirmed for ${profile.displayName} in ${totalDuration}ms.`,
        screenshotPath,
      };
    } catch (error: any) {
      console.error(`[PlaywrightBooker] Error during booking process:`, error.message);

      // Save trace archive on failure for forensic diagnosis
      if (context) {
        try {
          await context.tracing.stop({ path: tracePath });
          console.log(`[PlaywrightBooker:Forensics] 🔍 Diagnostic trace saved at: ${tracePath}`);
        } catch {
          // Ignore trace save error
        }
      }

      return {
        success: false,
        profileId: profile.id,
        slotDate: slot.date,
        slotTime: slot.time,
        message: `Booking failed: ${error.message}`,
        screenshotPath: fs.existsSync(screenshotPath) ? screenshotPath : undefined,
      };
    } finally {
      this.isBookingInProgress = false;
      if (browser) {
        await browser.close();
      }
    }
  }

  private async clickMatchingText(page: Page, text: string): Promise<boolean> {
    try {
      const locator = page.getByText(text, { exact: false }).first();
      if (await locator.isVisible()) {
        await locator.click();
        return true;
      }
    } catch {
      // Optional portal step
    }
    return false;
  }

  private async clickFirstVisible(page: Page, selectors: string[]): Promise<boolean> {
    for (const selector of selectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible()) {
          await el.click();
          return true;
        }
      } catch {
        // Try next selector
      }
    }
    return false;
  }

  private async isAnyVisible(page: Page, selectors: string[]): Promise<boolean> {
    for (const selector of selectors) {
      try {
        if (await page.locator(selector).first().isVisible()) {
          return true;
        }
      } catch {
        // Ignore non-matching selector
      }
    }
    return false;
  }

  private async selectFirstVisible(
    page: Page,
    selectors: string[],
    value: string,
  ): Promise<boolean> {
    for (const selector of selectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible()) {
          await el.selectOption(value);
          return true;
        }
      } catch {
        // Try next selector
      }
    }
    return false;
  }

  /**
   * Helper to attempt multiple candidate selectors safely
   */
  private async fillFormField(page: Page, selectors: string[], value: string): Promise<boolean> {
    for (const selector of selectors) {
      try {
        const el = await page.$(selector);
        if (el && (await el.isVisible())) {
          await el.fill(value);
          return true;
        }
      } catch {
        // Try next selector
      }
    }
    return false;
  }
}
