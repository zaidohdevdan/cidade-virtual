// packages/agent-planning/memory-store.ts
// Armazenamento procedural em memória para reutilização de planos e estratégias eficazes

import type { Plan, ProceduralMemoryStore } from './types.js';

/**
 * Normaliza a chave textual da meta para busca invariante a acentuação e caixa.
 */
export function normalizeGoalKey(goal: string): string {
  return goal
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos/acentos
    .replace(/[^a-z0-9]+/g, '_')     // substitui pontuação por underline
    .replace(/^_+|_+$/g, '');        // trim underlines
}

export class InMemoryProceduralMemoryStore implements ProceduralMemoryStore {
  private readonly store = new Map<string, Plan>();

  get(goalKey: string): Plan | null {
    const key = normalizeGoalKey(goalKey);
    const plan = this.store.get(key);
    if (!plan) return null;
    // Retorna cópia profunda dos passos para evitar mutações acidentais
    return {
      ...plan,
      steps: plan.steps.map((s) => ({ ...s })),
    };
  }

  set(goalKey: string, plan: Plan): void {
    const key = normalizeGoalKey(goalKey);
    this.store.set(key, {
      ...plan,
      steps: plan.steps.map((s) => ({ ...s })),
      updatedAt: new Date().toISOString(),
    });
  }

  delete(goalKey: string): void {
    const key = normalizeGoalKey(goalKey);
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}
