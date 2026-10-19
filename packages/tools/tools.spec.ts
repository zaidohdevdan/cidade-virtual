import { describe, it, expect } from 'vitest';
import {
  createCitizenSchema,
  triggerEventSchema,
  getNPCMemorySchema,
  setEmotionStateSchema,
  requestHumanReviewSchema,
  weatherSetConditionSchema,
  npcBroadcastAlertSchema,
  getSceneSnapshotSchema,
  createTool,
} from './index';

describe('packages/tools — Unit Tests dos 8 Schemas e createTool', () => {
  const validUUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

  it('1. createCitizenSchema valida e rejeita dados inválidos', () => {
    const valid = createCitizenSchema.parse({
      name: 'Daniel',
      archetype: 'guard',
      initialPosition: { lat: 10, lng: -20 },
    });
    expect(valid.name).toBe('Daniel');
    expect(valid.initialEmotion).toBe('calm');
    expect(() => createCitizenSchema.parse({ name: 'x', archetype: 'invalid', initialPosition: { lat: 999, lng: 0 } })).toThrow();
  });

  it('2. triggerEventSchema valida tipo, localização e descrição', () => {
    const valid = triggerEventSchema.parse({
      type: 'festival',
      location: { lat: 0, lng: 0 },
      description: 'Celebração da Primavera',
    });
    expect(valid.severity).toBe('medium');
    expect(() => triggerEventSchema.parse({ type: 'alien' })).toThrow();
  });

  it('3. getNPCMemorySchema valida UUID e restrições de paginação', () => {
    const valid = getNPCMemorySchema.parse({ npcId: validUUID });
    expect(valid.timeframeHours).toBe(24);
    expect(() => getNPCMemorySchema.parse({ npcId: 'bad-id', limit: 200 })).toThrow();
  });

  it('4. setEmotionStateSchema valida emoções válidas e intensidade [0,1]', () => {
    const valid = setEmotionStateSchema.parse({ citizenId: validUUID, emotion: 'joyful' });
    expect(valid.intensity).toBe(0.5);
    expect(() => setEmotionStateSchema.parse({ citizenId: validUUID, emotion: 'unknown', intensity: 2 })).toThrow();
  });

  it('5. requestHumanReviewSchema valida formato de changeset e prioridade', () => {
    const valid = requestHumanReviewSchema.parse({
      changeSet: [{ filePath: 'file.ts', before: 'a', after: 'b', rationale: 'fix' }],
      summary: 'Ajuste',
    });
    expect(valid.priority).toBe('medium');
    expect(() => requestHumanReviewSchema.parse({ changeSet: [], summary: 'a'.repeat(600) })).toThrow();
  });

  it('6. weatherSetConditionSchema valida condições climáticas suportadas', () => {
    const valid = weatherSetConditionSchema.parse({ scenarioId: validUUID, condition: 'storm' });
    expect(valid.condition).toBe('storm');
    expect(() => weatherSetConditionSchema.parse({ scenarioId: validUUID, condition: 'tornado' })).toThrow();
  });

  it('7. npcBroadcastAlertSchema restringe mensagens a 280 caracteres', () => {
    const valid = npcBroadcastAlertSchema.parse({ message: 'Alerta emitido com sucesso' });
    expect(valid.severity).toBe('info');
    expect(() => npcBroadcastAlertSchema.parse({ message: 'abc' })).toThrow();
  });

  it('8. getSceneSnapshotSchema valida UUID de cenário', () => {
    const valid = getSceneSnapshotSchema.parse({ scenarioId: validUUID });
    expect(valid.includeMemories).toBe(false);
    expect(() => getSceneSnapshotSchema.parse({ scenarioId: '123' })).toThrow();
  });

  it('createTool cria ferramenta executável e tipada', async () => {
    const tool = createTool(
      async (input) => ({ ok: true, id: input.scenarioId }),
      {
        name: 'testTool',
        description: 'Test Tool',
        schema: getSceneSnapshotSchema,
      },
    );
    expect(tool.name).toBe('testTool');
    const res = await tool.invoke({ scenarioId: validUUID, includeMemories: false });
    expect(res.ok).toBe(true);
  });
});
