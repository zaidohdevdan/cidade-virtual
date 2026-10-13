// apps/api/src/tools/index.ts
import { tool } from '@langchain/core/tools';
import {
  createCitizenSchema,
  triggerEventSchema,
  getNPCMemorySchema,
  setEmotionStateSchema,
  requestHumanReviewSchema,
  weatherSetConditionSchema,
  npcBroadcastAlertSchema,
  getSceneSnapshotSchema,
} from '@cidade-virtual/tools/schemas';
import { CitizensService } from '../modules/citizens/citizens.service';
import { ScenariosService } from '../modules/scenarios/scenarios.service';
import { MemoryService } from '../modules/memory/memory.service';
import { ConsciousnessService } from '../modules/consciousness/consciousness.service';
import type { CitizenId, EventLog, MemorySnippet, TicketId, SceneSnapshot } from '@cidade-virtual/types';

/**
 * Cria um novo habitante na cidade.
 * RISCO: Operacional. Agente pode executar autonomamente dentro do rate limit.
 */
export const createCitizenTool = (svc: CitizensService) =>
  tool(
    async (input) => {
      // TODO: implementar chamada e persistência com CitizensService
      const citizen = await svc.create(input);
      return { citizenId: citizen.id, name: citizen.name, archetype: citizen.archetype };
    },
    {
      name: 'createCitizen',
      description: 'Cria um novo habitante na cidade virtual. Use para popular cenários.',
      schema: createCitizenSchema,
    }
  );

/**
 * Injeta um evento dramático no ambiente (acidente, festival, crime, clima).
 * RISCO: Operacional, mas afeta múltiplos NPCs. Log de auditoria obrigatório.
 */
export const triggerEventTool = (svc: ScenariosService) =>
  tool(
    async (input): Promise<EventLog> => {
      // TODO: implementar injeção de evento no ambiente e auditoria com ScenariosService
      return svc.triggerEvent(input);
    },
    {
      name: 'triggerEvent',
      description:
        'Injeta um evento dramático (acidente, festival, crime, weather, civic) no ambiente. ' +
        'Afeta NPCs próximos. Sempre loga auditoria.',
      schema: triggerEventSchema,
    }
  );

/**
 * Consulta memória recente de um NPC específico.
 * RISCO: Operacional (apenas leitura).
 */
export const getNPCMemoryTool = (svc: MemoryService) =>
  tool(
    async (input): Promise<MemorySnippet[]> => {
      // TODO: implementar consulta de memórias recentes no Qdrant via MemoryService
      return svc.queryByCitizen(input.npcId, input.timeframeHours, input.limit);
    },
    {
      name: 'getNPCMemory',
      description:
        'Consulta as memórias recentes de um NPC específico dentro de um período. ' +
        'Use para entender o contexto interno de um agente antes de tomar decisões sobre ele.',
      schema: getNPCMemorySchema,
    }
  );

/**
 * Define o estado emocional de um NPC. Use com cuidado: viola o princípio de emergência.
 * RISCO: Estrutural. Requer aprovação rápida de Daniel.
 */
export const setEmotionStateTool = (svc: CitizensService) =>
  tool(
    async (input) => {
      // TODO: implementar alteração de emoção forçada e auditoria com CitizensService
      // Nota: esta Tool marca o NPC como "externally manipulated" no log de auditoria.
      // Memórias geradas a partir disso são tageadas com origin='event' e emotionalWeight alto.
      await svc.setEmotion(input.citizenId, input.emotion, input.intensity, input.durationMinutes);
      return { ok: true, citizenId: input.citizenId, emotion: input.emotion };
    },
    {
      name: 'setEmotionState',
      description:
        'Define forçadamente o estado emocional de um NPC. USAR COM CUIDADO: viola o ' +
        'princípio de emergência social. Prefira causar eventos e deixar a emoção emergir. ' +
        'Requer aprovação de Daniel (nível Estrutural).',
      schema: setEmotionStateSchema,
    }
  );

/**
 * Solicita revisão humana para mudanças no core do projeto.
 * RISCO: Existencial. Sempre dispara ticket de revisão.
 */
export const requestHumanReviewTool = (svc: CitizensService /* HumanReviewService */) =>
  tool(
    async (input): Promise<{ ticketId: TicketId; status: 'pending' }> => {
      // TODO: persistir o changeset no banco e abrir ticket no painel admin para Daniel
      const ticket = await svc.requestReview(input);
      return { ticketId: ticket.id, status: 'pending' };
    },
    {
      name: 'requestHumanReview',
      description:
        'Solicita revisão humana explícita de Daniel para mudanças no core do projeto ' +
        '(lógica de Transição de Consciência, schemas, migrations destrutivas). ' +
        'NUNCA tente implementar mudanças desse escopo sem chamar esta Tool primeiro.',
      schema: requestHumanReviewSchema,
    }
  );

/**
 * Define condição climática de um cenário.
 * RISCO: Operacional. Agente pode executar autonomamente.
 */
export const weatherSetConditionTool = (svc: ScenariosService) =>
  tool(
    async (input) => {
      // TODO: implementar atualização de clima com ScenariosService
      await svc.setWeather(input.scenarioId, input.condition, input.durationMinutes, input.intensity);
      return { ok: true, scenarioId: input.scenarioId, condition: input.condition };
    },
    {
      name: 'weatherSetCondition',
      description: 'Define a condição climática de um cenário (clear, rain, storm, fog, snow).',
      schema: weatherSetConditionSchema,
    }
  );

/**
 * Broadcasta alerta para NPCs. NPCs reagem com base nas memórias e personalidade.
 * RISCO: Operacional.
 */
export const npcBroadcastAlertTool = (svc: CitizensService) =>
  tool(
    async (input) => {
      // TODO: implementar broadcast de mensagem curta para NPCs do cenário
      const recipients = await svc.broadcastAlert(input);
      return { delivered: recipients.length, recipientIds: recipients };
    },
    {
      name: 'npcBroadcastAlert',
      description:
        'Envia um alerta curto (máx 280 chars) para NPCs de um cenário. ' +
        'NPCs decidem como reagir com base em memórias e personalidade — não há garantia de resposta.',
      schema: npcBroadcastAlertSchema,
    }
  );

/**
 * Snapshot completo de uma cena (NPCs, objetos, clima, hora).
 * RISCO: Operacional (apenas leitura). Essencial para o agente tomar decisões contextuais.
 */
export const getSceneSnapshotTool = (svc: ScenariosService) =>
  tool(
    async (input): Promise<SceneSnapshot> => {
      // TODO: implementar recuperação de snapshot completo do cenário
      return svc.getSnapshot(input.scenarioId, input.includeMemories);
    },
    {
      name: 'getSceneSnapshot',
      description:
        'Recupera o snapshot completo de uma cena: NPCs (posição + emoção), objetos, ' +
        'clima e hora. SEMPRE chame esta Tool antes de tomar decisões que afetam um cenário.',
      schema: getSceneSnapshotSchema,
    }
  );
