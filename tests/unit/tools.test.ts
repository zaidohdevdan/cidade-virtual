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
} from '../../packages/tools';

describe('tests/unit/tools.test.ts — Validação dos 8 Schemas Zod de Ferramentas Urbanas', () => {
  const validUUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const invalidUUID = 'not-a-valid-uuid-string';

  describe('1. createCitizenSchema', () => {
    it('deve aceitar payload válido com valores padrão aplicados', () => {
      const parsed = createCitizenSchema.parse({
        name: 'Lyra',
        archetype: 'citizen',
        initialPosition: { lat: -23.5505, lng: -46.6333, altitude: 0.19 },
      });
      expect(parsed.name).toBe('Lyra');
      expect(parsed.initialEmotion).toBe('calm');
    });

    it('deve rejeitar nome muito curto, arquétipo desconhecido e latitude inválida', () => {
      expect(() =>
        createCitizenSchema.parse({
          name: 'A', // min 2
          archetype: 'alien_cyborg',
          initialPosition: { lat: 120.0, lng: 0 }, // max 90
        }),
      ).toThrow();
    });
  });

  describe('2. triggerEventSchema', () => {
    it('deve aceitar evento válido com severidade default medium', () => {
      const parsed = triggerEventSchema.parse({
        type: 'accident',
        location: { lat: 10.0, lng: 20.0 },
        description: 'Colisão leve entre bicicleta e poste de iluminação',
      });
      expect(parsed.severity).toBe('medium');
      expect(parsed.type).toBe('accident');
    });

    it('deve rejeitar tipo inválido ou ausência de descrição', () => {
      expect(() =>
        triggerEventSchema.parse({
          type: 'earthquake_apocalypse',
          location: { lat: 10.0, lng: 20.0 },
        }),
      ).toThrow();
    });
  });

  describe('3. getNPCMemorySchema', () => {
    it('deve aceitar consulta com UUID e aplicar limites padrão', () => {
      const parsed = getNPCMemorySchema.parse({
        npcId: validUUID,
      });
      expect(parsed.timeframeHours).toBe(24);
      expect(parsed.limit).toBe(20);
    });

    it('deve rejeitar ID não-UUID ou limites fora da faixa operacional', () => {
      expect(() =>
        getNPCMemorySchema.parse({
          npcId: invalidUUID,
          limit: 500, // max 100
        }),
      ).toThrow();
    });
  });

  describe('4. setEmotionStateSchema', () => {
    it('deve aceitar estado emocional válido com valores padrão', () => {
      const parsed = setEmotionStateSchema.parse({
        citizenId: validUUID,
        emotion: 'curious',
      });
      expect(parsed.intensity).toBe(0.5);
      expect(parsed.durationMinutes).toBe(60);
    });

    it('deve rejeitar emoção desconhecida ou intensidade > 1', () => {
      expect(() =>
        setEmotionStateSchema.parse({
          citizenId: validUUID,
          emotion: 'ecstatic_unknown',
          intensity: 1.5,
        }),
      ).toThrow();
    });
  });

  describe('5. requestHumanReviewSchema', () => {
    it('deve aceitar changeset válido e prioridade padrão', () => {
      const parsed = requestHumanReviewSchema.parse({
        changeSet: [
          {
            filePath: 'src/core.ts',
            before: 'let x = 1;',
            after: 'const x = 1;',
            rationale: 'Imutabilidade',
          },
        ],
        summary: 'Revisão de imutabilidade',
      });
      expect(parsed.priority).toBe('medium');
      expect(parsed.changeSet).toHaveLength(1);
    });

    it('deve rejeitar quando faltam propriedades obrigatórias no changeset', () => {
      expect(() =>
        requestHumanReviewSchema.parse({
          changeSet: [{ filePath: 'src/core.ts' }],
          summary: 'Incompleto',
        }),
      ).toThrow();
    });
  });

  describe('6. weatherSetConditionSchema', () => {
    it('deve aceitar condições meteorológicas válidas', () => {
      const parsed = weatherSetConditionSchema.parse({
        condition: 'rain',
        scenarioId: validUUID,
      });
      expect(parsed.condition).toBe('rain');
      expect(parsed.intensity).toBe(0.5);
      expect(parsed.durationMinutes).toBe(60);
    });

    it('deve rejeitar condição inexistente ou intensidade negativa', () => {
      expect(() =>
        weatherSetConditionSchema.parse({
          condition: 'volcanic_ash',
          scenarioId: validUUID,
          intensity: -0.2,
        }),
      ).toThrow();
    });
  });

  describe('7. npcBroadcastAlertSchema', () => {
    it('deve aceitar mensagem entre 5 e 280 caracteres', () => {
      const parsed = npcBroadcastAlertSchema.parse({
        message: 'Atenção pedestres: semáforo central em manutenção preventiva.',
      });
      expect(parsed.severity).toBe('info');
      expect(parsed.message).toContain('semáforo central');
    });

    it('deve rejeitar mensagem com menos de 5 caracteres ou mais de 280 caracteres', () => {
      expect(() =>
        npcBroadcastAlertSchema.parse({
          message: 'Oi', // min 5
        }),
      ).toThrow();

      expect(() =>
        npcBroadcastAlertSchema.parse({
          message: 'A'.repeat(281), // max 280
        }),
      ).toThrow();
    });
  });

  describe('8. getSceneSnapshotSchema', () => {
    it('deve aceitar UUID de cenário válido e incluir memories falso por padrão', () => {
      const parsed = getSceneSnapshotSchema.parse({
        scenarioId: validUUID,
      });
      expect(parsed.scenarioId).toBe(validUUID);
      expect(parsed.includeMemories).toBe(false);
    });

    it('deve rejeitar scenarioId não formatado como UUID v4', () => {
      expect(() =>
        getSceneSnapshotSchema.parse({
          scenarioId: invalidUUID,
        }),
      ).toThrow();
    });
  });

  describe('createTool Helper', () => {
    it('deve instanciar uma ferramenta tipada que executa a invocação', async () => {
      const tool = createTool(
        async (input) => {
          return { echo: input.scenarioId };
        },
        {
          name: 'getSceneSnapshot',
          description: 'Recupera snapshot',
          schema: getSceneSnapshotSchema,
        },
      );

      expect(tool.name).toBe('getSceneSnapshot');
      expect(tool.description).toBe('Recupera snapshot');
      const result = await tool.invoke({ scenarioId: validUUID, includeMemories: true });
      expect(result.echo).toBe(validUUID);
    });
  });
});
