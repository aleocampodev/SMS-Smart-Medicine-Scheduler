export type SchedulerPhase = 'PEAK' | 'DAYTIME' | 'EVENING' | 'NIGHT';

export interface AdaptiveIntervalResult {
  intervalMs: number;
  intervalSeconds: number;
  phase: SchedulerPhase;
  description: string;
}

export class AdaptiveScheduler {
  /**
   * Obtiene la hora y minuto actual en la zona horaria local
   */
  public getCurrentTimeDetails(date: Date = new Date()): { hour: number; minute: number; timeDecimal: number } {
    const hour = date.getHours();
    const minute = date.getMinutes();
    const timeDecimal = hour + minute / 60;
    return { hour, minute, timeDecimal };
  }

  /**
   * Calcula el intervalo óptimo y seguro según la franja horaria del día (Opción A)
   */
  public getAdaptiveInterval(date: Date = new Date(), baseOverrideSeconds?: number): AdaptiveIntervalResult {
    const { hour, minute, timeDecimal } = this.getCurrentTimeDetails(date);

    // Ventana 1: Medianoche (23:55 a 00:20) - Reset diario de agenda
    const isMidnightWindow = (hour === 23 && minute >= 55) || (hour === 0 && minute <= 20);

    // Ventana 2: Mañana pico (06:45 a 09:15) - Apertura de agendas
    const isMorningPeak = timeDecimal >= 6.75 && timeDecimal <= 9.25;

    // Ventana 3: Mediodía pico (11:50 a 13:15) - Actualización de citas canceladas
    const isMiddayPeak = timeDecimal >= 11.83 && timeDecimal <= 13.25;

    // FASE 1: HORAS PICO (Fast Polling: 35s - 50s)
    if (isMidnightWindow || isMorningPeak || isMiddayPeak) {
      const base = baseOverrideSeconds || 40;
      const jitter = Math.floor(Math.random() * 16) - 5; // -5s a +10s
      const seconds = Math.max(30, base + jitter);
      return {
        intervalMs: seconds * 1000,
        intervalSeconds: seconds,
        phase: 'PEAK',
        description: `🔥 Hora Pico (${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}) — Monitoreo rápido cada ${seconds}s`,
      };
    }

    // FASE 2: DÍA HÁBIL NORMAL (09:15 a 18:00) - Polling cada ~2 minutos
    if (timeDecimal > 9.25 && timeDecimal < 18.0) {
      const jitter = Math.floor(Math.random() * 31) - 15; // -15s a +15s
      const seconds = 120 + jitter; // ~105s a 135s (aprox 2 min)
      return {
        intervalMs: seconds * 1000,
        intervalSeconds: seconds,
        phase: 'DAYTIME',
        description: `🟡 Horario Normal (${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}) — Rastreo de cancelaciones cada ${seconds}s (~2 min)`,
      };
    }

    // FASE 3: TARDE / NOCHE (18:00 a 23:55) - Polling cada ~5 minutos
    if (timeDecimal >= 18.0 && !(hour === 23 && minute >= 55)) {
      const jitter = Math.floor(Math.random() * 41) - 20; // -20s a +20s
      const seconds = 300 + jitter; // ~280s a 320s (aprox 5 min)
      return {
        intervalMs: seconds * 1000,
        intervalSeconds: seconds,
        phase: 'EVENING',
        description: `☕ Tarde/Noche (${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}) — Monitoreo pasivo cada ${Math.round(seconds / 60)} min`,
      };
    }

    // FASE 4: NOCHE PROFUNDA / DORMIDO (00:20 a 06:45) - Polling cada 15 minutos para proteger IP
    const jitter = Math.floor(Math.random() * 121) - 60; // -60s a +60s
    const seconds = 900 + jitter; // ~14 a 16 min
    return {
      intervalMs: seconds * 1000,
      intervalSeconds: seconds,
      phase: 'NIGHT',
      description: `💤 Noche Profunda (${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}) — Modo reposo protector de IP (~15 min)`,
    };
  }
}
