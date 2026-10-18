# TASK.md — Synapse City Engine

> **Backlog consolidado v3.0** (2026-10-18) — substitui a v2.0.
> **Fontes consolidadas:**
> 1. Backlog original (18 tasks, `Task-001..018`) — IDs e detalhes preservados, prioridades recalibradas;
> 2. **Auditoria estática independente** (`task-recommended.md`, out/2026) — 18 recomendações P0/P1/P2. Nota: auditoria declarou-se estática (não executou testes/containers) e não conseguiu gravar no GitHub; este arquivo é a consolidação canônica;
> 3. **Plano de Execução da Onda 1** (`Synapse_City_Plano_Execucao_Onda1.pdf`) — blocos B0-B5, DoD do M0;
> 4. **Decisões de roadmap out/2026** — 5 pilares de visão (IoT/VR, economia, construção, mobilidade, agentes externos), rota **WebXR-first** e plano de evolução Three.js/R3F (F1-F4).
>
> Convenção: cada task tem ID, prioridade, esforço, tipo, risco, dependências, escopo e critérios de aceite verificáveis.

---

## Legenda

| Campo | Valores |
|---|---|
| **Prioridade** | 🔴 Crítica · 🟠 Alta · 🟡 Média · 🟢 Baixa |
| **Esforço** | XS (≤4h) · S (1-2 dias) · M (3-5 dias) · L (1-2 semanas) |
| **Tipo** | `bug` · `feat` · `refactor` · `chore` · `docs` · `test` |
| **Risco** | Operacional · Estrutural · Existencial |
| **Status** | ⬜ Pendente · 🔨 Em andamento · ✅ Concluída |

---

## 0. Situação Atual (Outubro/2026)

### 0.1 O que funciona de verdade
- Mundo 3D padrão DENATRAN (`App.tsx` R3F + `CityScene` procedural de 1.478 linhas), HUD DOM overlay, física Rapier client-side, agentes e veículos simulados no cliente (`vehicle-agent.ts`: 1.162 linhas).
- API NestJS com módulos e 8 tools esqueletais; persistência PostgreSQL/Drizzle funcional para `world_state` e `agent_experiences` (há teste de durabilidade `persistence.test.ts`).
- Gateway Socket.IO namespace `/world` existe e emite eventos; docker-compose provisionado (postgres 16 @ 5433, qdrant 1.12.1, redis 7).
- Pacote `@cidade-virtual/types` compartilhado no monorepo Nx (base dos contratos de eventos).

### 0.2 O que é fachada (stub ou validação fake) — evidências
| Item | Evidência no código |
|---|---|
| Memória vetorial | `packages/memory/index.ts`: 4 stubs TODO |
| Identidade de habitantes | `citizens.service.ts`: UUIDs hardcoded |
| Validação honesta | `apps/web-client/package.json`: `"lint": "node -e \"console.log('... lint ok')\""` e `"test": "vitest run --passWithNoTests"` |
| Dupla fonte de verdade | Semáforo roda com `setTimeout` no `App.tsx` **e** em `src/index.ts` legado (bootstrap raw Three.js não montado) |
| Simulação não-autoritativa | Posições de NPCs/veículos nascem e morrem no browser; nada valida movimentos no servidor |
| Drift de schema | `init.sql` tem `related_entity_ids TEXT[]` e índice `occurred_at DESC` que não existem em `schema.ts` |

### 0.3 Marco vigente
**M0** — *"O habitante persiste e o mundo emite eventos em tempo real"*, cuja prova é o fluxo de aprendizagem de 7 passos (Task-020). Nada da Onda 2 em diante antes do M0 com evidências.

### 0.4 Síntese da auditoria externa → mapeamento de tasks

| Achado da auditoria | Sev. | Task(s) |
|---|---|---|
| Testes/lint podem indicar sucesso sem verificar o código | P0 | **Task-019** (nova) + Task-016 |
| Memória vetorial não implementada | P0 | Task-001 |
| Habitantes com IDs fixos e sem persistência real | P0 | Task-002 |
| Divergências entre schemas SQL, Drizzle e tipos | P0 | Task-009 (elevada) |
| Ausência de fluxo comprovado de aprendizagem | P0 | **Task-020** (nova) |
| Ciclo cognitivo desconectado da API | P1 | Task-004 + Task-014 + **Task-025** (nova) |
| Integração Socket.IO inconsistente | P1 | Task-003 + **Task-021** (nova) |
| Navegação e planejamento incompletos | P1 | Task-014, Task-015 |
| Segurança insuficiente para exposição pública | P1 | **Task-022** (nova) + Task-007 |
| Workers e aprendizagem social incompletos | P2 | Task-005..008, Task-013 |

---

## 1. MARCO M0 — Habitante persiste, mundo emite, aprendizagem comprovada

### Épico A — Verdade do Sistema (P0)

### Task-001 — Implementar `MemoryService` sobre Qdrant
- **Status:** ⬜ Pendente
- **Prioridade:** 🔴 Crítica (P0 da auditoria)
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
- **Status:** ⬜ Pendente
- **Prioridade:** 🔴 Crítica (P0 da auditoria)
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

### Task-009 — Sincronizar schema Drizzle ↔ `init.sql` ↔ `packages/types`
- **Status:** ✅ Concluída (2026-10-18)
- **Prioridade:** 🔴 Crítica (elevada de 🟡 pela auditoria: "divergências entre SQL, Drizzle e tipos")
- **Esforço:** XS
- **Tipo:** `bug`
- **Risco:** Operacional
- **Descrição:** `infrastructure/database/init.sql` define `related_entity_ids TEXT[]` em `agent_experiences` (e índice `occurred_at DESC`) que não existiam em `packages/persistence/src/schema.ts`. Coluna e índice adicionados no Drizzle schema, teste de integração validado com sucesso e script de verificação de drift implementado.
- **Critérios de aceite:**
  - [x] Schema Drizzle alinhado e consistente com `init.sql` e `@cidade-virtual/types`.
  - [x] Teste `tests/integration/persistence.test.ts` insere experiência com `relatedEntityIds` e recupera com sucesso.
  - [x] Script `check:schema-drift` (`npm run check:schema-drift`) executado no CI compara init.sql ↔ schema.ts ↔ types e valida paridade 100%.

### Task-019 — Pipeline de validação honesta (CI que reprova de verdade)
- **Status:** ✅ Concluída (2026-10-18)
- **Prioridade:** 🔴 Crítica (P0 da auditoria: "testes e lint podem indicar sucesso sem verificar o código")
- **Esforço:** S
- **Tipo:** `chore`/`test`
- **Risco:** Estrutural
- **Dependências:** Nenhuma (executada); habilita Task-009 (drift no CI) e Task-016 (gates de cobertura)
- **Descrição:** Removidos scripts fakes (`node -e "console.log(...)"`) e flags evasivas (`--passWithNoTests`). Adicionados testes unitários reais em `apps/api` e `apps/web-client` e validação estática honesta via `tsc --noEmit`. Script de drift adicionado ao pipeline do CI.
- **Critérios de aceite:**
  - [x] Suíte de testes executa asserções reais em `apps/api`, `apps/web-client` e `packages/persistence`.
  - [x] Scripts `lint`/`test` realizam verificações estáticas e testes de unidade reais (removido `--passWithNoTests`).
  - [x] Job de drift de schema adicionado ao GitHub Actions CI (`.github/workflows/ci.yml`).

### Task-020 — Prova E2E do Fluxo de Aprendizagem (DoD do M0)
- **Status:** ⬜ Pendente
- **Prioridade:** 🔴 Crítica (recomendação central da auditoria: "o mais importante é implementar e comprovar este fluxo")
- **Esforço:** M
- **Tipo:** `test`/`feat`
- **Risco:** Existencial
- **Dependências:** Task-001, Task-002, Task-003, Task-021
- **Descrição:** Comprovar E2E o fluxo que transforma a cidade de simulação visual em sistema de agentes que aprende:
  1. Habitante recebe identidade persistente.
  2. Observa um acontecimento na cidade.
  3. Registra a experiência e sua procedência (`sourceType`).
  4. A experiência é armazenada e recuperada posteriormente (Qdrant semântico).
  5. O sistema cognitivo usa essa memória para decidir o que fazer.
  6. O motor valida e executa a ação.
  7. O resultado é registrado e pode influenciar decisões futuras.
- **Escopo:**
  - `tests/e2e/learning-flow.test.ts` cobrindo os 7 passos contra serviços reais (postgres + qdrant do docker-compose).
  - Cenário de demonstração scriptado (seed + roteiro) apresentável em < 5 min.
  - Evidência de aprendizagem: mesma decisão avaliada com e sem memória produz resultado diferente e auditável.
  - Relatório de execução anexado ao `worklog.md` do repo.
- **Critérios de aceite:**
  - [ ] O teste passa com serviços reais e **falha se qualquer um dos 7 passos for removido**.
  - [ ] Nenhum passo usa mock de memória ou identidade (LLM pode ser determinístico/mockado).
  - [ ] Demonstrável para observador externo sem editar código.

### Épico B — Mundo em Tempo Real (P1)

### Task-003 — Integrar `WorldGateway` em `WorldService`
- **Status:** ⬜ Pendente
- **Prioridade:** 🟠 Alta (quick win da Onda 0)
- **Esforço:** XS
- **Tipo:** `feat`
- **Risco:** Operacional
- **Dependências:** Nenhuma (servidor); Task-021 no lado cliente
- **Descrição:** `WorldService` já tem os métodos mas não emite eventos para o frontend. Injetar `WorldGateway` e disparar broadcasts.
- **Escopo:**
  - `setWeather(...)` — após `worldStateRepo.updateEnvironment(...)`, chamar `gateway.broadcastWorldState(await this.getWorldState())` e `gateway.broadcastDomainEvent({ name: 'world.weather.changed', payload })`.
  - `triggerEvent(...)` — emitir `world:event` com o payload do `EventLog`.
  - `incrementTick(...)` — opcionalmente emitir `world:tick` (throttled para não flooding).
- **Critérios de aceite:**
  - [ ] HUD do `web-client` atualiza semáforo e clima em tempo real sem refresh.
  - [ ] Log `AUDIT` de cada broadcast emitido.
- **Nota de integração:** a emissão server-side só produz efeito estável no cliente depois da Task-021 (remoção do simulador local), senão o semáforo oscila entre dois relógios.

### Task-021 — Contrato Socket.IO: o servidor é o único dono da verdade
- **Status:** ⬜ Pendente
- **Prioridade:** 🟠 Alta (P1 da auditoria: "integração Socket.IO inconsistente" + F1 do plano Three.js/R3F)
- **Esforço:** S
- **Tipo:** `refactor`
- **Risco:** Operacional
- **Dependências:** Task-003 (emissão real); absorve a Task-011
- **Descrição:** O cliente hoje é um simulador paralelo: semáforo com `setTimeout` no `App.tsx`, ciclo duplicado no bootstrap legado `src/index.ts` (raw Three.js, não montado), e simulação de agentes/veículos 100% client-side. Dois relógios divergem; a cidade não é compartilhada.
- **Escopo:**
  - Deletar o ciclo local do semáforo no `App.tsx` e o `src/index.ts` legado (tipos migrados para módulo próprio).
  - Tipar todos os eventos em `@cidade-virtual/types` (`world:state`, `world:event`, `world:tick`, `avatar:position`) — API e cliente importam o mesmo contrato.
  - Reconnect com restauração de estado (snapshot on reconnect).
  - Modo "servidor indisponível" explícito (banner + congelamento de estado), nunca simulação silenciosa.
- **Critérios de aceite:**
  - [ ] Semáforo muda apenas por evento do servidor (`grep` não encontra `setTimeout` de ciclo no cliente).
  - [ ] Reconnect restaura o estado correto do mundo.
  - [ ] Contrato de eventos tipado e consumido por ambos os lados.

### Task-010 — Corrigir `timeOfDay` hardcoded em `WorldService.setWeather`
- **Status:** ✅ Concluída (2026-10-18)
- **Prioridade:** 🟡 Média
- **Esforço:** XS
- **Tipo:** `bug`
- **Risco:** Operacional
- **Descrição:** `setWeather` agora consulta o estado atual do mundo e preserva o `timeOfDay` existente, permitindo também parametrização opcional sem forçar 12h.
- **Critérios de aceite:**
  - [x] Mudar clima não reseta a hora do mundo (recupera `currentState.timeOfDay`).
  - [x] Teste unitário em `apps/api/src/modules/world/world.service.spec.ts` cobre preservação e override do horário.

### Task-022 — Endurecimento de segurança para exposição pública
- **Status:** ⬜ Pendente
- **Prioridade:** 🟠 Alta (P1 da auditoria; **gate obrigatório** antes de qualquer acesso externo — visão inclui acesso remoto via óculos e agentes da web)
- **Esforço:** M
- **Tipo:** `feat`
- **Risco:** Existencial
- **Dependências:** Nenhuma para o básico; Task-007 para validação de movimento; semeia o `Principal` (Task-025)
- **Descrição:** A superfície atual não foi desenhada para a internet: WS sem TLS nem auth, CORS por hostname dinâmico, sem rate limit, movimentos aceitos sem validação server-side.
- **Escopo:**
  - CORS por whitelist em env; `helmet`; WSS atrás de proxy (nginx/caddy) com TLS.
  - Autenticação JWT na API + token no handshake do Socket.IO (primeira peça do `Principal`).
  - Rate limiting por IP e por socket, derivado de `OPERATIONAL_LIMITS`.
  - Validação server-side de movimentos (integra com Task-007): posição forjada é rejeitada.
  - Segredos fora do código (`.env` + docker secrets); revisão de endpoints das 8 tools.
- **Critérios de aceite:**
  - [ ] Handshake sem token é rejeitado; com token, funciona.
  - [ ] Posição forjada através de parede é rejeitada pelo servidor.
  - [ ] Checklist OWASP (top 10 reduzido) documentado e verificado.

### Épico C — Ciclo Cognitivo (P1)

### Task-004 — Conectar `CognitionService` ao `CognitiveCycleManager`
- **Status:** ⬜ Pendente
- **Prioridade:** 🟠 Alta (P1 da auditoria: "ciclo cognitivo desconectado da API")
- **Esforço:** S
- **Tipo:** `feat`
- **Risco:** Estrutural
- **Dependências:** Task-001 (memória), Task-002 (citizens)
- **Descrição:** O `CognitionService.processCycle` gera sempre a mesma ação heurística. Substituir pela chamada real ao `CognitiveCycleManager.evaluateAction()` do package `agent-cognition`.
- **Escopo:**
  - Construir `CognitiveContext` a partir de `nearbyObjects` + observação.
  - Passar `MemoryService` como fonte de recuperação semântica.
  - Decidir política para `requiresLLM`: se `confidence < 0.7`, chamar `llmAdapter.complete()` (provider configurável via `LLMProviderAdapter`).
  - Persistir a ação escolhida em `agent_experiences` com `sourceType: 'action_result'`.
- **Critérios de aceite:**
  - [ ] Ações rotineiras não chamam LLM (validar via `metrics.increment('llm.calls')`).
  - [ ] Ações deliberadas registram prompt + resposta no log de auditoria.

### Task-014 — Implementar `GoalPlanner` real em `agent-planning`
- **Status:** ⬜ Pendente
- **Prioridade:** 🟡 Média (P1 da auditoria: "navegação e planejamento incompletos")
- **Esforço:** M
- **Tipo:** `feat`
- **Risco:** Estrutural
- **Dependências:** Task-004
- **Descrição:** Atualmente `generatePlan(goal)` retorna 2 passos hardcoded. Substituir por planner real.
- **Escopo:**
  - Decompor objetivo em passos via heurística HTN ou LLM (se `requiresLLM`).
  - Reutilizar planos bem-sucedidos (cache em memória `procedural`).
  - `PlanRevisionService` para replanejar diante de falhas.
- **Critérios de aceite:**
  - [ ] Plano de "ir à praça" gera ≥4 passos distintos (navegar, evitar obstáculo, atravessar faixa, chegar).
  - [ ] Plano reutilizado após sucesso tem `confidence` maior que a primeira execução.

### Task-015 — Implementar `NavigationService` com recast-navigation
- **Status:** ⬜ Pendente
- **Prioridade:** 🟡 Média (P1 da auditoria)
- **Esforço:** M
- **Tipo:** `feat`
- **Risco:** Estrutural
- **Dependências:** Task-013
- **Descrição:** `packages/world-engine` declara `recast-navigation ^0.35.2` mas `NavigationService` é stub. Gerar NavMesh da `CityScene` para pathfinding real dos NPCs.
- **Escopo:**
  - `initialize(worldGeometry)` — gerar NavMesh a partir dos colliders da cena.
  - `findPath(from, to)` — retornar waypoints.
  - `isNavigable(point)` — validação de posição.
  - Agentes usam pathfinding em vez de patrulha cega (que atravessa paredes).
- **Critérios de aceite:**
  - [ ] NPC não atravessa mais paredes/veículos.
  - [ ] Rota recalculada quando semáforo fecha a faixa.

### Task-025 — Contrato `Principal` + `AgentAction API` (identidade e ação unificadas)
- **Status:** ⬜ Pendente
- **Prioridade:** 🟡 Média (decisão de roadmap out/2026; executa junto com a Onda 2)
- **Esforço:** S
- **Tipo:** `feat`
- **Risco:** Estrutural
- **Dependências:** Task-002, Task-004; destrava a Task-035 (Onda 8)
- **Descrição:** Decisão arquitetural central: todo ator da cidade (usuário, avatar, NPC, agente externo) é um `Principal` com permissões; toda ação passa pela mesma `AgentAction API` (`perceive / decide / act / remember`). NPC interno (Onda 2), voz (Onda 3) e agente MCP da web (Onda 8) compartilham o mesmo contrato — o agente de fora é "o mesmo animal" com permissões diferentes.
- **Escopo:**
  - Tipos `Principal`, `ActionRequest`, `ActionResult` em `@cidade-virtual/types`.
  - Guard de autorização NestJS (RBAC por papel do `Principal`).
  - Adapter: `CognitiveCycleManager` emite ações pelo contrato (facilita plugar agente MCP depois).
- **Critérios de aceite:**
  - [ ] Ação de NPC em recurso não autorizado é rejeitada com motivo auditável.
  - [ ] A mesma action `move` funciona via HTTP REST e via gateway Socket.IO.

### Épico D — Workers & Mensageria (P2 da auditoria)

### Task-005 — Adicionar BullMQ sobre Redis
- **Status:** ⬜ Pendente
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
- **Status:** ⬜ Pendente
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
- **Status:** ⬜ Pendente
- **Prioridade:** 🟡 Média (peça-chave da autoridade do servidor; integra Task-022)
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
- **Status:** ⬜ Pendente
- **Prioridade:** 🟡 Média (P2 da auditoria: "sem consolidação efetiva do conhecimento")
- **Esforço:** M
- **Tipo:** `feat`
- **Risco:** Estrutural
- **Dependências:** Task-001, Task-005
- **Descrição:** Classe D — consolidação passiva noturna. Job recorrente (cron) que varre `agent_experiences` recentes e chama `MemoryConsolidationWorker.consolidateExperiences(...)`.
- **Escopo:**
  - Implementar `consolidateExperiences` em `packages/learning-system` (atualmente stub): agrupar experiências por agente + janela temporal, sumarizar via LLM, criar `MemorySnippet` consolidado (`memoryType: 'semantic'`), podar os episódios originais.
  - Cron diário (e.g. 03:00 BRT) + job manual via API.
  - Respeitar `memoryMaxPerNPC: 10_000` — acima disso, pruning via LLM.
- **Critérios de aceite:**
  - [ ] Após consolidação, count de `agent_experiences` por NPC diminui; count de memórias semânticas aumenta.
  - [ ] Audit log mostra cada consolidação com `consolidatedCount`.

### Task-013 — Popular 3-5 NPCs com Fase Meta de Consciência
- **Status:** ⬜ Pendente
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

### Épico E — Web-client: Higiene de Estado & Escala Visual (base para Ondas 6-7)

### Task-023 — Store externo de estado e fim do re-render por frame
- **Status:** ⬜ Pendente
- **Prioridade:** 🟡 Média (F1 do plano Three.js/R3F)
- **Esforço:** S
- **Tipo:** `refactor`
- **Risco:** Operacional
- **Dependências:** Nenhuma; recomendada antes da Task-033 (VR precisa de frame budget limpo)
- **Descrição:** `Player.tsx` chama `onTelemetryUpdate(...)` dentro do `useFrame` → `setTelemetry` no App → re-render de App, HUD e `snapshotData` a ~60 Hz. Em hardware fraco e no Quest isso derruba o FPS sozinho.
- **Escopo:**
  - Estado de jogo (telemetria, posições, observação) em store externo (Zustand), fora da árvore de reconciliação do React.
  - HUD com subscribe seletivo; valores que mudam a 60 Hz atualizam DOM via ref (sem re-render).
  - `snapshotData` calculado on-demand (ao abrir o modal), não por `useMemo` reativo.
- **Critérios de aceite:**
  - [ ] Em repouso com mundo animando a 60 fps, App re-renderiza < 5x/s.
  - [ ] React Profiler não mostra re-render do `Canvas` em updates de HUD.

### Task-024 — Modularizar `CityScene` + Instancing + primeiro pipeline de assets
- **Status:** ⬜ Pendente
- **Prioridade:** 🟡 Média (F1/F2 do plano Three.js/R3F)
- **Esforço:** M
- **Tipo:** `refactor`
- **Risco:** Operacional
- **Dependências:** Nenhuma (paralelizável); prepara Onda 5 (cidade que cresce) e Onda 7 (VR)
- **Descrição:** `CityScene` (1.478 linhas) constrói cada árvore/poste/prédio como mesh individual, sem instancing, sem LOD, sem assets. Preparar a cena para crescer por dados do servidor e caber num headset.
- **Escopo:**
  - Split por distrito (`roads`, `praca`, `market`, `buildings`) com API de builder compartilhada.
  - `InstancedMesh` (drei `<Instances>`) para elementos repetidos.
  - LOD inicial (drei `<Detailed>`); shadow map 4096 → 2048 com cascata.
  - Import de pelo menos 1 prédio e 1 árvore via GLTF + Draco/Meshopt + KTX2 (pipeline validado).
- **Critérios de aceite:**
  - [ ] Draw calls da cena reduzidos ≥ 60%.
  - [ ] ≥ 60 fps em notebook com GPU integrada.
  - [ ] Assets carregados por distrito (base do prefetch por proximidade).

### Épico F — Qualidade & DevEx

### Task-012 — Reconciliar `AgentExecutor` (docs vs código)
- **Status:** ✅ Concluída (2026-10-18)
- **Prioridade:** 🟢 Baixa
- **Esforço:** XS
- **Tipo:** `docs`
- **Risco:** Operacional
- **Descrição:** `worklog.md` foi atualizado para clarificar que a arquitetura adotou nativamente `AntigravityAgent` (`packages/agents`) + `CognitiveCycleManager` (`packages/agent-cognition`), substituindo a menção conceitual ao `AgentExecutor` do LangChain.
- **Critérios de aceite:**
  - [x] `grep -ri AgentExecutor` retorna apenas referências históricas e esclarecidas.

### Task-016 — Expandir cobertura de testes
- **Status:** ⬜ Pendente
- **Prioridade:** 🟡 Média (contínuo; os gates do CI são definidos pela Task-019)
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
  - [ ] CI no GitHub Actions falha se cobertura regredir (gate da Task-019).

### Task-017 — Implementar `apps/admin` (Painel God Mode)
- **Status:** ⬜ Pendente
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
- **Status:** ✅ Concluída (2026-10-18)
- **Prioridade:** 🟢 Baixa
- **Esforço:** XS
- **Tipo:** `docs`
- **Risco:** Operacional
- **Descrição:** `README.md` canônico criado na raiz do monorepo com instruções de setup (Node 20+, Docker Compose), comandos do workspace, diagrama de arquitetura em Mermaid e links para documentações.
- **Critérios de aceite:**
  - [x] Dev novo consegue rodar projeto localmente em < 15 min seguindo o README.

### Task-011 — Remover código morto em `web-client`
- **Status:** ✅ Concluída (2026-10-18)
- **Prioridade:** 🟢 Baixa
- **Esforço:** XS
- **Tipo:** `chore`
- **Risco:** Operacional
- **Descrição:** `apps/web-client/src/index.ts` legado (Three.js vanilla com botões inexistentes e bootstrap paralelo não montado) foi limpo e transformado em exportador canônico de tipos e componentes para o `@cidade-virtual/web-client`.
- **Critérios de aceite:**
  - [x] `nx run @cidade-virtual/web-client:build` passa com sucesso.
  - [x] Bootstrap paralelo e duplicação eliminados.

---

## 3. Roadmap de Evolução 2026+ — Ondas 3 a 8

> **Gate:** nada desta seção começa antes do M0 com evidências (Task-020 verde).
> Cada onda entrega uma prova observável (marco). A sequência respeita dependências reais: economia antes de construção, espacial antes de mobilidade, contrato `Principal` antes de agentes externos.

| Onda | Tema | Prova (marco) | Tasks |
|---|---|---|---|
| 3 | Voz (ASR → LLM → TTS) | Conversar por voz com um NPC, de qualquer lugar | 032 |
| 4 | Cidade Viva (economia interna) | M3 | 026, 027 |
| 5 | Cidade Construtível | M4 | 028, 029 |
| 6 | Mobilidade (táxis NPC) | M5 | 030, 031 |
| 7 | IoT & Imersão (WebXR-first) | M6 | 033, 034 |
| 8 | Cidade Aberta (agentes da web) | M7 | 035 |

### Task-032 — Módulo `dialogue`: conversa por voz com NPCs (Onda 3)
- **Status:** ⬜ Pendente
- **Prioridade:** 🟡 Média
- **Esforço:** M
- **Tipo:** `feat`
- **Risco:** Operacional
- **Dependências:** Task-004 (cognição), Task-025 (contrato)
- **Descrição:** Pipeline ASR → LLM (persona do NPC + memórias recuperadas) → TTS com voz distinta por NPC. Novo módulo `apps/api/src/modules/dialogue/`, reutilizando o canal `/world` (áudio via WebRTC/datachannel quando necessário).
- **Aceite:**
  - [ ] Conversa por voz com NPC com latência percebida < 3s.
  - [ ] NPC referencia memória de interação anterior ("você esteve aqui ontem").
  - [ ] Vozes distinguíveis por arquétipo de NPC.

### Task-026 — Ledger de parto dupla + carteiras (Onda 4)
- **Status:** ⬜ Pendente
- **Prioridade:** 🟡 Média (fundação econômica de toda a visão)
- **Esforço:** M
- **Tipo:** `feat`
- **Risco:** Estrutural
- **Dependências:** Task-022 (auth), Task-025 (`Principal`); Módulos 4-6 do curso de persistência aplicados
- **Descrição:** Fonte de verdade econômica: journal **append-only** de parto dupla (todo débito tem crédito), saldos derivados/reconciliáveis, idempotency keys para webhooks futuros de pagamento.
- **Escopo:**
  - Tabelas `ledger_entries` (imutável) + `wallets` (por `Principal`), migration Drizzle.
  - Transferência atômica com `SELECT ... FOR UPDATE` / isolamento serializable.
  - Testes de concorrência (transferências paralelas não geram saldo negativo).
  - Auditoria completa de cada movimento (o curso de persistência é o guia técnico desta task).
- **Aceite:**
  - [ ] Conciliação débito = crédito sob carga (teste de 1.000 transações paralelas).
  - [ ] Restart da API não perde nem duplica transação confirmada.
  - [ ] Créditos são internos — nenhuma conversão real antes de revisão jurídica.

### Task-027 — Marketplace interno NPC ↔ NPC com escrow (Onda 4)
- **Status:** ⬜ Pendente
- **Prioridade:** 🟡 Média
- **Esforço:** M
- **Tipo:** `feat`
- **Risco:** Operacional
- **Dependências:** Task-026, Task-013 (NPCs)
- **Descrição:** Ofertas/compras entre habitantes com padrão escrow (hold → entrega → release). Transações viram memórias (`sourceType: 'economy'`) que influenciam decisões futuras — economia vira conteúdo cognitivo.
- **Aceite:**
  - [ ] **M3:** dois NPCs completam ciclo comprar/vender, com dinheiro que persiste e memória do resultado.

### Task-028 — Estado espacial autoritativo: tick engine + PostGIS (Onda 5)
- **Status:** ⬜ Pendente
- **Prioridade:** 🟡 Média
- **Esforço:** L
- **Tipo:** `feat`
- **Risco:** Estrutural
- **Dependências:** Task-026, Task-025, Task-007 (tick/validação)
- **Descrição:** Extensão PostGIS no PostgreSQL existente; tabelas `plots` (lotes com geometria) e `zoning`; tick engine server-side (BullMQ repeatable) como autoridade de posições — o cliente vira renderizador de estado, encerrando a simulação client-side.
- **Aceite:**
  - [ ] Consulta `ST_DWithin` retorna lotes por raio.
  - [ ] Tick 10-20 Hz com validação de movimento server-side.
  - [ ] Cliente exibe posições vindas do servidor (fim da posição local de NPCs).

### Task-029 — Sistema de construção: lotes, obras e fábricas (Onda 5)
- **Status:** ⬜ Pendente
- **Prioridade:** 🟢 Baixa (evolução)
- **Esforço:** M
- **Tipo:** `feat`
- **Risco:** Operacional
- **Dependências:** Task-028, Task-027
- **Descrição:** Blueprints, `construction_jobs` (obra leva N ticks — fila BullMQ), fábricas produzem bens que abastecem o comércio. Condomínios = propriedade fracionada (v2).
- **Aceite:**
  - [ ] **M4:** jogador constrói uma loja; uma fábrica NPC fornece o estoque; NPC vende e registra lucro no ledger.

### Task-030 — Mobilidade server-side: grafo viário + A* (Onda 6)
- **Status:** ⬜ Pendente
- **Prioridade:** 🟢 Baixa (evolução)
- **Esforço:** M
- **Tipo:** `feat`
- **Risco:** Estrutural
- **Dependências:** Task-028; migra o `VehicleAgent` (1.162 linhas client-side) para autoridade do servidor
- **Descrição:** Grafo viário em PostGIS, pathfinding A* (rotas populares cacheadas no Redis), táxis NPC como agentes com "profissão" (percebem pedido → aceitam → navegam → ganham, via ledger).
- **Aceite:**
  - [ ] **M5 (parte 1):** avatar chama um táxi NPC e chega ao destino; rota respeita semáforos e evita colisões.

### Task-031 — Broadcast AOI + interpolação cliente (Onda 6)
- **Status:** ⬜ Pendente
- **Prioridade:** 🟢 Baixa (evolução)
- **Esforço:** S
- **Tipo:** `feat`
- **Risco:** Operacional
- **Dependências:** Task-028, Task-023
- **Descrição:** Interest management: rooms Socket.IO por zona (`zone:rua-central`), delta states, posições a 10-20 Hz só para interessados; buffer de interpolação de 100-120 ms no cliente.
- **Aceite:**
  - [ ] **M5 (parte 2):** cliente distante da zona não recebe posições remotas.
  - [ ] Movimento interpolado visualmente suave com rede a 15 Hz.

### Task-033 — WebXR: a cidade pelos óculos do avatar (Onda 7)
- **Status:** ⬜ Pendente
- **Prioridade:** 🟢 Baixa (evolução; rota **WebXR-first** decidida em out/2026)
- **Esforço:** M
- **Tipo:** `feat`
- **Risco:** Operacional
- **Dependências:** Task-023, Task-024, Task-031 (frame budget e rede limpos primeiro)
- **Descrição:** Modo imersivo no navegador do próprio headset (Quest/Pico — sem PC, sem app nativo): `@react-three/xr`, teleport como locomoção padrão, hands, vinheta de comfort, detecção de device para perf tiers. AR no celular (`immersive-ar`) de graça com a mesma base.
- **Aceite:**
  - [ ] **M6 (parte 1):** entrar na cidade via navegador do headset, de qualquer lugar (wss), sem PC.
  - [ ] 72 fps sustentados por 30 min (orçamento térmico ok).

### Task-034 — Telemetria IoT e gêmeo digital (Onda 7)
- **Status:** ⬜ Pendente
- **Prioridade:** 🟢 Baixa (evolução)
- **Esforço:** M
- **Tipo:** `feat`
- **Risco:** Operacional
- **Dependências:** Task-028
- **Descrição:** Bridge MQTT (EMQX) → Redis Streams → estado do mundo (clima/tráfego dinâmicos); hooks de gêmeo digital (sensor real → evento virtual); TimescaleDB opcional para histórico de telemetria.
- **Aceite:**
  - [ ] **M6 (parte 2):** sensor simulado (ou real) altera o clima visível no cliente e nos óculos.
  - [ ] Agregação/throttling evita flooding do gateway.

### Task-035 — Agent Gateway MCP: cidade aberta a agentes da web (Onda 8)
- **Status:** ⬜ Pendente
- **Prioridade:** 🟢 Baixa (o pilar mais audacioso; barato arquiteturalmente porque reusa a Task-025)
- **Esforço:** L
- **Tipo:** `feat`
- **Risco:** Existencial
- **Dependências:** Task-025 (contrato), Task-022 (segurança), Task-026/027 (economia)
- **Descrição:** O mesmo contrato `AgentAction API` dos NPCs internos exposto como servidor MCP: tools `perceive`, `move`, `speak`, `buy`, `build`. API keys por dono do agente, quotas, rate limit, score de reputação, kill switch, cobrança de entrada em créditos da cidade (monetiza a plataforma).
- **Escopo:**
  - Servidor MCP em `apps/api` (ou `apps/agent-gateway`), autenticação por dono.
  - Sandbox: validação de toda ação pelo motor (nada executa fora das regras da cidade).
  - Reputação + kill switch por agente; ações de `riskLevel: structural` abrem ticket humano (regra existente).
- **Aceite:**
  - [ ] **M7:** um agente LLM externo entra pela API, aluga um quiosque, vende para um avatar e sai — tudo auditado.
  - [ ] Agente malicioso (flood/injeção) é contido por quota e kill switch sem afetar outros `Principals`.

---

## 4. Resumo por Prioridade

| Prioridade | Tasks | Esforço Total |
|---|---|---|
| 🔴 Crítica | 001, 002, 009, 019, 020 | M + S + XS + S + M ≈ 2,5 semanas |
| 🟠 Alta | 003, 004, 005, 006, 013, 021, 022 | XS + S + M + S + S + S + M ≈ 3 semanas |
| 🟡 Média | 007, 008, 010, 014, 015, 016, 023, 024, 025, 026, 027, 028, 032 | ≈ 8-9 semanas |
| 🟢 Baixa | 011, 012, 017, 018, 029, 030, 031, 033, 034, 035 | ≈ 8 semanas (evolução, gated pelas ondas) |

## 5. Ordem Sugerida de Execução (Critical Path)

```
FASE 0 — Confiança (≈ 1 semana)
  Task-019 (CI honesto) ──► Task-009 (drift no CI) ──► Task-010 · 011 · 012 (XS, paralelos)

MARCO M0 — Onda 1 (≈ 3 semanas; GATE RÍGIDO: nada além dele sem evidências)
  Task-002 (citizens) ────► Task-001 (Qdrant) ──────┐
  Task-003 (gateway, XS) ─► Task-021 (contrato) ────┴─► Task-020 (prova E2E dos 7 passos = DoD)

ONDA 2 — Autonomia (após M0)
  Task-004 (cognição) ──► Task-014 (planner) ∥ Task-015 (nav)
  Task-005 (BullMQ) ────► Task-006 (cognition) ∥ Task-007 (simulation) ∥ Task-008 (learning)
  Task-013 (seed NPCs) ──► Task-025 (Principal + AgentAction API)
  Task-022 (segurança) — GATE antes de qualquer exposição externa
  Task-023 ∥ Task-024 (web-client) — paralelos a qualquer momento

ONDAS 3-8 — Evolução (sequência de dependências, cada onda entrega seu marco)
  Onda 3: Task-032 (voz)                    após Task-025
  Onda 4: Task-026 ──► Task-027             ⇒ M3
  Onda 5: Task-028 ──► Task-029             ⇒ M4
  Onda 6: Task-030 ∥ Task-031               ⇒ M5
  Onda 7: Task-033 ∥ Task-034               ⇒ M6
  Onda 8: Task-035                          ⇒ M7

TRANSVERSAL
  Task-016 (testes) contínuo · Task-017/018 (admin/docs) nos vales de capacidade
```

## 6. Mapa de Marcos

| Marco | Prova observável | Onda | Tasks-chave |
|---|---|---|---|
| **M0** | Habitante persiste, o mundo emite eventos em tempo real e o fluxo de aprendizagem de 7 passos passa E2E | 1 | 001, 002, 003, 009, 019, 020, 021 |
| M1/M2 | Reservados ao ciclo de ensino avatar→NPC (Dossiê Técnico) | — | — |
| **M3** | NPCs compram e vendem entre si, com dinheiro que persiste | 4 | 026, 027 |
| **M4** | Jogador constrói uma loja; fábrica NPC fornece o estoque | 5 | 028, 029 |
| **M5** | Avatar chama um táxi NPC e chega ao destino; posição só para quem está por perto | 6 | 030, 031 |
| **M6** | Cidade vista pelos óculos do avatar, com o sensor real visível | 7 | 033, 034 |
| **M7** | Agente de IA da web entra, aluga um quiosque, vende e sai — tudo auditado | 8 | 035 |

---

## Notas (Regras de Ouro)

- Todas as tasks que envolvem LLM devem usar `LLMProviderAdapter` (package `llm-adapters`) — nunca chamar API direto. Isso permite mockar em testes e trocar provider sem refactor.
- Toda ação de `riskLevel: structural` ou `existential` deve abrir ticket via `requestHumanReviewTool` antes de ser executada.
- **Servidor autoritativo:** nenhuma simulação paralela no cliente. O cliente renderiza estado; não inventa (lição da Task-021 — dois relógios sempre divergem).
- **WebXR-first:** nenhum cliente nativo (Unity) antes de esgotar a rota web. O navegador do óculos é o app — o mesmo client atende PC, celular e headset.
- **Moeda:** créditos internos primeiro. Conversão para moeda corrente só após revisão jurídica (Lei 14.478/2022, regulação BACEN, KYC/COAF) e sempre via PSP com idempotência (Task-026).
- Manter `worklog.md` atualizado a cada task concluída, seguindo o padrão já estabelecido (Task ID + Resumo Executivo + Validação de Aceite + Próximos Passos).
