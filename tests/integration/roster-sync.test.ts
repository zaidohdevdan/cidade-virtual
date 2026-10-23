// tests/integration/roster-sync.test.ts
// Falha se backend (ALL_CITIZENS), front (CITY_AGENTS) e vozes (CITIZEN_VOICE_PROFILES) divergirem.
import { describe, it, expect } from 'vitest';
import { ALL_CITIZENS, SEED_CITIZENS } from '../../apps/api/src/modules/citizens/citizens.seed';
import { CITY_AGENTS } from '../../apps/web-client/src/avatars/agent-avatar';
import { CITIZEN_VOICE_PROFILES } from '../../apps/web-client/src/audio/speech-synth';

describe('Roster canônico: backend e front sincronizados', () => {
  const backendIds = ALL_CITIZENS.map((c) => c.id).sort();

  it('o MVP possui exatamente 1 agente: agent-sulafat', () => {
    expect(backendIds).toEqual(['agent-sulafat']);
    expect(SEED_CITIZENS.length).toBe(1);
  });

  it('CITY_AGENTS (front) tem os mesmos ids que ALL_CITIZENS (backend)', () => {
    expect(CITY_AGENTS.map((a) => a.id).sort()).toEqual(backendIds);
  });

  it('CITIZEN_VOICE_PROFILES tem os mesmos ids que ALL_CITIZENS', () => {
    expect(Object.keys(CITIZEN_VOICE_PROFILES).sort()).toEqual(backendIds);
  });

  it('nomes batem entre backend e front', () => {
    for (const c of ALL_CITIZENS) {
      expect(CITY_AGENTS.find((a) => a.id === c.id)?.name).toBe(c.name);
    }
  });
});
