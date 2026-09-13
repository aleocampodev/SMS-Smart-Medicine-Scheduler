import { env } from '../config/env.js';
import { SessionHarvester } from './sessionHarvester.js';

export interface QantyFetchOptions {
  branchId?: string | number;
  serviceId?: string | number;
  startDate?: string;
  endDate?: string;
  customPayload?: Record<string, any>;
}

export const BRANCH_FIRESTORE_MAP: Record<string, { branchId: string; lineId: string; name: string }> = {
  '118': {
    branchId: 'P44gWuLwrWvKAMd7YrHF',
    lineId: 'G26hsHGJQWHLWsSUghdK',
    name: 'MEDELLÍN - ANTIOQUIA - NUEVA EPS - PROMEDAN CR 49 #44 99 LOCAL 118',
  },
  '6035': {
    branchId: 'ZOLH5f1ydz6XQxFvpL0e',
    lineId: 'G26hsHGJQWHLWsSUghdK',
    name: 'MEDELLIN – ANTIOQUIA – NUEVA EPS CR 46 #47 66 LOCAL 6035',
  },
};

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

    const requestedBranch = String(options.branchId || env.TARGET_BRANCH_ID || '6035');
    const branchMapping = BRANCH_FIRESTORE_MAP[requestedBranch];
    const isRealQanty = this.endpoint.includes('qanty.com');

    // When querying real Qanty host, translate local branch number (118/6035) to Firestore doc ID
    const targetBranchId = isRealQanty && branchMapping ? branchMapping.branchId : requestedBranch;
    const targetLineId = options.serviceId || branchMapping?.lineId || 'G26hsHGJQWHLWsSUghdK';

    const sessionId = await this.sessionHarvester.getSessionId();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDay = tomorrow.toISOString().split('T')[0];
    const targetDay = options.startDate || env.TARGET_START_DATE || defaultDay;

    const defaultPayload: Record<string, any> = {
      company_id: env.QANTY_COMPANY_CODE,
      branch_id: targetBranchId,
      line_id: targetLineId,
      service_id: options.serviceId || '1',
      start_date: targetDay,
      end_date: options.endDate || env.TARGET_END_DATE,
      day: targetDay,
      session: sessionId,
      origin: 'appointments',
      ...options.customPayload,
    };

    // Ensure backwards-compatibility for mock endpoints expecting literal branch_id
    if (!isRealQanty) {
      defaultPayload.branch_id = options.branchId || env.TARGET_BRANCH_ID || '6035';
    }

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

      // 1. Flatten Qanty nested appointments object: { appointments: { [time]: { "0": {...}, "1": {...} } } }
      if (data && data.appointments && typeof data.appointments === 'object') {
        const slots: any[] = [];
        for (const [timeKey, slotDict] of Object.entries(data.appointments)) {
          if (slotDict && typeof slotDict === 'object') {
            for (const [idxKey, slot] of Object.entries(slotDict as Record<string, any>)) {
              slots.push({
                ...slot,
                timeKey,
                slotIndex: idxKey,
                date: slot.name ? slot.name.split(' ')[0] : timeKey.split('T')[0],
                time: slot.name ? slot.name.split(' ')[1] : timeKey.split('T')[1]?.slice(0, 5),
                branch: branchMapping?.name || `Medellin Branch ${requestedBranch}`,
                branch_id: requestedBranch,
              });
            }
          }
        }
        return slots;
      }

      // Extract array based on standard Qanty envelope packaging
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

      console.warn(`[QantyClient] Response format is not a direct array or appointments dictionary:`, typeof data);
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
      const sessionId = await this.sessionHarvester.getSessionId();
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          companyId: env.QANTY_COMPANY_CODE,
          withAppoinmentsEnabled: true,
          session: sessionId,
          origin: 'appointments',
          c: env.QANTY_COMPANY_CODE,
        }),
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

