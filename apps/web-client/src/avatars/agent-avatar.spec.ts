import { describe, it, expect } from 'vitest';
import { CITY_AGENTS } from './agent-avatar';

describe('AgentAvatar & CITY_AGENTS (Unit Test — Web Client)', () => {
  it('deve possuir exatamente os 7 cidadãos estelares inspirados na Constelação de Lira', () => {
    expect(CITY_AGENTS).toHaveLength(7);

    const names = CITY_AGENTS.map((a) => a.name);
    expect(names).toContain('Vega');
    expect(names).toContain('Sulafat');
    expect(names).toContain('Sheliak');
    expect(names).toContain('Epsilon');
    expect(names).toContain('Aladfar');
    expect(names).toContain('Xihe');
    expect(names).toContain('Chasoň');
  });

  it('todos os agentes devem possuir IDs únicos, designações estelares e pontos de patrulha válidos', () => {
    const ids = new Set<string>();

    for (const agent of CITY_AGENTS) {
      expect(ids.has(agent.id)).toBe(false);
      ids.add(agent.id);

      expect(agent.starDesignation).toBeDefined();
      expect(agent.role).toBeDefined();
      expect(agent.startPosition).toBeDefined();
      expect(agent.patrolPoints.length).toBeGreaterThanOrEqual(2);
    }
  });
});
