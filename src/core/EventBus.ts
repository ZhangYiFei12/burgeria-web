/**
 * 极简类型安全事件总线（不依赖 Phaser，逻辑层可单测）
 * 用法：
 *   bus.on('serve', (r) => ...)
 *   bus.emit('serve', result)
 */
export type Handler<T> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of [...set]) {
      (h as Handler<Events[K]>)(payload);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
