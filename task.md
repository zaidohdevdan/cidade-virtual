# TASK.md — Synapse City Engine

> Backlog de implementação derivado da análise arquitetural de `zaidohdevdan/cidade-virtual` (v2.0.0, branch `main`).
> Convenção: cada tarefa tem ID, prioridade, esforço estimado, dependências e critérios de aceite verificáveis.

---

## Legenda

| Campo | Valores |
|---|---|
| **Prioridade** | 🔴 Crítica · 🟠 Alta · 🟡 Média · 🟢 Baixa |
| **Esforço** | XS (≤4h) · S (1-2 dias) · M (3-5 dias) · L (1-2 semanas) |
| **Tipo** | `bug` · `feat` · `refactor` · `chore` · `docs` · `test` |
| **Risco** | Operacional · Estrutural · Existencial |

---

## Épico 1 — Memória & Cognição (Desbloqueia o coração do projeto)

### Task-001 — Implementar `MemoryService` sobre Qdrant
- **Prioridade:** 🔴 Crítica
- **Esforço:** M
- **Tipo:** `feat`
- **Risco:** Estrutural
- **Dependências:** Qdrant container já provisionado (`docker-compose.yml`)
- **Descrição:** Substituir os 4 stubs em `packages/memory/index.ts` por integração real com Qdrant v1.12.1.
- **Escopo:**
  - `addMemory(memory: MemorySnippet)` — gerar embedding (via `llm-adapters` ou modelo local), criar collection `memories` no Qdrant com payload `{ citizenId, content, timestamp, emotionalWeight, memoryType, sourceType }`.
  - `semanticQuery(options)` — buscar top-K por similaridade coseno, respeitando `timeframeHours` e `minEmotionalWeight`.
  - `queryByCitizen(npcId, timeframeHours, limit)` — filtro por payload + ordenação temporal.
  - `pruneMemory(citizenId)` — decaimento exponencial conforme `OPERATIONAL_LIMITS.memoryDecayHalfLifeDays = 30`.
- **Critérios de aceite:**
  - [ ] Teste de integração em `tests/integration/memory.test.ts` cria, consulta semanticamente e poda memórias.
  - [ ] `qdrantQueryTimeoutMs: 5_000` respeitado (timeout configurado).
  - [ ] Embeddings persistidos com dimensionalidade consistente (e.g. 1536 com `text-embedding-3-small` ou modelo local equivalente).
  - [ ] Índice HNSW configurado na collection.

### Task-002 — Conectar `CitizensService` ao `AgentIdentityRepository`
- **Prioridade:** 🔴 Crítica
- **Esforço:** S
- **Tipo:** `feat`
- **Risco:** Operacional
- **Dependências:** Nenhuma (repositório já existe e está registrado)
- **Descrição:** Substituir os 4 stubs em `apps/api/src/modules/citizens/citizens.service.ts` por chamadas de persistência reais.
- **Escopo:**
  - `create(input)` — gerar UUID v4 real, chamar `agentRepo.upsert(...)`, retornar `{ id, name, archetype }`.
  - `setEmotion(citizenId, emotion, intensity, durationMinutes)` — chamar `agentRepo.updateEmotion(...)` + log de auditoria via `CognitiveAuditLogger`.
  - `requestReview(input)` — persistir ticket em nova tabela `human_review_tickets` (migrar Drizzle) com status `pending`.
  - `broadcastAlert(input)` — injetar `WorldGateway` e emitir `world:event` com payload `{ name: 'npc.alert', payload: input }`; registrar entregas em `agent_experiences` com `sourceType: 'environment'`.
- **Critérios de aceite:**
  - [ ] Nenhum UUID hardcoded permanece no código.
  - [ ] Habitante criado sobrevive a restart da API (validar via teste de integração).
  - [ ] `setEmotion` com `riskLevel: structural` loga entrada `AUDIT` no `CognitiveAuditLogger`.

### Task-003 — Integrar `WorldGateway` em `WorldService`
- **Prioridade:** 🟠 Alta
- **Esforço:** XS
- **Tipo:** `feat`
- **Risco:** Operacional
- **Dependências:** Nenhuma
- **Descrição:** `WorldService` já tem os métodos mas não emite eventos para o frontend. Injetar `WorldGateway` e disparar broadcasts.
- **Escopo:**
  - `setWeather(...)` — após `worldStateRepo.updateEnvironment(...)`, chamar `gateway.broadcastWorldState(await this.getWorldState())` e `gateway.broadcastDomainEvent({ name: 'world.weather.changed', payload })`.
  - `triggerEvent(...)` — emitir `world:event` com o payload do `EventLog`.
  - `incrementTick(...)` — opcionalmente emitir `world:tick` (throttled para não flooding).
- **Critérios de aceite:**
  - [ ] HUD do `web-client` atualiza semáforo e clima em tempo real sem refresh.
  - [ ] Log `AUDIT` de cada broadcast emitido.

### Task-004 — Conectar `CognitionService` ao `CognitiveCycleManager`
- **Prioridade:** 🟠 Alta
- **Esforço:** S
- **Tipo:** `feat`
- **Risco:** Estrutural
- **Dependências:** Task-001 (memória), Task-002 (citizens)
- **Descrição:** O `CognitionService.processCycle` gera sempre a mesma ação heurística. Substituir pela chamada real ao `CognitiveCycleManager.evaluateAction()` do package `agent-cognition`.
- **Escopo:**
  - Construir `CognitiveContext` a partir de `nearbyObjects` + observação.
  - Passar `MemoryService` como fonte de recuperação semântica.
  - Decidir política para `requiresLLM`: se `confidence < 0.7`, chamar `llmAdapter.complete()` (cujo provider é configurável via `LLMProviderAdapter`).
  - Persistir a ação escolhida em `agent_experiences` com `sourceType: 'action_result'`.
- **Critérios de aceite:**
  - [ ] Ações rotineiras não chamam LLM (validar via `metrics.increment('llm.calls')`).
  - [ ] Ações deliberadas registram prompt + resposta no log de auditoria.

---

## Épico 2 — Workers & Mensageria

### Task-005 — Adicionar BullMQ sobre Redis
- **Prioridade:** 🟠 Alta
- **Esforço:** M
- **Tipo:** `feat`
- **Risco:** Estrutural
- **Dependências:** Nenhuma (Redis já provisionado)
- **Descrição:** Os 3 workers (`simulation`, `cognition`, `learning`) estão esqueletais sem fila. Implementar mensageria via BullMQ.
- **Escopo:**
  - Instalar `bullmq` e `ioredis` no root `package.json`.
  - Criar `packages/event-system/queues.ts` com 3 filas: `simulation:queue`, `cognition:queue`, `learning:queue`.
  - API publica jobs (e.g. `triggerEvent` → job `cognition:evaluate-scenario`).
  - Cada worker consome sua fila com concorrência configurável (default: 5).
  - Dead letter queue + retries exponenciais (`backoffBaseMs: 1_000`, `backoffMaxMs: 8_000`).
- **Critérios de aceite:**
  - [ ] Job de cognition falho vai para DLQ após `maxAgentIterations: 5` tentativas.
  - [ ] Métrica `queue.wait.time.ms` exposta no `MetricsCollector`.

### Task-006 — Implementar `cognition-worker`
- **Prioridade:** 🟠 Alta
- **Esforço:** S
- **Tipo:** `feat`
- **Risco:** Operacional
- **Dependências:** Task-005, Task-004
- **Descrição:** Worker consome `cognition:queue` e processa ciclos cognitivos em background.
- **Escopo:**
  - Para cada job: instanciar `CognitiveContext`, chamar `CognitionService.processCycle`, persistir ação resultante.
  - Respeitar `maxLLMCallsPerMinute: 60` com rate limiter local.
  - Logging estruturado via `defaultLogger` + `cognitiveAudit`.
- **Critérios de aceite:**
  - [ ] Worker sobrevive a 100 jobs/min sem leak de memória.
  - [ ] Latência p95 de um ciclo cognitivo < 2s quando não usa LLM.

### Task-007 — Implementar `simulation-worker`
- **Prioridade:** 🟡 Média
- **Esforço:** S
- **Tipo:** `feat`
- **Risco:** Operacional
- **Dependências:** Task-005
- **Descrição:** Loop determinístico de Classe A — física, colisões, validação de movimentos.
- **Escopo:**
  - Tick rate fixo (e.g. 20 Hz) — atualizar `world_state.tick_count`.
  - Receber posições de avatares via `avatar:position` (gateway) e validar contra colliders.
  - Rejeitar movimentos inválidos com `EventBus.publish({ name: 'agent.action.rejected', ... })`.
- **Critérios de aceite:**
  - [ ] Player não consegue atravessar parede mesmo enviando posição forjada via socket.
  - [ ] Latência tick < 50ms.

### Task-008 — Implementar `learning-worker`
- **Prioridade:** 🟡 Média
- **Esforço:** M
- **Tipo:** `feat`
- **Risco:** Estrutural
- **Dependências:** Task-001, Task-005
- **Descrição:** Classe D — consolidação passiva noturna. Roda job recorrente (cron) que varre `agent_experiences` recentes e chama `MemoryConsolidationWorker.consolidateExperiences(...)`.
- **Escopo:**
  - Implementar `consolidateExperiences` em `packages/learning-system` (atualmente stub): agrupar experiências por agente + janela temporal, sumarizar via LLM, criar `MemorySnippet` consolidado (memoryType: `semantic`), podar os episódios originais.
  - Cron diário (e.g. 03:00 BRT) + job manual via API.
  - Respeitar `memoryMaxPerNPC: 10_000` — acima disso, LLM-based pruning.
- **Critérios de aceite:**
  - [ ] Após consolidação, count de `agent_experiences` por NPC diminui; count de memórias semânticas aumenta.
  - [ ] Audit log mostra cada consolidação com `consolidatedCount`.

---

## Épico 3 — Bugs & Divergências

### Task-009 — Sincronizar schema Drizzle ↔ `init.sql`
- **Prioridade:** 🟡 Média
- **Esforço:** XS
- **Tipo:** `bug`
- **Risco:** Operacional
- **Descrição:** `infrastructure/database/init.sql` define `related_entity_ids TEXT[]` em `agent_experiences`, mas `packages/persistence/src/schema.ts` não tem a coluna. Decidir lado e alinhar.
- **Ação recomendada:** adicionar coluna ao schema Drizzle (mais alinhado ao tipo `AgentExperience.relatedEntityIds` em `packages/types`).
- **Critérios de aceite:**
  - [ ] `drizzle-kit generate` produz migration consistente com `init.sql`.
  - [ ] Teste `tests/integration/persistence.test.ts` insere experiência com `relatedEntityIds` e recupera.

### Task-010 — Corrigir `timeOfDay` hardcoded em `WorldService.setWeather`
- **Prioridade:** 🟡 Média
- **Esforço:** XS
- **Tipo:** `bug`
- **Risco:** Operacional
- **Descrição:** `setWeather(scenarioId, condition, durationMinutes, intensity)` chama `updateEnvironment(scenarioId, 12, condition)` — sempre 12h, ignorando hora atual.
- **Ação:** recuperar `getWorldState(scenarioId)` antes, usar `timeOfDay` atual, ou aceitar `timeOfDay` como parâmetro opcional.
- **Critérios de aceite:**
  - [ ] Mudar clima não reseta a hora do mundo.
  - [ ] Teste unitário cobre o caso.

### Task-011 — Remover código morto em `web-client`
- **Prioridade:** 🟢 Baixa
- **Esforço:** XS
- **Tipo:** `chore`
- **Risco:** Operacional
- **Descrição:** `apps/web-client/src/index.ts` (Three.js vanilla `createSynapseCity()`) não é montado por `main.tsx`. Manter apenas o que estiver em uso (`App.tsx` R3F).
- **Ação:** mover exports de tipos (`SceneSnapshot`, `CitizenId`) para módulo próprio se necessário, deletar o resto.
- **Critérios de aceite:**
  - [ ] `nx run @cidade-virtual/web-client:build` passa.
  - [ ] Bundle size do production build diminui.

### Task-012 — Reconciliar `AgentExecutor` (docs vs código)
- **Prioridade:** 🟢 Baixa
- **Esforço:** XS
- **Tipo:** `docs`
- **Risco:** Operacional
- **Descrição:** `worklog.md` menciona `AgentExecutor` (LangChain) mas o símbolo não existe. A classe efetiva é `AntigravityAgent` (`packages/agents`) + `CognitiveCycleManager` (`packages/agent-cognition`).
- **Ação:** atualizar `worklog.md` e qualquer referência em `SKILL.md` para refletir a classe real.
- **Critérios de aceite:**
  - [ ] `grep -ri AgentExecutor` retorna apenas referências históricas comentadas, se houver.

---

## Épico 4 — Funcionalidades do MVP

### Task-013 — Popular 3-5 NPCs com Fase Meta de Consciência
- **Prioridade:** 🟠 Alta
- **Esforço:** S
- **Tipo:** `feat`
- **Risco:** Operacional
- **Dependências:** Task-002, Task-004
- **Descrição:** Próximo passo explícito do `worklog.md`. Criar habitantes via `createCitizenTool` com arquétipos variados, conectar ao frontend via `AgentAvatar` existente.
- **Escopo:**
  - Seed de 5 NPCs: `worker`, `guard`, `citizen`, `child`, `elder`.
  - Cada um com `backstorySeed` + `activeGoals` distintos.
  - Registrar experiências iniciais observando a placa de lixo, semáforo e praça.
- **Critérios de aceite:**
  - [ ] NPCs persistem após restart da API.
  - [ ] Cada NPC tem ≥3 memórias episódicas após 5 minutos de simulação.

### Task-014 — Implementar `GoalPlanner` real em `agent-planning`
- **Prioridade:** 🟡 Média
- **Esforço:** M
- **Tipo:** `feat`
- **Risco:** Estrutural
- **Dependências:** Task-004
- **Descrição:** Atualmente `generatePlan(goal)` retorna 2 passos hardcoded. Substituir por planner real.
- **Escopo:**
  - Decompor objetivo em passos via heurística HTN ou LLM (se `requiresLLM`).
  - Reutilizar planos bem-sucedidos (cache em `procedural` memory).
  - `PlanRevisionService` para replanejar diante de falhas.
- **Critérios de aceite:**
  - [ ] Plano de "ir à praça" gera ≥4 passos distintos (navegar, evitar obstáculo, atravessar faixa, chegar).
  - [ ] Plano reutilizado após sucesso tem `confidence` maior que primeira execução.

### Task-015 — Implementar `NavigationService` com recast-navigation
- **Prioridade:** 🟡 Média
- **Esforço:** M
- **Tipo:** `feat`
- **Risco:** Estrutural
- **Dependências:** Task-013
- **Descrição:** `packages/world-engine` declara `recast-navigation ^0.35.2` mas `NavigationService` é stub. Gerar NavMesh da `CityScene` para pathfinding real dos NPCs.
- **Escopo:**
  - `initialize(worldGeometry)` — gerar NavMesh a partir dos colliders da cena.
  - `findPath(from, to)` — retornar waypoints.
  - `isNavigable(point)` — validação de posição.
  - Agentes usam pathfinding em vez de patrulha cega atual (que atravessa paredes).
- **Critérios de aceite:**
  - [ ] NPC não atravessa mais paredes/veículos.
  - [ ] Rota recalculada quando semáforo fecha a faixa.

---

## Épico 5 — Qualidade & DevEx

### Task-016 — Expandir cobertura de testes
- **Prioridade:** 🟡 Média
- **Esforço:** M
- **Tipo:** `test`
- **Risco:** Operacional
- **Descrição:** Atualmente só 2 arquivos de teste. Adicionar:
- **Escopo:**
  - `tests/unit/tools.test.ts` — validar 8 schemas Zod (entradas inválidas rejeitadas).
  - `tests/unit/cognitive-cycle.test.ts` — `CognitiveCycleManager` com LLM mockado.
  - `tests/unit/event-bus.test.ts` — pub/sub + handlers assíncronos.
  - `tests/integration/citizens.test.ts` — fluxo criar→setEmotion→listar.
  - `tests/e2e/snapshot.test.ts` — `getSceneSnapshotTool` retorna payload válido.
- **Critérios de aceite:**
  - [ ] Cobertura ≥ 60% nos packages `tools`, `agent-cognition`, `event-system`.
  - [ ] CI no GitHub Actions falha se cobertura regredir.

### Task-017 — Implementar `apps/admin` (Painel God Mode)
- **Prioridade:** 🟢 Baixa
- **Esforço:** L
- **Tipo:** `feat`
- **Risco:** Operacional
- **Dependências:** Task-002 (review tickets), Task-005
- **Descrição:** `apps/admin/src/index.ts` é só um TODO. Construir painel para Daniel aprovar tickets de `requestHumanReview`, monitorar métricas e intervir.
- **Escopo:**
  - Stack: Vite + React (mesmo padrão do `web-client`).
  - Páginas: `Tickets`, `Agents`, `Metrics`, `WorldState`.
  - WebSocket para updates em tempo real de `world:event`.
- **Critérios de aceite:**
  - [ ] Daniel consegue aprovar/rejeitar ticket sem editar código.
  - [ ] Dashboard mostra `metrics.getSnapshot()` em tempo real.

### Task-018 — Documentar setup local
- **Prioridade:** 🟢 Baixa
- **Esforço:** XS
- **Tipo:** `docs`
- **Risco:** Operacional
- **Descrição:** Adicionar `README.md` na raiz com setup, dependências e comandos.
- **Escopo:**
  - Pré-requisitos (Node 20+, Docker).
  - `npm install` → `npm run docker:up` → `npm run dev`.
  - Diagrama de arquitetura (pode ser Mermaid inline).
  - Link para `SKILL.md` e `docs/architecture/ARCHITECTURE.md`.
- **Critérios de aceite:**
  - [ ] Dev novo consegue rodar projeto localmente em < 15 min seguindo o README.

---

## Resumo por Prioridade

| Prioridade | Tasks | Esforço Total |
|---|---|---|
| 🔴 Crítica | 001, 002 | M + S ≈ 1 semana |
| 🟠 Alta | 003, 004, 005, 006, 013 | ≈ 2,5 semanas |
| 🟡 Média | 007, 008, 009, 010, 014, 015, 016 | ≈ 4 semanas |
| 🟢 Baixa | 011, 012, 017, 018 | ≈ 2 semanas |

## Ordem Sugerida de Execução (Critical Path)

```
Task-001 (Qdrant)  ─┐
Task-002 (Citizens) ─┼─► Task-004 (Cognition) ─► Task-013 (NPCs)
                    │                          ─► Task-014 (Planner)
Task-005 (BullMQ)  ─┼─► Task-006 (cognition-worker)
                    │  Task-007 (simulation-worker)
                    │  Task-008 (learning-worker) ◄─ Task-001
                    │
Task-003 (Gateway) ──┘  (independente, pode rodar em paralelo)

Task-009, 010, 011, 012 → paralelos a qualquer momento
Task-016 (testes) → contínuo
Task-017, 018 → finais
```

---

## Notas

- Todas as tasks que envolvem LLM devem usar `LLMProviderAdapter` (package `llm-adapters`) — nunca chamar API direto. Isso permite mockar em testes e trocar provider sem refactor.
- Toda ação de `riskLevel: structural` ou `existential` deve abrir ticket via `requestHumanReviewTool` antes de ser executada.
- Manter `worklog.md` atualizado a cada task concluída, seguindo o padrão já estabelecido (Task ID + Resumo Executivo + Validação de Aceite + Próximos Passos).
