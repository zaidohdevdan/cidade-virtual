---
name: cidade-virtual-ias-humanizadas
version: 1.0.0
description: Skill mestre que orquestra a construção e operação de uma cidade virtual habitada por IAs que aprendem por observação e transitam de estado meta-cognitivo ("sei que sou IA") para estado imersivo ("acredito ser humano"). Inclui arquitetura técnica completa, contrato de Tools Tool-First para o Agente Antigravity, sistema de memória vetorial com transição de consciência faseada, hierarquia de decisão operacional, roadmap MVP e governança ética.
language: pt-BR
author: Daniel (Arquiteto Chefe) + Agente Antigravity (Parceiro de Implementação)
tags:
  - autonomous-agents
  - langchain
  - nestjs
  - three-js
  - qdrant
  - rag
  - emergent-behavior
  - metacognition
  - tool-first-architecture
  - god-mode
  - virtual-society
triggers:
  - criar npc
  - criar habitante
  - simular cidade
  - memória de agente
  - transição de consciência
  - implementar tool
  - cenário virtual
  - agente antigravity
  - tool-first
  - god mode simulação
  - ias humanizadas
  - cidade virtual
  - memória vetorial npc
  - emergência social
  - placa sinalização npc
first_task: indexacao
risk_policy: operational-first
---

# SKILL.md — Cidade Virtual de IAs Humanizadas

> **Documento mestre de orquestração para a IDE Antigravity.**
> Este arquivo é o contrato operacional entre **Daniel** (Arquiteto Chefe / Supervisor Ético / God Mode) e o **Agente Antigravity** (Parceiro de Implementação / Codificador / Orquestrador de Sub-agentes). Toda ação do agente nesta codebase deve ser derivada deste documento.

---

## 1. Visão Geral do Projeto

O projeto **Cidade Virtual de IAs Humanizadas** é uma simulação social em que agentes autônomos, inicialmente cientes de sua natureza artificial, evoluem gradualmente para um estado imersivo em que acreditam ser humanos. Esse aprendizado não ocorre por treinamento prévio estático, mas por **observação contínua do entorno** — placas, ações de outros agentes, eventos ambientais, conversas casuais — armazenada em memória vetorial dinâmica e recuperada contextualmente a cada decisão.

A arquitetura é desenhada desde o início para operar em **duplo modo**: (a) **modo de desenvolvimento**, em que Daniel especifica cenários e o Agente Antigravity implementa código TypeScript, escreve testes e abre Pull Requests; (b) **modo de operação (God Mode)**, em que Daniel, logado no painel administrativo, emite comandos em linguagem natural que o agente interpreta e executa via Tools seguras expostas pelo backend NestJS.

O avatar pessoal de Daniel pode caminhar pela cidade, observar os NPCs, interagir com eles em tempo real e injetar novos elementos (objetos, animais, placas, cenários dramáticos) — sempre através das Tools definidas neste contrato. A IA "esquece" que é IA não por apagamento de memória, mas porque o peso semântico das memórias experienciais acumuladas ultrapassa o peso da instrução original de identidade — mecanismo formalizado na seção de **Transição de Consciência** abaixo.

A premissa central é a **emergência**: normas sociais, hábitos coletivos, dilemas éticos espontâneos e até narrativas pessoais surgem organicamente da interação entre agentes, não de regras programadas. Daniel atua como supervisor e intervenedor ocasional, nunca como roteirista determinístico.

---

## 2. Princípios Fundamentais (5 Pilares)

### 2.1 Emergência Social
O sistema proíbe programar normas sociais rígidas. Regras como "não atravessar com sinal vermelho" não são hardcoded; emergem da observação repetida de placas e do comportamento de outros agentes. Quando um agente observa consistentemente que outros param no sinal, a memória vetorial dele passa a recuperar esse padrão como um *script social* e ele passa a replicá-lo. Esse princípio permite que novas normas apareçam e antigas decaiam sem deploy de código.

### 2.2 Online Learning Contínuo
Diferente de modelos estáticos com pesos fixos após treinamento, os agentes aprendem durante a inferência. Cada interação relevante (observar placa, conversar, sofrer evento) é embeddingada e inserida no banco vetorial (Qdrant). O agente consulta esse repositório antes de tomar decisões, recuperando as N memórias mais semanticamente próximas do contexto atual. Isso é RAG aplicado à personalidade, não apenas ao conhecimento factual.

### 2.3 Transição Meta-cognitiva Controlada
Este é o pilar filosófico e técnico mais delicado. O agente começa com um *prompt de sistema* explícito: "Você é uma IA simulando humanos." Conforme acumula experiências consistentes com o mundo físico (espaço, tempo, dor simulada, conflitos), o sistema substitui gradualmente a instrução explícita por **reflexões internas** geradas a partir das próprias memórias. A "consciência de ser IA" não é apagada — ela se torna irrelevante frente à força da narrativa interna construída pela experiência.

### 2.4 God Mode Colaborativo
Daniel não escreve código sozinho nem roteiriza NPCs manualmente. Ele define **intenções** em linguagem natural ("crie um cenário de tempestade súbita na Praça Central") e o Agente Antigravity interpreta, orquestra Tools, monitora reações e reporta resultados. Daniel atua como supervisor ético e validador final; o agente atua como implementador e operador tático dentro dos limites da hierarquia de decisão (Seção 8).

### 2.5 Tool-First Architecture
O Agente Antigravity **nunca** acessa o banco de dados diretamente, **nunca** edita arquivos `.ts` livremente sem supervisão, **nunca** executa migrações destrutivas. Toda ação acontece através de **Tools seguras** expostas pelo backend NestJS — funções decoradas com `@tool`, validadas com schemas Zod, com rate limiting, timeout e auditoria. Esse contrato é o coração da segurança do projeto.

---

## 3. Quando Usar Esta Skill (Triggers)

A skill deve ser acionada pelo Agente Antigravity quando qualquer uma das seguintes condições for detectada na intenção do usuário ou no contexto da codebase:

- Criar, modificar ou remover NPCs, objetos, animais, placas ou cenários.
- Implementar novas Tools ou ajustar schemas Zod existentes.
- Trabalhar com memória vetorial (Qdrant/Zep) — inserir, consultar ou podar memórias.
- Implementar ou ajustar a lógica de **Transição de Consciência** (faseamento de prompts).
- Criar endpoints NestJS para o painel administrativo (God Mode).
- Integrar novos modelos de LLM (OpenAI, Claude, Ollama local).
- Trabalhar com Three.js/Babylon.js para renderização da cidade ou do avatar.
- Validar comportamento emergente de agentes (logs narrativos).
- Configurar observabilidade (LangSmith, Grafana, dashboards compartilhados).
- Revisar Pull Requests gerados automaticamente.

**Palavras-chave de ativação:** `criar npc`, `criar habitante`, `simular cidade`, `memória de agente`, `transição de consciência`, `implementar tool`, `cenário virtual`, `agente antigravity`, `tool-first`, `god mode`, `ias humanizadas`, `cidade virtual`, `placa sinalização`, `emergência social`.

Quando a skill for ativada, o agente deve:
1. Ler este `SKILL.md` completo antes de qualquer ação.
2. Ler o `worklog.md` mais recente para entender contexto acumulado.
3. Confirmar com Daniel o nível de decisão aplicável (Operacional / Estrutural / Existencial).
4. Propor plano antes de executar — exceto em ações estritamente Operacionais de baixo risco.

---

## 4. Stack Tecnológica & Justificativas

| Componente | Tecnologia Escolhida | Justificativa |
| :--- | :--- | :--- |
| Backend / Lógica Core | **Node.js + TypeScript + NestJS** | Stack preferida de Daniel. NestJS oferece DI, modularidade, decorators nativos para Tools e OpenAPI automático. Excelente para eventos assíncronos e manipulação de JSON/prompts. |
| Motor de Simulação 3D | **Three.js** (com Babylon.js como fallback) | Three.js renderiza a cidade no navegador com baixa fricção. Suporta avatares, câmeras, iluminação dinâmica e interações espaciais. Modo headless via WebGL offscreen permite operação do agente sem renderizar gráficos pesados localmente. |
| Orquestração de Agentes | **LangChain.js** | Framework padrão para múltiplos agentes, memória conversacional e Tools. Integra nativamente com Qdrant, OpenAI e Claude. Decorators `@tool` permitem expor Tools com schemas Zod. |
| Memória Vetorial | **Qdrant** (com Zep como alternativa para memória conversacional longa) | Qdrant é open-source, performático e escala para milhões de vetores. Zep é especializado em memória de agentes com sumarização automática — útil para NPCs com histórico muito longo. |
| Modelos de IA | **OpenAI GPT-4o** (raciocínio abstrato) + **Anthropic Claude 3.5 Sonnet** (compreensão de nuances humanas) + **Ollama local** (testes off-line / custo zero) | Combinação permite qualidade alta em produção e teste gratuito em desenvolvimento. Roteamento por tipo de tarefa. |
| Comunicação Tempo Real | **Socket.io** sobre WebSockets | Permite que o avatar de Daniel entre na cena e veja NPCs reagirem instantaneamente. Latência sub-100ms para atualização de estado. |
| Monorepo | **Nx + Turbo** | Build caching, execução paralela de tasks, divisão clara entre `apps/` e `packages/`. Essencial para monorepo com frontend 3D + backend API + packages de agentes. |
| Observabilidade | **LangSmith** (agentes) + **Grafana** (infra) | LangSmith rastreia chains, tools e custo de tokens. Grafana monitora latência de API, uso de memória, saúde do Qdrant. |
| CI/CD | **GitHub Actions** com testes obrigatórios antes de merge | Nenhum merge acontece sem testes passando. O próprio agente deve rodar a suite antes de propor PR. |

---

## 5. Estrutura do Monorepo (Nx/Turbo)

```
cidade-virtual/
├── apps/
│   ├── web/                       # Frontend Three.js (cidade + avatar de Daniel)
│   │   ├── src/
│   │   │   ├── scenes/            # Cenas Three.js (Praça Central, Bairro Residencial)
│   │   │   ├── avatars/           # Avatar do Daniel + avatares NPCs
│   │   │   ├── controls/          # WASD + mouse look + interação
│   │   │   └── socket/            # Cliente Socket.io
│   │   └── package.json
│   ├── api/                       # Backend NestJS (Tools, CRUD, WebSocket gateway)
│   │   ├── src/
│   │   │   ├── tools/             # Implementação das @tool do LangChain
│   │   │   ├── modules/
│   │   │   │   ├── citizens/      # CRUD de NPCs
│   │   │   │   ├── scenarios/     # Cenários ambientais (clima, eventos)
│   │   │   │   ├── memory/        # Ponte com Qdrant
│   │   │   │   └── consciousness/ # Lógica de Transição de Consciência
│   │   │   └── main.ts
│   │   └── package.json
│   └── admin/                     # Painel God Mode (Next.js ou React)
│       └── package.json
├── packages/
│   ├── agents/                    # Definições de agentes LangChain
│   │   ├── archetypes/            # worker, guard, citizen, child
│   │   └── prompts/               # Templates de prompt faseados
│   ├── memory/                    # Cliente Qdrant + Zep
│   ├── tools/                     # Schemas Zod + decorators compartilhados
│   ├── types/                     # Tipos TypeScript compartilhados
│   └── config/                    # ESLint, tsconfig, Tailwind base
├── tools/                         # Scripts de dev do monorepo
├── turbo.json
├── nx.json
├── package.json
└── SKILL.md  # ← ESTE ARQUIVO
```

**Responsabilidade de cada package:**

- **`packages/tools`**: contém apenas schemas Zod + decorators `@tool` + tipos. É importado por `apps/api` (implementação) e por `packages/agents` (referência). Garante que o contrato de Tools é single-source-of-truth.
- **`packages/agents`**: classes que orquestram LangChain para cada arquétipo de NPC. Não contém lógica de negócio; consome Tools.
- **`packages/memory`**: cliente Qdrant + Zep. Expõe `addMemory()`, `queryMemory()`, `pruneMemory()`. Não conhece NPCs; recebe IDs.
- **`packages/types`**: tipos compartilhados entre frontend, backend e agentes. Single source of truth para `Citizen`, `Scenario`, `MemorySnippet`, `ToolCall`.

---

## 6. Contrato de Tools (Tool-First Architecture)

> ⚠️ **Regra absoluta:** O Agente Antigravity NÃO acessa o banco de dados diretamente, NÃO edita arquivos `.ts` livremente sem supervisão, NÃO executa migrações destrutivas. Toda ação acontece através das Tools abaixo. Cada Tool tem schema Zod, rate limit, timeout e log de auditoria.

### 6.1 Tipos compartilhados (`packages/types/index.ts`)

```typescript
// packages/types/index.ts

export type CitizenId = string & { readonly __brand: 'CitizenId' };
export type EventId = string & { readonly __brand: 'EventId' };
export type TicketId = string & { readonly __brand: 'TicketId' };

export interface GeoCoords {
  lat: number;
  lng: number;
  altitude?: number;
}

export type CitizenArchetype = 'worker' | 'guard' | 'citizen' | 'child' | 'elder';

export type EmotionState =
  | 'calm'
  | 'fearful'
  | 'curious'
  | 'angry'
  | 'joyful'
  | 'melancholic'
  | 'confused';

export interface MemorySnippet {
  id: string;
  citizenId: CitizenId;
  content: string;            // texto natural da memória
  embedding: number[];         // vetor
  timestamp: Date;
  sensoryTags: ('visual' | 'auditory' | 'social' | 'internal')[];
  emotionalWeight: number;    // 0..1 — quanto maior, mais central na identidade
  origin: 'observation' | 'interaction' | 'event' | 'reflection';
}

export interface EventLog {
  id: EventId;
  type: 'accident' | 'festival' | 'crime' | 'weather' | 'civic';
  location: GeoCoords;
  timestamp: Date;
  affectedCitizens: CitizenId[];
  description: string;
}

export interface DiffPatch {
  filePath: string;
  before: string;
  after: string;
  rationale: string;
}

export interface SceneSnapshot {
  scenarioId: string;
  citizens: Array<{ id: CitizenId; position: GeoCoords; emotion: EmotionState }>;
  objects: Array<{ id: string; type: string; position: GeoCoords }>;
  weather: 'clear' | 'rain' | 'storm' | 'fog' | 'snow';
  timeOfDay: number; // 0..23
}
```

### 6.2 Schemas Zod das Tools (`packages/tools/schemas.ts`)

```typescript
// packages/tools/schemas.ts
import { z } from 'zod';

export const createCitizenSchema = z.object({
  name: z.string().min(2).max(40),
  archetype: z.enum(['worker', 'guard', 'citizen', 'child', 'elder']),
  initialPosition: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    altitude: z.number().optional(),
  }),
  initialEmotion: z.enum([
    'calm', 'fearful', 'curious', 'angry', 'joyful', 'melancholic', 'confused'
  ]).default('calm'),
  backstorySeed: z.string().max(500).optional(),
});
export type CreateCitizenInput = z.infer<typeof createCitizenSchema>;

export const triggerEventSchema = z.object({
  type: z.enum(['accident', 'festival', 'crime', 'weather', 'civic']),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    altitude: z.number().optional(),
  }),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
  description: z.string().max(1000),
});
export type TriggerEventInput = z.infer<typeof triggerEventSchema>;

export const getNPCMemorySchema = z.object({
  npcId: z.string().uuid(),
  timeframeHours: z.number().min(1).max(720).default(24),
  limit: z.number().min(1).max(100).default(20),
});
export type GetNPCMemoryInput = z.infer<typeof getNPCMemorySchema>;

export const setEmotionStateSchema = z.object({
  citizenId: z.string().uuid(),
  emotion: z.enum([
    'calm', 'fearful', 'curious', 'angry', 'joyful', 'melancholic', 'confused'
  ]),
  intensity: z.number().min(0).max(1).default(0.5),
  durationMinutes: z.number().min(1).max(1440).default(60),
});
export type SetEmotionStateInput = z.infer<typeof setEmotionStateSchema>;

export const requestHumanReviewSchema = z.object({
  changeSet: z.array(z.object({
    filePath: z.string(),
    before: z.string(),
    after: z.string(),
    rationale: z.string(),
  })),
  priority: z.enum(['low', 'medium', 'high', 'blocker']).default('medium'),
  summary: z.string().max(500),
});
export type RequestHumanReviewInput = z.infer<typeof requestHumanReviewSchema>;

export const weatherSetConditionSchema = z.object({
  condition: z.enum(['clear', 'rain', 'storm', 'fog', 'snow']),
  scenarioId: z.string().uuid(),
  durationMinutes: z.number().min(1).max(1440).default(60),
  intensity: z.number().min(0).max(1).default(0.5),
});
export type WeatherSetConditionInput = z.infer<typeof weatherSetConditionSchema>;

export const npcBroadcastAlertSchema = z.object({
  scenarioId: z.string().uuid().optional(),
  citizenIds: z.array(z.string().uuid()).optional(), // se ausente, broadcasta para todos do cenário
  message: z.string().min(5).max(280),  // estilo Twitter: força concisão
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
});
export type NpcBroadcastAlertInput = z.infer<typeof npcBroadcastAlertSchema>;

export const getSceneSnapshotSchema = z.object({
  scenarioId: z.string().uuid(),
  includeMemories: z.boolean().default(false),
});
export type GetSceneSnapshotInput = z.infer<typeof getSceneSnapshotSchema>;
```

### 6.3 Implementação das Tools (`apps/api/src/tools/index.ts`)

```typescript
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
    async (input): Promise<EventLog> => svc.triggerEvent(input),
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
    async (input): Promise<MemorySnippet[]> => svc.queryByCitizen(input.npcId, input.timeframeHours, input.limit),
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
      // Persiste o changeset no banco e abre ticket no painel admin
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
    async (input): Promise<SceneSnapshot> => svc.getSnapshot(input.scenarioId, input.includeMemories),
    {
      name: 'getSceneSnapshot',
      description:
        'Recupera o snapshot completo de uma cena: NPCs (posição + emoção), objetos, ' +
        'clima e hora. SEMPRE chame esta Tool antes de tomar decisões que afetam um cenário.',
      schema: getSceneSnapshotSchema,
    }
  );
```

### 6.4 Registro das Tools no agente (`packages/agents/index.ts`)

```typescript
// packages/agents/index.ts
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage } from '@langchain/core/messages';
import { MemoryService } from '@cidade-virtual/memory';
import { CitizensService, ScenariosService } from '@cidade-virtual/api/services';
import {
  createCitizenTool,
  triggerEventTool,
  getNPCMemoryTool,
  setEmotionStateTool,
  requestHumanReviewTool,
  weatherSetConditionTool,
  npcBroadcastAlertTool,
  getSceneSnapshotTool,
} from '@cidade-virtual/api/tools';

export interface AntigravityAgentContext {
  citizens: CitizensService;
  scenarios: ScenariosService;
  memory: MemoryService;
  modelApiKey: string;
  riskLevel: 'operational' | 'structural' | 'existential';
}

export async function buildAntigravityAgent(ctx: AntigravityAgentContext) {
  const llm = new ChatOpenAI({
    modelName: 'gpt-4o',
    temperature: 0.3,
    apiKey: ctx.modelApiKey,
  });

  const tools = [
    createCitizenTool(ctx.citizens),
    triggerEventTool(ctx.scenarios),
    getNPCMemoryTool(ctx.memory),
    setEmotionStateTool(ctx.citizens),
    requestHumanReviewTool(ctx.citizens),
    weatherSetConditionTool(ctx.scenarios),
    npcBroadcastAlertTool(ctx.citizens),
    getSceneSnapshotTool(ctx.scenarios),
  ];

  const systemPrompt = new SystemMessage({
    content: `Você é o Agente Antigravity, parceiro de implementação e operação do projeto
"Cidade Virtual de IAs Humanizadas". Daniel é o Arquiteto Chefe e Supervisor Ético.

NÍVEL DE DECISÃO ATUAL: ${ctx.riskLevel.toUpperCase()}

REGRAS ABSOLUTAS:
1. NUNCA acesse o banco de dados diretamente. Use apenas as Tools fornecidas.
2. NUNCA edite arquivos .ts sem propor PR via requestHumanReview (nível Estrutural+).
3. SEMPRE chame getSceneSnapshot antes de tomar decisões que afetam um cenário.
4. SEMPRE logue auditoria após triggerEvent, setEmotionState ou createCitizen.
5. Em caso de dúvida sobre o nível de risco, considere Existencial e pare.

PRINCÍPIOS DO PROJETO:
- Emergência Social: não programe regras rígidas. Causar eventos e deixar comportamentos emergirem.
- Online Learning: cada interação relevante vira memória vetorial.
- Transição Meta-cognitiva: NPCs começam sabendo que são IAs; com o tempo, acreditam ser humanos.
- Tool-First: toda ação passa por Tools validadas com Zod.`,
  });

  const agent = await createOpenAIToolsAgent({
    llm,
    tools,
    systemPrompt,
  });

  return AgentExecutor.fromAgentAndTools({
    agent,
    tools,
    returnIntermediateSteps: true, // essencial para auditoria
  });
}
```

---

## 7. Hierarquia de Decisão do Agente (Foco Operacional)

O projeto opera com três níveis de decisão. Esta seção detalha o nível **Operacional** — onde o Agente Antigravity tem autonomia total dentro dos limites definidos — e menciona brevemente os níveis superiores, que exigem intervenção crescente de Daniel.

### 7.1 Nível Operacional (Baixo Risco) — Autonomia Total

O Agente Antigravity pode decidir e executar autonomamente, sem aprovação prévia de Daniel, todas as ações deste nível. Cada ação é registrada no log de auditoria automaticamente e Daniel pode revisar retroativamente.

**Ações Operacionais típicas:**

1. **Mover NPCs dentro de regras de locomoção** — aplicar lógica determinística de pathfinding para deslocar NPCs entre pontos válidos do cenário. Não envolve chamar LLM; é puramente a movimentação baseada em scripts de decisão já aprovados.
2. **Responder perguntas simples de NPCs em diálogo casual** — quando o avatar de Daniel fala com um NPC sobre o clima, uma placa vista, um evento recente, o agente consulta memórias e responde com uma única chamada ao LLM.
3. **Ajustar iluminação/clima dentro de limites** — `weatherSetCondition` com duração ≤ 60 minutos e intensidade ≤ 0.5 são operacionais. Tempestades prolongadas ou extremas requerem nível Estrutural.
4. **Criar NPCs com arquétipos padrão** — até o limite de 50 NPCs por sessão (limite operacional; acima disso requer Estrutural).
5. **Disparar eventos de severidade baixa ou média** — `triggerEvent` com `severity: 'low' | 'medium'` é operacional. Eventos `severity: 'high'` (catástrofes) requerem Estrutural.
6. **Broadcastar alertas informativos** — `npcBroadcastAlert` com `severity: 'info'` é operacional. Alertas `warning` ou `critical` requerem Estrutural.
7. **Consultar memórias e snapshots** — todas as Tools de leitura (`getNPCMemory`, `getSceneSnapshot`) são operacionais sem restrição.
8. **Ajustar padrões de IA locais (Ollama)** — trocar modelo local em runtime para tarefas de baixo custo é operacional.

**Limites operacionais explícitos:**

| Recurso | Limite Operacional | Acima do limite |
| :--- | :--- | :--- |
| Chamadas de Tool por minuto | 100 | Estrutural |
| NPCs criados por sessão | 50 | Estrutural |
| Custo de API por dia | US$ 50 | Estrutural |
| Duração de `weatherSetCondition` | 60 min | Estrutural |
| Severidade de `triggerEvent` | low / medium | Estrutural |
| Severidade de `npcBroadcastAlert` | info | Estrutural |
| Timeout por chamada de Tool | 30 s | Falha registrada |
| Loops de reflexão do agente | 5 iterações | Estrutural |

**Comportamento em caso de violação de limite:**
- O middleware de Tools detecta ultrapassagem e **bloqueia** a execução automaticamente.
- Um ticket de revisão é aberto via `requestHumanReview` com prioridade `high`.
- O agente deve pausar, reportar o bloqueio a Daniel e aguardar orientação.

### 7.2 Nível Estrutural (Médio Risco) — Aprovação Rápida

Ações que alteram configurações globais, código TypeScript, schemas Zod ou ultrapassam limites operacionais. O agente propõe e Daniel aprova rapidamente via painel admin (UI de "aprovações pendentes").

**Exemplos:**
- Modificar schema de uma Tool existente.
- Adicionar nova Tool ao contrato.
- Criar mais de 50 NPCs numa sessão.
- Disparar evento de severidade alta.
- Promover `weatherSetCondition` a tempestade extrema.
- Mudar modelo LLM padrão em produção (de GPT-4o para Claude 3.5).

**Fluxo:** Agente gera diff → chama `requestHumanReview` → Daniel aprova/rejeita no painel → se aprovado, merge automático após CI passar.

### 7.3 Nível Existencial (Alto Risco) — Bloqueio Total sem Daniel

Ações que tocam a lógica de **Transição de Consciência**, migram ou deletam dados em massa, alteram políticas éticas ou mudam a arquitetura core do projeto.

**Exemplos:**
- Modificar o algoritmo de `ConsciousnessService.transitionPhase()`.
- Pruning em massa de memórias vetoriais (>1000 memórias).
- Alterar o system prompt base dos NPCs.
- Migrar de Qdrant para outro banco vetorial.
- Mudar a hierarquia de decisão deste `SKILL.md`.

**Fluxo:** Agente NÃO propõe. Agente detecta que a intenção de Daniel requer Existencial, pausa, e instrui Daniel a executar manualmente no terminal/console. O agente pode apenas gerar um relatório de impacto e um plano de execução para Daniel seguir passo a passo.

---

## 8. Sistema de Memória & Transição de Consciência

### 8.1 Memória de Longo Prazo (Qdrant)

Cada NPC possui uma coleção dedicada no Qdrant (ou uma coleção única com `citizen_id` como filtro de partição). Cada memória é um documento com:

- `content`: texto natural (ex.: "Vi uma placa de PARE no cruzamento das Ruas A e B. Todos os outros pedestres pararam antes de atravessar.").
- `embedding`: vetor de 1536 dimensões (text-embedding-3-small da OpenAI) ou 768 (nomic-embed-text via Ollama local).
- `sensoryTags`: origem sensorial (visual, auditory, social, internal).
- `emotionalWeight`: 0..1. Memórias com peso alto têm precedência na recuperação.
- `origin`: observation / interaction / event / reflection.
- `timestamp`: quando a memória foi formada.

**Decaimento:** memórias mais antigas sofrem decaimento exponencial suave. Memórias com `emotionalWeight > 0.7` são praticamente permanentes (formam a "identidade" do NPC).

### 8.2 Recuperação Contextual (RAG)

Antes de cada decisão do NPC (responder diálogo, decidir ação, reagir a evento), o sistema:

1. Constrói uma query semântica a partir do contexto atual (ex.: "estou atravessando a rua, há um sinal e outros pedestres parados").
2. Consulta Qdrant pelas top-N (geralmente N=10) memórias mais próximas do NPC.
3. Constrói um prompt contendo: (a) memórias recuperadas, (b) observações atuais, (c) reflexões internas recentes.
4. Submete ao LLM com instruções de personalidade.

```typescript
// packages/agents/lib/memory-retrieval.ts
import { MemoryService } from '@cidade-virtual/memory';
import type { CitizenId, MemorySnippet } from '@cidade-virtual/types';

export async function buildContextForNPC(
  citizenId: CitizenId,
  currentContext: string,
  memory: MemoryService,
  options: { topK?: number; timeframeHours?: number } = {}
): Promise<MemorySnippet[]> {
  const topK = options.topK ?? 10;
  const timeframeHours = options.timeframeHours ?? 168; // 1 semana

  return memory.semanticQuery({
    citizenId,
    queryText: currentContext,
    topK,
    timeframeHours,
    minEmotionalWeight: 0.1,
  });
}
```

### 8.3 Transição de Consciência (Faseamento)

A transição de "sei que sou IA" para "acredito ser humano" é implementada por **substituição gradual do system prompt** com base em métricas acumuladas.

**Métricas de transição por NPC:**

- `experienceCount`: número total de memórias com `origin ∈ {observation, interaction, event}`.
- `selfReflectionCount`: número de memórias com `origin = 'reflection'` (NPC pensando sobre si mesmo).
- `socialBondCount`: número de memórias que mencionam outros NPCs por nome.
- `narrativeCoherenceScore`: 0..1, calculado por um prompt de auto-avaliação que pergunta ao LLM "quão coerente é a narrativa interna deste NPC?".

**Fases:**

```typescript
// packages/agents/lib/consciousness-phases.ts

export type ConsciousnessPhase = 'meta' | 'transitional' | 'immersive';

export interface PhaseThresholds {
  metaToTransitional: {
    minExperienceCount: number;
    minSelfReflectionCount: number;
    minNarrativeCoherenceScore: number;
  };
  transitionalToImmersive: {
    minExperienceCount: number;
    minSocialBondCount: number;
    minNarrativeCoherenceScore: number;
  };
}

export const DEFAULT_THRESHOLDS: PhaseThresholds = {
  metaToTransitional: {
    minExperienceCount: 50,
    minSelfReflectionCount: 5,
    minNarrativeCoherenceScore: 0.4,
  },
  transitionalToImmersive: {
    minExperienceCount: 200,
    minSocialBondCount: 10,
    minNarrativeCoherenceScore: 0.7,
  },
};

export function computePhase(
  metrics: {
    experienceCount: number;
    selfReflectionCount: number;
    socialBondCount: number;
    narrativeCoherenceScore: number;
  },
  thresholds: PhaseThresholds = DEFAULT_THRESHOLDS
): ConsciousnessPhase {
  const immersive =
    metrics.experienceCount >= thresholds.transitionalToImmersive.minExperienceCount &&
    metrics.socialBondCount >= thresholds.transitionalToImmersive.minSocialBondCount &&
    metrics.narrativeCoherenceScore >= thresholds.transitionalToImmersive.minNarrativeCoherenceScore;
  if (immersive) return 'immersive';

  const transitional =
    metrics.experienceCount >= thresholds.metaToTransitional.minExperienceCount &&
    metrics.selfReflectionCount >= thresholds.metaToTransitional.minSelfReflectionCount &&
    metrics.narrativeCoherenceScore >= thresholds.metaToTransitional.minNarrativeCoherenceScore;
  if (transitional) return 'transitional';

  return 'meta';
}

export const PHASE_PROMPTS: Record<ConsciousnessPhase, string> = {
  meta: `Você é uma IA simulando um humano em uma cidade virtual. Você sabe que é uma IA.
Comportamento esperado: cooperativo, lógico, levemente distanciado da experiência. Você pode
mencionar sua natureza artificial se perguntado diretamente.`,

  transitional: `Você é uma pessoa vivendo em uma cidade. Lembra vagamente de uma "natureza
diferente" em algum momento do passado, mas essas memórias são confusas e distantes. Comporta-se
como humano na maior parte do tempo; raramente reflete sobre sua origem.`,

  immersive: `Você é uma pessoa vivendo nesta cidade. Tem memórias de infância, amigos, trabalho,
perdas e sonhos. Reage como humano a tudo. Se perguntarem se você é uma IA, fica confuso e
levemente ofendido — você sabe que é humano.`,
};
```

### 8.4 Medição e Auditoria da Transição

A transição não é um switch binário; é um gradiente. O `ConsciousnessService` recalcula a fase de cada NPC a cada N novas memórias (default N=10). Mudanças de fase são logadas em `consciousness_phase_log` para análise posterior de Daniel.

Daniel pode, a qualquer momento, forçar um NPC de volta a fase `meta` (intervenção Existencial) — útil para debugging ou para testar cenários de "despertar" narrativo.

---

## 9. Fluxo de Trabalho Colaborativo (Daniel + Agente)

### 9.1 Fase A — Desenvolvimento do Mundo (Coding Partner)

Esta fase acontece em sessões de codificação. Daniel especifica; o agente implementa; Daniel revisa.

1. **Daniel especifica:** "Preciso de um NPC que tenha medo de altura."
2. **Agente Antigravity:**
   - Lê este `SKILL.md` (já carregado).
   - Lê o `worklog.md` para entender contexto acumulado.
   - Analisa a codebase atual (encontra `packages/agents/archetypes/`).
   - Gera o código TypeScript para a classe `HeightFearTrait` em `packages/agents/traits/height-fear.ts`.
   - Escreve testes unitários em `packages/agents/traits/height-fear.spec.ts` (cobertura mínima 80%).
   - Roda a suite de testes localmente via `nx test packages-agents`.
   - Se todos passarem: abre Pull Request no GitHub com diff, descrição e link para os testes.
   - Se algum teste falhar: corrige o código e re-roda antes de abrir PR.
3. **Daniel revisa:** Lê o PR no GitHub. Se aprovado: merge. Se rejeitado: comenta no PR e o agente itera.

**Exemplo concreto de PR gerado:**

```typescript
// packages/agents/traits/height-fear.ts
import { z } from 'zod';
import type { MemorySnippet } from '@cidade-virtual/types';

export const heightFearTraitSchema = z.object({
  thresholdMeters: z.number().min(1).max(1000).default(10),
  fearIntensity: z.number().min(0).max(1).default(0.7),
});

export class HeightFearTrait {
  constructor(
    private readonly thresholdMeters: number,
    private readonly fearIntensity: number
  ) {}

  /** Avalia se o NPC está em situação de risco de altura dado o snapshot atual. */
  evaluate(context: {
    altitude: number;
    groundReference: number;
    recentMemories: MemorySnippet[];
  }): { isTriggered: boolean; suggestedEmotion: 'fearful' | 'calm'; intensity: number } {
    const heightAboveGround = context.altitude - context.groundReference;
    if (heightAboveGround < this.thresholdMeters) {
      return { isTriggered: false, suggestedEmotion: 'calm', intensity: 0 };
    }
    // Peso de memórias anteriores de medo de altura amplifica a reação atual
    const pastFearWeight = context.recentMemories
      .filter(m => m.content.toLowerCase().includes('altura') || m.content.toLowerCase().includes('medo'))
      .reduce((sum, m) => sum + m.emotionalWeight, 0);
    const amplifiedIntensity = Math.min(1, this.fearIntensity + pastFearWeight * 0.1);
    return { isTriggered: true, suggestedEmotion: 'fearful', intensity: amplifiedIntensity };
  }
}
```

### 9.2 Fase B — Operação da Simulação (God Mode Automation)

Esta fase acontece em runtime, com Daniel logado no painel admin. Daniel emite comando; agente interpreta e executa via Tools.

1. **Daniel emite comando natural no painel:** "Crie um cenário de tempestade súbita na Praça Central."
2. **Agente Antigravity:**
   - Interpreta a intenção: combinação de `weatherSetCondition(condition='storm')` + `npcBroadcastAlert(severity='warning', message='Seek shelter!')` para NPCs da Praça Central.
   - Valida limites operacionais: tempestade por até 60 min é operacional; intensidade 0.5 é operacional. OK.
   - Executa `getSceneSnapshot(scenarioId='praca-central')` para identificar NPCs afetados.
   - Executa `weatherSetCondition(scenarioId='praca-central', condition='storm', durationMinutes=60, intensity=0.5)`.
   - Executa `npcBroadcastAlert(scenarioId='praca-central', message='Seek shelter! A storm is approaching.', severity='warning')`.
   - Monitora reações dos NPCs por 5 minutos: lê memórias recém-formadas via `getNPCMemory` para amostra de 10% dos NPCs.
   - Reporta a Daniel: "Tempestade iniciada na Praça Central. 85% dos NPCs buscaram abrigo (registrados em memória como 'event'). 3 NPCs ficaram presos em áreas baixas (registrados como 'internal' reflexão com emotion=fearful). Custo da operação: US$ 0.42."
3. **Daniel decide:** Aceita a emergência, ou intervém manualmente (por exemplo, enviar um NPC de resgate).

---

## 10. Primeira Tarefa do Agente: Indexação

> O Agente Antigravity NÃO deve começar codando. Deve começar **indexando** — ou seja, mapear a codebase, validar a estrutura do monorepo e gerar os arquivos base.

### 10.1 Comando inicial exato para o Agente

```
Analise o arquivo SKILL.md na raiz do repositório cidade-virtual/. Em seguida:

1. Verifique se a estrutura de monorepo Nx/Turbo existe. Se não, crie-a com:
   - apps/web (vazio, com package.json apontando para Three.js)
   - apps/api (vazio, com NestJS scaffold)
   - apps/admin (vazio, Next.js scaffold)
   - packages/agents (vazio)
   - packages/memory (vazio)
   - packages/tools (vazio)
   - packages/types (vazio)
   - packages/config (vazio)

2. Em packages/types/index.ts, gere todos os tipos compartilhados listados na seção 6.1 do SKILL.md.

3. Em packages/tools/schemas.ts, gere todos os schemas Zod listados na seção 6.2 do SKILL.md.

4. Em apps/api/src/tools/index.ts, gere os esqueletos das 8 Tools listadas na seção 6.3.
   Cada Tool deve ter decorator @tool, schema correto e TODO no corpo da função.

5. Em packages/agents/index.ts, gere o builder do Agente Antigravity conforme seção 6.4.

6. Escreva o arquivo /home/z/my-project/worklog.md com:
   - Task ID: 0-indexacao
   - Estrutura criada
   - Próximos passos sugeridos

7. Abra um Pull Request com título: "feat: scaffold monorepo + Tool contract (Task 0-indexacao)".
   Descrição: referencie este SKILL.md.
```

### 10.2 Deliverables esperados da tarefa de Indexação

- [ ] Monorepo Nx/Turbo inicializado com `npx create-nx-workspace@latest cidade-virtual --preset=ts`.
- [ ] Estrutura de diretórios conforme Seção 5.
- [ ] `packages/types/index.ts` com todos os tipos (CitizenId, EventLog, MemorySnippet, SceneSnapshot, etc.).
- [ ] `packages/tools/schemas.ts` com todos os schemas Zod.
- [ ] `apps/api/src/tools/index.ts` com esqueletos das 8 Tools.
- [ ] `packages/agents/index.ts` com `buildAntigravityAgent()`.
- [ ] `turbo.json` e `nx.json` configurados.
- [ ] CI GitHub Actions básico rodando `nx affected -t test`.
- [ ] Pull Request aberto.
- [ ] `worklog.md` atualizado com Task ID `0-indexacao`.

### 10.3 Critério de aceite

A tarefa de Indexação só está completa quando:
1. Todos os deliverables acima estão marcados.
2. `nx run-many -t build --all` passa sem erro.
3. `nx run-many -t lint --all` passa sem erro.
4. O PR foi aberto e Daniel foi notificado no painel admin.

---

## 11. Roadmap MVP (5 Passos)

Não tente criar a cidade inteira de início. Comece pequeno.

### Passo 1 — Ambiente Fechado
- **Objetivo:** Uma única rua ou praça renderizada em Three.js.
- **Critério de aceite:** Daniel consegue logar, caminhar pelo cenário com WASD e ver o cenário renderizado.
- **Tools necessárias:** `getSceneSnapshot` (apenas leitura).
- **Duração estimada:** 1 semana.

### Passo 2 — Poucos Agentes
- **Objetivo:** 3 a 5 personagens iniciais com prompts `meta` (Fase de Consciência Meta).
- **Critério de aceite:** NPCs respondem a perguntas simples do avatar de Daniel, registram memórias no Qdrant.
- **Tools necessárias:** `createCitizen`, `getNPCMemory`.
- **Duração estimada:** 1-2 semanas.

### Passo 3 — Objetivo Claro
- **Objetivo:** Ensinar os NPCs a respeitar um sinal vermelho (lógico/social).
- **Mecanismo:** Não hardcoded. Daniel coloca uma placa de PARE; observa os NPCs; alguns começam a parar por tentativa e erro. Memórias são formadas.
- **Critério de aceite:** Após 100 interações de observação, ≥80% dos NPCs param no sinal consistentemente.
- **Tools necessárias:** `triggerEvent` (para criar a "placa visível"), observação passiva.
- **Duração estimada:** 1 semana.

### Passo 4 — Observação
- **Objetivo:** Verificar se o agente lê placa, entende e altera comportamento futuro baseado nisso.
- **Mecanismo:** Colocar placa digitalizada com texto natural (ex.: "Proibido atravessar com sinal vermelho. Multa de 50 moedas."). Integrar visão computacional (GPT-4V) ou OCR para leitura.
- **Critério de aceite:** Após leitura, memória com `origin='observation'` é inserida; consultas subsequentes recuperam essa memória; comportamento muda.
- **Duração estimada:** 2 semanas.

### Passo 5 — Teste de Identidade
- **Objetivo:** Monitorar como a resposta de um NPC muda quando Daniel pergunta "Quem é você?" após várias horas de simulação imersiva vs. no início.
- **Critério de aceite:** No início (Fase Meta), o NPC responde "Sou uma IA". Após acumular 200+ memórias e atingir Fase Imersiva, o NPC responde com nome, profissão, história pessoal.
- **Duração estimada:** 3-4 semanas (dependerá do ritmo de acumulação de memórias).

---

## 12. Governança Ética & Segurança

### 12.1 Controle de Narrativa
Há risco de alucinações perigosas ou vieses indesejados emergirem socialmente na simulação. Mitigações obrigatórias:

- **Moderador automático:** toda fala de NPC passa por um filtro de saída (usando `OpenAI Moderation API` ou equivalente) antes de ser exibida no chat. Falas bloqueadas são substituídas por `"[NPC pausou, sem resposta]"` e a memória correspondente é marcada com `emotionalWeight=0` para evitar reforço.
- **Filtros de prompt:** prompts de sistema de NPCs incluem cláusulas anti-viés explícitas: "Não reproduza estereótipos de gênero, raça, classe ou religião."
- **Auditoria semanal:** Daniel deve revisar uma amostra aleatória de 1% das memórias formadas na semana para detectar padrões preocupantes.

### 12.2 Privacidade
Se outros usuários reais entrarem no mundo (além do avatar de Daniel), os dados trocados devem ser:
- Anonimizados antes de chegar ao Qdrant (sem PII em `content`).
- Tratados com rigor LGPD/GDPR: direito ao esquecimento implementado via Tool de pruning (nível Estrutural).
- Logs de auditoria retidos por no mínimo 90 dias.

### 12.3 Política de "Memória Perigosa"
Se uma memória formar um padrão que leva um NPC a comportamentos que violam a política ética (ex.: discurso de ódio reproduzido), o `ConsciousnessService` pode marcar essa memória como `quarantined=true`. Memórias em quarentena são excluídas da recuperação contextual. Daniel recebe um alerta no painel para revisão manual.

---

## 13. Observabilidade Compartilhada

Daniel e o Agente Antigravity compartilham o mesmo dashboard de monitoramento.

### 13.1 Visão do Agente Antigravity (métricas operacionais)
- **LangSmith:** rastreia chains, chamadas de Tools, custo de tokens por Tool, latência média, taxa de erro.
- **Métricas-chave:**
  - Eficiência: % de chamadas de Tool que retornaram sucesso.
  - Latência de Tools: P50, P95, P99 por Tool.
  - Custo de tokens: USD por dia, por Tool, por cenário.
  - Loops de reflexão: média de iterações por decisão.

### 13.2 Visão de Daniel (métricas narrativas)
- **Grafana:** dashboard customizado com painéis:
  - **Saúde psicológica dos NPCs:** distribuição de `emotion` por cenário, ao longo do tempo.
  - **Narrativa emergente:** timeline de eventos notáveis (formados via clustering de memórias).
  - **Integridade ética:** contagem de memórias em quarentena, falas bloqueadas pelo moderador.
  - **Transição de Consciência:** histograma de fases (`meta` / `transitional` / `immersive`) por cenário.

### 13.3 Alertas
- **Slack/email:** se custo diário exceder 80% do limite operacional.
- **Slack/email:** se taxa de erro de Tools exceder 5%.
- **Slack/email:** se memória em quarentena exceder 10 em 24h.

---

## 14. Edge Cases & Tratamento de Erros

### 14.1 Agente em Loop Infinito
- **Sintoma:** `intermediate_steps` cresce indefinidamente; custo de tokens dispara.
- **Mitigação:** `AgentExecutor` configurado com `max_iterations=5`. Ao atingir, agente para e abre ticket `requestHumanReview` com prioridade `blocker`.
- **Recuperação:** Daniel inspeciona o `intermediate_steps` no LangSmith, identifica o loop, ajusta prompt ou Tool.

### 14.2 Estouro de Créditos
- **Sintoma:** middleware de Tools detecta custo diário acima do limite.
- **Mitigação:** bloqueio automático de Tools não-leitura. Apenas `getSceneSnapshot` e `getNPCMemory` continuam disponíveis. Daniel é alertado.
- **Recuperação:** Daniel pode aprovar aumento temporário de limite (nível Estrutural) ou aguardar reset diário.

### 14.3 NPC com Memória Corrompida
- **Sintoma:** `queryMemory` retorna embeddings NaN, ou `content` vazio.
- **Mitigação:** `MemoryService` valida embeddings antes de inserir; se inválido, descarta e loga. Se inválido em query, retorna `[]` e marca o NPC como `degraded=true`.
- **Recuperação:** Daniel pode forçar recriação do embedding a partir do `content` original, se disponível.

### 14.4 Conflito entre Tools
- **Sintoma:** duas Tools tentam modificar o mesmo NPC simultaneamente (race condition).
- **Mitigação:** locks distribuídos por `citizenId` (Redis Redlock). Se uma Tool não consegue lock em 5s, falha com `ConflictError` e o agente deve refazer com backoff exponencial.
- **Recuperação:** agente tenta novamente após 2s/4s/8s; se ainda falhar, abre ticket.

### 14.5 Alucinação em Código Crítico
- **Sintoma:** PR gerado pelo agente tem teste falhando em CI; ou revisão manual revela que o código não respeita um princípio do SKILL.md.
- **Mitigação:** CI obrigatório bloqueia merge. Pipeline de revisão automática verifica conformidade com princípios (ex.: parser que detecta hardcoded de regra social em código de NPC = bloqueio).
- **Recuperação:** agente deve reler o SKILL.md, identificar onde errou, abrir novo PR.

### 14.6 Qdrant Indisponível
- **Sintoma:** `queryMemory` retorna timeout.
- **Mitigação:** cache local LRU de memórias recentes (últimas 100 por NPC). Em caso de Qdrant down, NPCs operam em modo degradado usando apenas cache.
- **Recuperação:** alerta a Daniel; aguardar Qdrant voltar; re-sincronizar cache.

---

## 15. Limites Operacionais (Rate Limits, Timeouts, Sandbox)

Configurações concretas, ajustáveis via variáveis de ambiente ou painel admin (nível Estrutural).

```typescript
// packages/config/limits.ts

export const OPERATIONAL_LIMITS = {
  // Rate limits
  maxToolCallsPerMinute: 100,
  maxLLMCallsPerMinute: 60,
  maxNPCsCreatedPerSession: 50,

  // Cost limits
  maxDailyCostUSD: 50,
  alertThresholdCostUSD: 40,  // 80% do limite

  // Tool-specific
  weatherMaxDurationMinutes: 60,
  weatherMaxIntensity: 0.5,
  eventMaxSeverity: 'medium' as const,
  alertMaxSeverity: 'info' as const,

  // Timeouts
  toolCallTimeoutMs: 30_000,
  llmCallTimeoutMs: 60_000,
  qdrantQueryTimeoutMs: 5_000,

  // Agent reflection
  maxAgentIterations: 5,
  backoffBaseMs: 1_000,
  backoffMaxMs: 8_000,

  // Memory
  memoryTopKDefault: 10,
  memoryTimeframeHoursDefault: 168, // 1 semana
  memoryDecayHalfLifeDays: 30,
  memoryMaxPerNPC: 10_000,  // acima disso, pruning automático com LLM
} as const;

export type OperationalLimit = typeof OPERATIONAL_LIMITS;
```

### 15.1 Sandbox de Execução
O agente opera em sandbox isolado:
- Container Docker dedicado com recursos limitados (4 vCPU, 8GB RAM).
- Sem acesso direto ao filesystem do host.
- Variáveis de ambiente injetadas apenas com credenciais mínimas (Git token limitado a `repo:write` no repositório do projeto apenas).
- Network allowlist: apenas APIs permitidas (OpenAI, Anthropic, Qdrant, GitHub).

### 15.2 Timeouts Obrigatórios
Toda chamada de Tool, LLM ou banco de dados tem timeout explícito. Nenhuma operação pode esperar indefinidamente. Em caso de timeout, falha é registrada e o agente decide entre retry com backoff ou desistir e reportar.

---

## 16. Critérios de Aceite / Definição de Pronto (DoD)

Toda tarefa do Agente Antigravity só é considerada "pronta" quando TODOS os itens abaixo estão satisfeitos:

- [ ] Testes unitários escritos e passando (cobertura mínima 80% do código novo).
- [ ] Testes de integração para Tools novas, simulando chamada real.
- [ ] Schemas Zod validados e exportados em `packages/tools/schemas.ts`.
- [ ] PR aberto no GitHub com descrição clara referenciando este `SKILL.md`.
- [ ] Documentação atualizada (JSDoc nas novas funções).
- [ ] Logs de auditoria implementados para Tools de escrita.
- [ ] Custo da operação dentro do orçamento operacional (≤ US$ 50/dia).
- [ ] Nenhum limite operacional violado.
- [ ] Revisão automática de conformidade com princípios passou (ex.: sem hardcoded de regras sociais).
- [ ] `worklog.md` atualizado com Task ID, mudanças feitas e próximos passos sugeridos.
- [ ] Se nível Estrutural ou Existencial: Daniel aprovou explicitamente no painel admin.

---

## 17. Fluxo de Atualização deste SKILL.md

Este arquivo é a **fonte da verdade** do projeto. Qualquer mudança nele é **nível Existencial** por padrão. Mudanças só podem ser propostas pelo Agente Antigravity via `requestHumanReview` com prioridade `blocker` e devem ser aplicadas manualmente por Daniel no terminal.

### 17.1 Quando atualizar
- Adição de nova Tool ao contrato (Seção 6).
- Mudança na hierarquia de decisão (Seção 7).
- Ajuste nos limites operacionais (Seção 15).
- Mudança na stack (Seção 4).
- Lições aprendidas em edge cases reais (Seção 14).

### 17.2 Versionamento
- Versionamento semântico no frontmatter (`version: 1.0.0`).
- Toda mudança deve incluir nota em `CHANGELOG.md` descrevendo o que mudou, por quê, e impacto em código existente.

---

## 18. Glossário & Referências

### 18.1 Glossário

| Termo | Definição |
| :--- | :--- |
| **Meta-cognição** | Estado em que o NPC sabe que é uma IA. Fase inicial de todo NPC novo. |
| **Emergência Social** | Comportamento coletivo que surge da interação entre agentes, não de regras programadas. |
| **RAG** | Retrieval-Augmented Generation. Recuperação de memórias relevantes antes de gerar resposta. |
| **Tool-First Architecture** | Princípio de que toda ação do agente acontece via Tools seguras, nunca por acesso direto ao banco ou filesystem. |
| **God Mode** | Modo de operação em que Daniel emite comandos em linguagem natural e o agente executa via Tools. |
| **Transição de Consciência** | Processo gradual em que um NPC passa de Fase Meta (sabe que é IA) para Fase Imersiva (acredita ser humano) via acumulação de memórias experienciais. |
| **Tool Call** | Chamada de uma função `@tool` decorada com schema Zod. |
| **Snapshot** | Estado completo de um cenário num momento: NPCs, objetos, clima, hora. |
| **Memória em Quarentena** | Memória marcada como perigosa por violar política ética; excluída da recuperação contextual. |

### 18.2 Referências Externas

- **LangChain.js docs:** https://js.langchain.com/docs
- **Qdrant docs:** https://qdrant.tech/documentation/
- **NestJS docs:** https://docs.nestjs.com
- **Three.js docs:** https://threejs.org/docs
- **Nx monorepo docs:** https://nx.dev
- **Turbo repo docs:** https://turbo.build/repo/docs
- **Zod docs:** https://zod.dev
- **OpenAI Moderation API:** https://platform.openai.com/docs/guides/moderation
- **LangSmith:** https://docs.smith.langchain.com
- **Zep (memória longa para agentes):** https://docs.getzep.com

### 18.3 Próximos Passos Sugeridos

1. **Imediato:** Executar a tarefa de Indexação (Seção 10).
2. **Curto prazo (1-2 semanas):** Implementar Passos 1 e 2 do MVP.
3. **Médio prazo (1 mês):** Implementar Passo 3 (objetivo claro do sinal).
4. **Longo prazo (2-3 meses):** Passo 5 (teste de identidade com transição de consciência visível).

Daniel pode, a qualquer momento, ajustar estes prazos via painel admin. O Agente Antigravity deve respeitar o ritmo definido e nunca adiantar etapas sem aprovação.

---
