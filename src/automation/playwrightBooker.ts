import { chromium, Browser, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env.js';
import { BookingResult, Profile, QantySlot } from '../types/index.js';

export class PlaywrightBooker {
  private screenshotsDir: string;
  // Guardrail G-ACT-02: Mutex de concurrencia para evitar sesiones paralelas
  private isBookingInProgress: boolean = false;

  constructor() {
    this.screenshotsDir = path.resolve(process.cwd(), 'screenshots');
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }

  /**
   * Ejecuta el flujo de llenado de formulario y reserva para un usuario específico
   */
  public async bookAppointment(slot: QantySlot, profile: Profile): Promise<BookingResult> {
    // Verificar si ya hay una reserva en ejecución
    if (this.isBookingInProgress) {
      console.warn(`[PlaywrightBooker:Lock] Reserva rechazada: ya hay un proceso en ejecución.`);
      return {
        success: false,
        profileId: profile.id,
        slotDate: slot.date,
        slotTime: slot.time,
        message: 'Guardrail G-ACT-02: Ya existe un proceso de reserva en curso. Por favor espere unos segundos.',
      };
    }

    this.isBookingInProgress = true;
    console.log(`[PlaywrightBooker] Iniciando reserva para ${profile.displayName} en fecha ${slot.date} ${slot.time || ''}`);
    
    let browser: Browser | null = null;
    const timestamp = Date.now();
    const screenshotName = `booking_${profile.id}_${slot.date}_${timestamp}.png`;
    const screenshotPath = path.join(this.screenshotsDir, screenshotName);

    try {
      browser = await chromium.launch({
        headless: env.PLAYWRIGHT_HEADLESS,
        timeout: env.BROWSER_TIMEOUT_MS,
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      });

      const page: Page = await context.newPage();

      // En caso de que Qanty tenga una URL específica de reserva
      const bookingUrl = slot.raw?.booking_url || 'https://qanty.com/';
      console.log(`[PlaywrightBooker] Navegando a ${bookingUrl}...`);
      await page.goto(bookingUrl, { waitUntil: 'domcontentloaded', timeout: env.BROWSER_TIMEOUT_MS });

      // Guardrail G-ACT-04: Detección de CAPTCHA o Cloudflare challenge
      const hasCaptcha = await page.evaluate(() => {
        return Boolean(
          document.querySelector('iframe[src*="recaptcha"]') ||
          document.querySelector('iframe[src*="turnstile"]') ||
          document.querySelector('.cf-turnstile') ||
          document.querySelector('#challenge-running') ||
          document.body.innerText.includes('Verifica que eres humano')
        );
      });

      if (hasCaptcha) {
        console.warn(`[PlaywrightBooker:Captcha] Detectado CAPTCHA / Cloudflare Challenge.`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        return {
          success: false,
          profileId: profile.id,
          slotDate: slot.date,
          slotTime: slot.time,
          message: 'Guardrail G-ACT-04: Se detectó verificación CAPTCHA / Cloudflare. Se requiere completar manualmente.',
          screenshotPath,
        };
      }

      // Lógica de llenado de campos típicos de formulario de citas
      // Se usan selectores adaptables o data-testid / labels
      await this.fillFormField(page, ['input[name*="doc"]', 'input[id*="doc"]', '#documentNumber'], profile.documentNumber);
      await this.fillFormField(page, ['input[name*="name"]', 'input[id*="name"]', '#firstName'], profile.firstName);
      await this.fillFormField(page, ['input[name*="last"]', 'input[id*="last"]', '#lastName'], profile.lastName);
      await this.fillFormField(page, ['input[type="tel"]', 'input[name*="phone"]', '#phone'], profile.phone);
      await this.fillFormField(page, ['input[type="email"]', 'input[name*="email"]', '#email'], profile.email);

      // Esperar brevemente y tomar screenshot del estado del formulario
      await page.waitForTimeout(1000);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      console.log(`[PlaywrightBooker] Formulario procesado. Captura guardada en: ${screenshotPath}`);

      return {
        success: true,
        profileId: profile.id,
        slotDate: slot.date,
        slotTime: slot.time,
        message: `Formulario completado exitosamente para ${profile.displayName}.`,
        screenshotPath,
      };
    } catch (error: any) {
      console.error(`[PlaywrightBooker] Error durante la reserva:`, error.message);
      return {
        success: false,
        profileId: profile.id,
        slotDate: slot.date,
        slotTime: slot.time,
        message: `Fallo en el proceso de reserva: ${error.message}`,
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
   * Helper para intentar varios selectores comunes sin lanzar excepción si alguno no existe
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
        // Continuar con el siguiente selector
      }
    }
    return false;
  }
}
