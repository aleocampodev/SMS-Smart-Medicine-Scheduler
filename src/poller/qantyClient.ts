import { env } from '../config/env.js';
import { SessionHarvester } from './sessionHarvester.js';

export interface QantyFetchOptions {
  branchId?: string | number;
  serviceId?: string | number;
  startDate?: string;
  endDate?: string;
  customPayload?: Record<string, any>;
}

export class QantyClient {
  private endpoint: string;
  private sessionHarvester: SessionHarvester;
  // Circuit Breaker (P-NET-03): timestamp until which client is paused
  private circuitBreakerUntil: number = 0;

  constructor(endpoint?: string, sessionHarvester?: SessionHarvester) {
    this.endpoint = endpoint || env.QANTY_SCHEDULE_URL;
    this.sessionHarvester = sessionHarvester || SessionHarvester.getInstance();
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
      branch_id: options.branchId || env.TARGET_BRANCH_ID || '6035',
      service_id: options.serviceId || '1',
      start_date: options.startDate || env.TARGET_START_DATE,
      end_date: options.endDate || env.TARGET_END_DATE,
      ...options.customPayload,
    };

    const sessionHeaders = await this.sessionHarvester.getHeaders();
    const headers: Record<string, string> = {
      ...sessionHeaders,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
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
        // Guardrail P-NET-03: 10-minute cooldown (600,000 ms) upon 429 / 403 response
        if (response.status === 429 || response.status === 403) {

          console.error(`[QantyClient:CircuitBreaker] Activated after HTTP ${response.status}. Pausing polling for 10 minutes.`);
          this.circuitBreakerUntil = Date.now() + 10 * 60 * 1000;
        }
        return [];
      }

      const data = (await response.json()) as any;

      if (data && data.code === 'INVALID_SESSION') {
        console.warn(`[QantyClient] Qanty returned INVALID_SESSION. Invalidating session cache for refresh...`);
        this.sessionHarvester.invalidateSession();
        return [];
      }

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

  /**
   * Queries POST /p/get_branches to retrieve all branches for the company
   */
  public async fetchBranches(sessionCookie?: string): Promise<any[]> {
    const url = 'https://qanty.com/p/get_branches';
    const sessionHeaders = await this.sessionHarvester.getHeaders();
    const headers: Record<string, string> = {
      ...sessionHeaders,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'Referer': env.QANTY_PORTAL_URL,
      'Origin': 'https://qanty.com',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };

    if (sessionCookie) {
      headers['Cookie'] = sessionCookie;
    }

    try {
      console.log(`[QantyClient] Querying POST ${url}...`);
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ c: env.QANTY_COMPANY_CODE }),
      });

      if (!response.ok) {
        console.warn(`[QantyClient] Failed to fetch branches: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as any;

      if (data && data.code === 'INVALID_SESSION') {
        console.warn(`[QantyClient] fetchBranches received INVALID_SESSION. Invalidating session cache...`);
        this.sessionHarvester.invalidateSession();
        return [];
      }

      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.branches)) return data.branches;
      if (data && Array.isArray(data.data)) return data.data;
      if (data && Array.isArray(data.items)) return data.items;

      return [];
    } catch (error: any) {
      console.error(`[QantyClient] Error fetching branches:`, error.message);
      return [];
    }
  }

}

