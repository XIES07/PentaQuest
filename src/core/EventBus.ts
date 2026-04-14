type Listener<TPayload> = (payload: TPayload) => void;

export class EventBus<TEvents extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof TEvents, Listener<unknown>[]>();

  on<K extends keyof TEvents>(event: K, callback: Listener<TEvents[K]>): void {
    const current = this.listeners.get(event) ?? [];
    current.push(callback as Listener<unknown>);
    this.listeners.set(event, current);
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const current = this.listeners.get(event) ?? [];
    current.forEach((listener) => listener(payload));
  }
}
