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

  constructor(endpoint?: string) {
    this.endpoint = endpoint || env.QANTY_SCHEDULE_URL;
  }

  /**
   * Consulta el endpoint POST /p/appointments/list_day_schedule
   */
  public async fetchDaySchedule(options: QantyFetchOptions = {}): Promise<any[]> {
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
      console.log(`[QantyClient] Consultando POST ${this.endpoint}...`);
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(defaultPayload),
      });

      if (!response.ok) {
        console.warn(`[QantyClient] HTTP error ${response.status}: ${response.statusText}`);
        return [];
      }

      const data = (await response.json()) as any;

      // Dependiendo de cómo empaquete Qanty la lista de horarios (data, items, schedules, etc.)
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

      console.warn(`[QantyClient] Formato de respuesta no es un array directo:`, typeof data);
      return [];
    } catch (error: any) {
      console.error(`[QantyClient] Error al conectar con Qanty API:`, error.message);
      return [];
    }
  }
}
