import { env } from '../config/env.js';

export interface QantyFetchOptions {
  branchId?: string | number;
  serviceId?: string | number;
  startDate?: string;
  endDate?: string;
  customPayload?: Record<string, any>;
}

export class QantyClient {
  private endpoint: string;
  // Circuit Breaker (G-NET-03): timestamp until which client is paused
  private circuitBreakerUntil: number = 0;

  constructor(endpoint?: string) {
    this.endpoint = endpoint || env.QANTY_SCHEDULE_URL;
  }

  /**
   * Queries the POST /p/appointments/list_day_schedule endpoint
   */
  public async fetchDaySchedule(options: QantyFetchOptions = {}): Promise<any[]> {
    const now = Date.now();
    if (now < this.circuitBreakerUntil) {
      const waitSeconds = Math.ceil((this.circuitBreakerUntil - now) / 1000);
      console.warn(`[QantyClient:CircuitBreaker] Polling paused defensively for ${waitSeconds}s following prior rate limit.`);
      return [];
    }
    const defaultPayload = {
      branch_id: options.branchId || '1',
      service_id: options.serviceId || '1',
      start_date: options.startDate || env.TARGET_START_DATE,
      end_date: options.endDate || env.TARGET_END_DATE,
      ...options.customPayload,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Referer': 'https://qanty.com/',
      'Origin': 'https://qanty.com',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };

    try {
      console.log(`[QantyClient] Querying POST ${this.endpoint}...`);
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(defaultPayload),
      });

      if (!response.ok) {
        console.warn(`[QantyClient] HTTP error ${response.status}: ${response.statusText}`);
        // Guardrail G-NET-03: 10-minute cooldown (600,000 ms) upon 429 / 403 response
        if (response.status === 429 || response.status === 403) {
          console.error(`[QantyClient:CircuitBreaker] Activated after HTTP ${response.status}. Pausing polling for 10 minutes.`);
          this.circuitBreakerUntil = Date.now() + 10 * 60 * 1000;
        }
        return [];
      }

      const data = (await response.json()) as any;

      // Extract array based on typical Qanty envelope packaging
      if (Array.isArray(data)) {
        return data;
      }
      if (data && Array.isArray(data.items)) {
        return data.items;
      }
      if (data && Array.isArray(data.data)) {
        return data.data;
      }
      if (data && Array.isArray(data.schedules)) {
        return data.schedules;
      }

      console.warn(`[QantyClient] Response format is not a direct array:`, typeof data);
      return [];
    } catch (error: any) {
      console.error(`[QantyClient] Error connecting to Qanty API:`, error.message);
      return [];
    }
  }
}
