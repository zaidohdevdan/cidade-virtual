import type { KnowledgeItem } from '@cidade-virtual/types';

export class SharedKnowledgeRepository {
  private items = new Map<string, KnowledgeItem>();

  publish(item: KnowledgeItem): void {
    this.items.set(item.id, item);
  }

  queryVerified(): KnowledgeItem[] {
    return Array.from(this.items.values()).filter((i) => i.verified);
  }
}
