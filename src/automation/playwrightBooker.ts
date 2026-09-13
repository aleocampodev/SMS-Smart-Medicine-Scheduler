import { chromium, Browser, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env.js';
import { BookingResult, Profile, QantySlot } from '../types/index.js';

export class PlaywrightBooker {
  private screenshotsDir: string;
  private tracesDir: string;
  // Guardrail G-ACT-02: Concurrency mutex to prevent parallel overlapping browser sessions
  private isBookingInProgress: boolean = false;

  constructor() {
    this.screenshotsDir = path.resolve(process.cwd(), 'screenshots');
    this.tracesDir = path.resolve(process.cwd(), 'traces');
    
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
      console.warn(`[PlaywrightBooker:Lock] Booking rejected: another booking process is currently in progress.`);
      return {
        success: false,
        profileId: profile.id,
        slotDate: slot.date,
        slotTime: slot.time,
        message: 'Project Guardrail P-ACT-02: Another booking process is currently running. Please wait a few moments.',
      };

    }

    this.isBookingInProgress = true;
    console.log(`[PlaywrightBooker] 🚀 Starting appointment booking for ${profile.displayName} on ${slot.date} ${slot.time || ''}`);
    
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
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      });

      context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      });

      // Addy Osmani Pattern 1: Playwright Tracing for forensic snapshots upon failure
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

      // Addy Osmani Pattern 2: Resource routing to abort heavy trackers and speed up navigation
      await context.route('**/*', (route: any) => {
        const req = route.request();
        const resourceType = req.resourceType();
        const url = req.url();

        // Block analytics trackers and unnecessary media assets for appointment booking
        if (
          resourceType === 'media' ||
          resourceType === 'font' ||
          url.includes('google-analytics') ||
          url.includes('hotjar') ||
          url.includes('facebook') ||
          url.includes('doubleclick')
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
      await page.goto(bookingUrl, { waitUntil: 'domcontentloaded', timeout: env.BROWSER_TIMEOUT_MS });
      const navDuration = Date.now() - navStart;
      console.log(`[PlaywrightBooker:Perf] ⚡ Initial page load time: ${navDuration}ms`);

      // Guardrail G-ACT-04: CAPTCHA / Cloudflare Challenge detection
      const hasCaptcha = await page.evaluate(() => {
        return Boolean(
          document.querySelector('iframe[src*="recaptcha"]') ||
          document.querySelector('iframe[src*="turnstile"]') ||
          document.querySelector('.cf-turnstile') ||
          document.querySelector('#challenge-running') ||
          document.body.innerText.includes('Verifica que eres humano') ||
          document.body.innerText.includes('Verify you are human')
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
          message: 'Project Guardrail P-ACT-04: CAPTCHA or Cloudflare Challenge detected. Manual resolution required.',
          screenshotPath,
        };

      }

      // Fill typical appointment booking form fields with adaptive selectors
      await this.fillFormField(page, ['input[name*="doc"]', 'input[id*="doc"]', '#documentNumber'], profile.documentNumber);
      await this.fillFormField(page, ['input[name*="name"]', 'input[id*="name"]', '#firstName'], profile.firstName);
      await this.fillFormField(page, ['input[name*="last"]', 'input[id*="last"]', '#lastName'], profile.lastName);
      await this.fillFormField(page, ['input[type="tel"]', 'input[name*="phone"]', '#phone'], profile.phone);
      await this.fillFormField(page, ['input[type="email"]', 'input[name*="email"]', '#email'], profile.email);

      // Settle and capture full screenshot receipt
      await page.waitForTimeout(1000);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Addy Osmani Pattern 3: Discard trace upon success to save disk space
      if (context) {
        await context.tracing.stop();
      }

      const totalDuration = Date.now() - startTime;
      console.log(`[PlaywrightBooker:Perf] 🏁 Booking processed successfully in ${totalDuration}ms. Screenshot: ${screenshotPath}`);

      return {
        success: true,
        profileId: profile.id,
        slotDate: slot.date,
        slotTime: slot.time,
        message: `Form successfully completed for ${profile.displayName} in ${totalDuration}ms.`,
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

  /**
   * Helper to attempt multiple candidate selectors safely
   */
  private async fillFormField(page: Page, selectors: string[], value: string): Promise<boolean> {
    for (const selector of selectors) {
      try {
        const el = await page.$(selector);
        if (el && await el.isVisible()) {
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
