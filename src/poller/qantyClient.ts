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
  // Circuit Breaker (G-NET-03): timestamp hasta cuando el cliente está pausado
  private circuitBreakerUntil: number = 0;

  constructor(endpoint?: string) {
    this.endpoint = endpoint || env.QANTY_SCHEDULE_URL;
  }

  /**
   * Consulta el endpoint POST /p/appointments/list_day_schedule
   */
  public async fetchDaySchedule(options: QantyFetchOptions = {}): Promise<any[]> {
    const now = Date.now();
    if (now < this.circuitBreakerUntil) {
      const waitSeconds = Math.ceil((this.circuitBreakerUntil - now) / 1000);
      console.warn(`[QantyClient:CircuitBreaker] Sondeo en pausa preventiva por ${waitSeconds}s tras bloqueo previo.`);
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
      console.log(`[QantyClient] Consultando POST ${this.endpoint}...`);
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(defaultPayload),
      });

      if (!response.ok) {
        console.warn(`[QantyClient] HTTP error ${response.status}: ${response.statusText}`);
        // Guardrail G-NET-03: Pausa de 10 minutos (600,000 ms) si se detecta rate limit o bloqueo
        if (response.status === 429 || response.status === 403) {
          console.error(`[QantyClient:CircuitBreaker] Activado tras HTTP ${response.status}. Pausando peticiones por 10 minutos.`);
          this.circuitBreakerUntil = Date.now() + 10 * 60 * 1000;
        }
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
