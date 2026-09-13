import { QantySlot, RuleEvaluationResult } from '../types/index.js';

export class RulesEngine {
  // Guarda hashes o IDs de slots ya notificados para no repetir alertas cada 30s
  private notifiedSlots: Set<string> = new Set();

  /**
   * Formatea la fecha de hoy en formato YYYY-MM-DD en hora local
   */
  private getTodayString(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Evalúa las 3 reglas del diagrama:
   * 1. Trae más de dos JSON / slots
   * 2. Status 'free'
   * 3. Fechas diferentes a la fecha actual (current date)
   */
  public evaluate(rawItems: any[]): RuleEvaluationResult {
    const reasons: string[] = [];
    const todayStr = this.getTodayString();

    // Regla 1: Trae más de 2 items/JSON
    if (!Array.isArray(rawItems) || rawItems.length <= 2) {
      return {
        hasAvailability: false,
        matchingSlots: [],
        reasons: [`No cumple Regla 1: se recibieron ${rawItems?.length || 0} items (debe ser > 2)`],
      };
    }

    reasons.push(`Cumple Regla 1: cantidad de items recibidos (${rawItems.length}) > 2`);

    // Parsear y evaluar Regla 2 y Regla 3
    const matchingSlots: QantySlot[] = [];

    for (const item of rawItems) {
      // Normalizar estructura común de Qanty / agendamiento
      const status = (item.status || item.state || '').toString().toLowerCase();
      const slotDate = (item.date || item.appointment_date || item.day || '').toString().split('T')[0];
      const slotTime = (item.time || item.hour || item.start_time || '').toString();
      const slotId = item.id || item.slot_id || `${slotDate}_${slotTime}`;

      // Regla 2: status == 'free' o 'disponible'
      const isFree = status === 'free' || status === 'disponible' || status === 'available';

      // Regla 3: fecha diferente a hoy (y preferiblemente fecha futura)
      const isDifferentDate = Boolean(slotDate && slotDate !== todayStr);

      if (isFree && isDifferentDate) {
        matchingSlots.push({
          id: slotId,
          date: slotDate,
          time: slotTime,
          status,
          branch: item.branch || item.location || 'Sede Principal',
          specialty: item.specialty || item.service || 'Dispensación Medicamentos',
          raw: item,
        });
      }
    }

    if (matchingSlots.length === 0) {
      return {
        hasAvailability: false,
        matchingSlots: [],
        reasons: [
          ...reasons,
          'No cumple Reglas 2 o 3: no se encontraron slots libres con fecha diferente a hoy',
        ],
      };
    }

    reasons.push(
      `Cumple Regla 2 y 3: se encontraron ${matchingSlots.length} slots libres para fechas posteriores a hoy`,
    );

    return {
      hasAvailability: true,
      matchingSlots,
      reasons,
    };
  }

  /**
   * Filtra únicamente los slots que no han sido alertados previamente
   */
  public filterUnnotifiedSlots(slots: QantySlot[]): QantySlot[] {
    const newSlots = slots.filter((slot) => {
      const key = `${slot.date}_${slot.time}_${slot.id}`;
      if (this.notifiedSlots.has(key)) {
        return false;
      }
      this.notifiedSlots.add(key);
      return true;
    });

    // Limpieza de memoria si el set crece demasiado (> 5000)
    if (this.notifiedSlots.size > 5000) {
      this.notifiedSlots.clear();
    }

    return newSlots;
  }
}
