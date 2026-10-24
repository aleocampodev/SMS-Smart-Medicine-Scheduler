export function flattenAppointments(
  data: any,
  requestedBranch: string,
  branchName?: string,
): any[] {
  if (!data) return [];

  // 1. Flatten Qanty nested appointments object: { appointments: { [time]: { "0": {...}, "1": {...} } } }
  if (data && data.appointments && typeof data.appointments === "object") {
    const slots: any[] = [];
    for (const [timeKey, slotDict] of Object.entries(data.appointments)) {
      if (slotDict && typeof slotDict === "object") {
        for (const [idxKey, slot] of Object.entries(slotDict as Record<string, any>)) {
          if (!slot || typeof slot !== "object") continue;
          slots.push({
            ...slot,
            timeKey,
            slotIndex: idxKey,
            date: (slot as any).name ? (slot as any).name.split(" ")[0] : timeKey.split("T")[0],
            time: (slot as any).name
              ? (slot as any).name.split(" ")[1]
              : timeKey.split("T")[1]?.slice(0, 5),
            branch: branchName || `Medellin Branch ${requestedBranch}`,
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

  return [];
}
