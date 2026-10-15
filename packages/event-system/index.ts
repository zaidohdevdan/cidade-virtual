import type { DomainEvent } from '@cidade-virtual/types';

export type EventHandler<T = any> = (event: DomainEvent<T>) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  subscribe(eventName: string, handler: EventHandler): void {
    const list = this.handlers.get(eventName) ?? [];
    list.push(handler);
    this.handlers.set(eventName, list);
  }

  async publish(event: DomainEvent): Promise<void> {
    const list = this.handlers.get(event.name) ?? [];
    for (const h of list) {
      await h(event);
    }
  }
}
