import { chromium, BrowserContext } from 'playwright';
import { env } from '../config/env.js';

export interface QantySession {
  cookieString: string;
  authorizationToken?: string;
  companyId: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * SessionHarvester
 *
 * Background session manager that harvests authorized session cookies and headers
 * from the Qanty portal via stealth Playwright instances to overcome Google reCAPTCHA v3
 * and prevent `INVALID_SESSION` API rejections.
 */
export class SessionHarvester {
  private static instance: SessionHarvester;
  private currentSession: QantySession | null = null;
  private isHarvesting: boolean = false;
  // TTL for harvested session: 90 minutes
  private readonly SESSION_TTL_MS = 90 * 60 * 1000;

  public static getInstance(): SessionHarvester {
    if (!SessionHarvester.instance) {
      SessionHarvester.instance = new SessionHarvester();
    }
    return SessionHarvester.instance;
  }

  /**
   * Returns an active valid session, refreshing automatically if expired or absent
   */
  public async getSession(): Promise<QantySession> {
    const now = Date.now();
    if (this.currentSession && now < this.currentSession.expiresAt) {
      return this.currentSession;
    }

    return this.refreshSession();
  }

  /**
   * Generates HTTP headers including harvested cookies and authorization tokens
   */
  public async getHeaders(): Promise<Record<string, string>> {
    try {
      const session = await this.getSession();
      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Referer': env.QANTY_PORTAL_URL,
        'Origin': 'https://qanty.com',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      };

      if (session.cookieString) {
        headers['Cookie'] = session.cookieString;
      }
      if (session.authorizationToken) {
        headers['Authorization'] = `Bearer ${session.authorizationToken}`;
      }

      return headers;
    } catch (err: any) {
      console.warn('[SessionHarvester] Warning: could not harvest live session headers:', err.message);
      return {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Referer': env.QANTY_PORTAL_URL,
        'Origin': 'https://qanty.com',
      };
    }
  }

  /**
   * Launches stealth browser context to acquire fresh session state
   */
  public async refreshSession(): Promise<QantySession> {
    if (this.isHarvesting) {
      console.log('[SessionHarvester] Session harvest already in progress. Waiting...');
      while (this.isHarvesting) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (this.currentSession) return this.currentSession;
    }

    this.isHarvesting = true;
    console.log('[SessionHarvester] 🔄 Harvesting fresh session from Qanty portal...');

    let activeContext: BrowserContext | null = null;
    let browser: any = null;

    try {
      browser = await chromium.launch({
        headless: env.PLAYWRIGHT_HEADLESS,
        timeout: env.BROWSER_TIMEOUT_MS,
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      });
      activeContext = context;

      const page = await context.newPage();
      let capturedAuthToken: string | undefined;


      // Listen for authenticated network exchanges
      page.on('request', (req: any) => {
        const headers = req.headers();
        if (headers['authorization']) {
          capturedAuthToken = headers['authorization'].replace(/^Bearer\s+/i, '');
        }
      });

      await page.goto(env.QANTY_PORTAL_URL, {
        waitUntil: 'domcontentloaded',
        timeout: env.BROWSER_TIMEOUT_MS,
      });

      // Allow scripts and initial handshake to settle
      await page.waitForTimeout(3000);

      const rawCookies = await context.cookies();
      const cookieString = rawCookies
        .map((c: any) => `${c.name}=${c.value}`)
        .join('; ');


      const now = Date.now();
      this.currentSession = {
        cookieString,
        authorizationToken: capturedAuthToken,
        companyId: env.QANTY_COMPANY_CODE,
        createdAt: now,
        expiresAt: now + this.SESSION_TTL_MS,
      };

      console.log(
        `[SessionHarvester] ✅ Session harvested successfully. (${rawCookies.length} cookies, valid for 90m)`
      );
      return this.currentSession;
    } catch (error: any) {
      console.error('[SessionHarvester] Failed to harvest session:', error.message);
      // Fallback empty session
      const now = Date.now();
      return {
        cookieString: '',
        companyId: env.QANTY_COMPANY_CODE,
        createdAt: now,
        expiresAt: now + 5 * 60 * 1000, // 5 min retry window on error
      };
    } finally {
      if (activeContext) await activeContext.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      this.isHarvesting = false;
    }

  }

  /**
   * Resets active session cache upon receiving an INVALID_SESSION response
   */
  public invalidateSession(): void {
    console.log('[SessionHarvester] ⚠️ Invalidating active session cache.');
    this.currentSession = null;
  }
}
