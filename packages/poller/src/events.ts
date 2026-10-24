export type PollerEventType =
  | "poll:start"
  | "poll:success"
  | "poll:empty"
  | "poll:error"
  | "availability:found"
  | "circuit:trip"
  | "circuit:reset";

export interface PollerEvent {
  type: PollerEventType;
  branchId: string;
  timestamp: number;
  payload?: any;
}

export type PollerEventHandler = (event: PollerEvent) => void | Promise<void>;

export class PollerEventBus {
  private handlers: Map<PollerEventType, Set<PollerEventHandler>> = new Map();

  public on(type: PollerEventType, handler: PollerEventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.off(type, handler);
  }

  public off(type: PollerEventType, handler: PollerEventHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  public async emit(event: PollerEvent): Promise<void> {
    const set = this.handlers.get(event.type);
    if (!set) return;
    for (const handler of set) {
      try {
        await handler(event);
      } catch (err: any) {
        console.error(`[PollerEventBus] Handler error for ${event.type}:`, err?.message || err);
      }
    }
  }
}
