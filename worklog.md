# Worklog — Cidade Virtual de IAs Humanizadas

## Task: Fechamento dos Workers da Onda 2 (Task-007 SimulationWorker & Task-008 LearningWorker)
- **Data:** 2026-10-18
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Estrutural / Mensageria e Concorrência (BullMQ, Redis 7, Qdrant e PostgreSQL)

### 1. Resumo Executivo
Conclusão integral dos workers assíncronos da Onda 2 / Épico D:
1. **SimulationWorker (Task-007)**: Loop determinístico de Classe A consumindo `simulation-queue`, processando avanço de ticks com persistência no PostgreSQL, validação server-side de movimentação e colisão contra anti-speedhack/teleporte, e roteamento de falhas para a DLQ.
2. **LearningWorker (Task-008)**: Consolidação passiva noturna de Classe D consumindo `learning-queue`, executando `MemoryConsolidationWorker` real para agrupar experiências de habitantes, sintetizar memórias semânticas estruturadas no Qdrant, persistir reflexões e podar episódios originais no PostgreSQL com logs de auditoria `[AUDIT] [LEARNING_CONSOLIDATION]`.

### 2. Implementações Realizadas
- **`packages/event-system/workers/simulation.worker.ts`**:
  - Implementado `SimulationWorker` com concorrência configurável (default 10) e processador `ISimulationProcessor`.
  - Medição e publicação de latência `simulation.tick.ms`, contador `simulation.ticks.processed` e rejeições `simulation.movement.rejected`.
  - Tratamento de falhas críticas com encaminhamento automático para a DLQ (`dlq-queue`) após 5 tentativas.
- **`packages/learning-system/index.ts`**:
  - Implementado `MemoryConsolidationWorker` completo com suporte a Qdrant (`MemoryService`) e PostgreSQL (`ExperienceRepository`).
  - Agrupamento de experiências por habitante, síntese semântica estruturada e persistência com `memoryType: 'semantic'`, `origin: 'reflection'`.
  - Suporte a poda de episódios originais (`pruneOriginals: true`) via `expRepo.deleteByIds()`.
- **`packages/event-system/workers/learning.worker.ts`**:
  - Implementado `LearningWorker` consumindo `learning-queue`, chamando o processador de consolidação e despachando para a DLQ em caso de erro fatal.
- **`packages/persistence/src/repositories/experience.repository.ts`**:
  - Adicionados métodos `getByDateRange(since, limit)` e `deleteByIds(ids)` para suporte a consultas temporais e poda na consolidação.
- **`tsconfig.base.json`**:
  - Mapeados paths `@cidade-virtual/persistence` e `@cidade-virtual/learning-system`.

### 3. Validação de Aceite
- Criado `tests/integration/simulation-worker.test.ts` (4 testes de integração com Redis e PostgreSQL reais, 100% aprovados).
- Criado `tests/integration/learning-worker.test.ts` (3 testes de integração com Redis, Qdrant e PostgreSQL reais, 100% aprovados).
- `npx vitest run`: **18 arquivos de teste, 81 testes executados e 100% aprovados**.
- `npm run typecheck`: **0 erros de tipagem** no monorepo Nx.
- `task.md`: Tasks 007 e 008 atualizadas para `Concluída`.


## Task: Correção e Blindagem de Colisões (Veículos, Agentes e Player)
- **Data:** 2026-10-18
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Físico / Renderização 3D (Anti-penetração e evasão de obstáculos)

### 1. Resumo Executivo
Identificação e resolução da transposição física de objetos que estavam passando uns por dentro dos outros (carros ↔ carros, agentes ↔ agentes, player ↔ agentes, carros ↔ pedestres).

### 2. Causas Raiz & Soluções Aplicadas
1. **Agentes ↔ Agentes e Player ↔ Agentes:**
   - `Agents.tsx` apenas agregava colisores estáticos e de veículos em `activeColliders`, omitindo os outros agentes e o player protagonista. Cada agente ignorava a existência dos demais ao caminhar.
   - `Player.tsx` não recebia a lista de `agents` e portanto omitia seus cilindros corporais em `dynamicColliders`.
   - **Correção:**
     - Adicionado suporte a `playerPos` em `AgentsProps` e geração dinâmica de colisores para todos os $N-1$ agentes no ciclo de cada agente.
     - Adicionado suporte a `agents` em `PlayerProps` e inclusão no `dynamicColliders` do player.
     - Adicionada camada de resolução mútua elástica anti-penetração em `Agents.tsx` e `Player.tsx` para repelir sobreposições instantaneamente ao longo da normal de colisão.
2. **Carros ↔ Carros e Carros ↔ Pedestres/Player:**
   - Em `VehicleAgent.perceive()`, a verificação longitudinal possuía a cláusula `if (lon <= 0.5 || lon > range) return null;`. Como `lon` é medido a partir do centro do carro (`CAR_HALF_LENGTH = 2.3m`), qualquer obstáculo tocando ou sobreposto ao veículo retornava `null`, desativando a percepção de perigo e fazendo o carro acelerar através do objeto.
   - Veículos testavam apenas o centro do outro veículo (`other.position`, raio 1.0) em vez de considerar os 3 cilindros de 1.05m ao longo do chassi, perdendo veículos que estivessem fazendo conversões perpendiculares.
   - Não havia passo de separação geométrica (anti-penetração) pós-movimento entre veículos.
   - **Correção:**
     - Corrigido `test()` em `VehicleAgent.perceive()` para cobrir o intervalo `[-CAR_HALF_LENGTH, range]`. Obstáculos em contato/sobreposição retornam `gap = 0`, disparando imediatamente frenagem máxima (`MAX_DECEL`, `OBSTACLE_BRAKING`).
     - Teste de outros veículos agora itera sobre todos os 3 cilindros de colisão de cada veículo.
     - Implementado `resolveVehicleCollisions()` com pushback simétrico em ambos os veículos caso ocorra sobreposição geométrica, zerando velocidades relativas.
     - Implementado `resolvePedestrianCollisions()` para empurrar pedestres/avatar para fora da lataria e estancar o veículo.
     - Protegido `buildContactShadow()` contra ambientes headless/Node/Vitest onde `document` não está disponível.

### 3. Validação de Aceite
- Criado arquivo de testes `apps/web-client/src/vehicles/vehicle-collision.spec.ts` com 7 testes unitários abrangendo todos os cenários de colisão e anti-penetração (100% aprovados).
- `npx vitest run`: **16 arquivos de teste, 74 testes executados e 100% aprovados**.
- `npm run typecheck`: **0 erros de tipo** em todo o monorepo Nx.


## Task ID: 0-indexacao
- **Data:** 2026-10-13
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Operacional (Scaffold inicial e contratos de tipos/tools)

### 1. Resumo Executivo
Inicialização e indexação da estrutura base do monorepo Nx/Turbo conforme contrato mestre definido no `SKILL.md`. Implementação dos tipos compartilhados, schemas Zod, esqueletos das 8 Tools com `@tool`, serviços base e builder do Agente Antigravity.

### 2. Estrutura Criada
- **Monorepo & Configurações:**
  - `package.json` raiz configurado com workspaces (`apps/*`, `packages/*`) e dependências do projeto.
  - `nx.json` configurado com `targetDefaults` para build, lint e test com cache ativado.
  - `turbo.json` configurado com pipeline declarativo de tarefas.
  - `tsconfig.base.json` e `tsconfig.json` com mapeamento unificado de paths `@cidade-virtual/*`.
  - `.github/workflows/ci.yml` configurado com validação contínua (build, lint e test via Nx).
  - `.gitignore` cobrindo node_modules, caches e builds.
- **Packages:**
  - `packages/types/index.ts`: Tipos compartilhados (`CitizenId`, `EventLog`, `MemorySnippet`, `SceneSnapshot`, etc.).
  - `packages/tools`: Schemas Zod (`createCitizenSchema`, `triggerEventSchema`, `getNPCMemorySchema`, `setEmotionStateSchema`, `requestHumanReviewSchema`, `weatherSetConditionSchema`, `npcBroadcastAlertSchema`, `getSceneSnapshotSchema`) e exports.
  - `packages/memory`: Definição e cliente base `MemoryService` para integração Qdrant/Zep.
  - `packages/config`: Constante `OPERATIONAL_LIMITS` da Seção 15 do `SKILL.md`.
  - `packages/agents`: `buildAntigravityAgent()` com `AntigravityAgent` (substituindo a menção conceitual ao `AgentExecutor` do LangChain), registro das 8 Tools e system prompt com regras de segurança e níveis operacionais.
- **Apps:**
  - `apps/api`: Backend NestJS com esqueleto das 8 Tools (`apps/api/src/tools/index.ts`), decorators `@tool`, schemas Zod e serviços (`CitizensService`, `ScenariosService`, `MemoryService`, `ConsciousnessService`).
  - `apps/web`: Scaffold frontend com suporte a Three.js (`apps/web/src/index.ts`).
  - `apps/admin`: Scaffold do painel administrativo God Mode (`apps/admin/src/index.ts`).

### 3. Validação de Aceite
- `nx run-many -t build --all`: Executado com sucesso (8/8 projetos passaram).
- `nx run-many -t lint --all`: Executado com sucesso (8/8 projetos passaram).
- `nx run-many -t test --all`: Executado com sucesso (8/8 projetos passaram).

---

## Task ID: 1-mvp-rua-central
- **Data:** 2026-10-13
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Operacional (Passo 1 do MVP — Ambiente 3D em Three.js)

### 1. Resumo Executivo
Implementação do ambiente 3D interativo da Rua Central no `apps/web` com Three.js, contendo a infraestrutura física e semiótica solicitada por Daniel para aprendizado e observação dos agentes.

### 2. Elementos Construídos
- **Rua & Infraestrutura:** Asfalto escuro (120m), faixas amarelas tracejadas centrais, guias brancas e calçadas elevadas de concreto com meio-fio em ambos os lados.
- **Faixa de Pedestres:** Pintura transversal com 10 listras brancas reflexivas no centro da via para travessia segura.
- **Semáforo Funcional:** Poste e braço metálico com 3 lâmpadas volumétricas (Vermelho, Amarelo, Verde) com ciclo dinâmico automático e controle manual God Mode.
- **Placa "PROIBIDO JOGAR LIXO":** Textura procedural 2D Canvas em alta definição (1024x1400) com moldura de advertência, pictograma internacional de proibição, tipografia clara e citação legal (Lei 12.305/10), voltada para os pedestres.
- **Lixeira Pública Municipal:** Instalada na calçada logo à frente da placa, criando a contraparte funcional da regra de descarte.
- **Ambientação Urbana:** Postes de iluminação pública com lâmpadas quentes, árvores com copas volumétricas e prédios estilizados em ambos os lados da via.
- **Avatar Jogável (Daniel):** Modelo 3D com indicador direcional/halo, movimentação em WASD, sprint com Shift, animação procedural de passos e física de colisão nos limites da calçada.
- **Câmera:** Alternância suave entre 3ª Pessoa (órbita com mouse e zoom) e 1ª Pessoa (tecla C).
- **HUD Glassmorphism (God Mode):**
  - **Sensor de Observação Semântica:** Detecta proximidade de objetos (Placa de lixo, Semáforo, Faixa, Lixeira) e exibe o *Script Social Emergente* que orientará o RAG dos NPCs.
  - Controles God Mode de ciclo de semáforo e iluminação (Dia / Pôr do Sol / Noite).
  - Modal integrado com retorno JSON fiel à Tool `getSceneSnapshot`.

### 3. Validação de Aceite
- `nx run-many -t build --all`: 8/8 projetos passaram sem erro.
- `nx run-many -t lint --all`: 8/8 projetos passaram sem erro.
- Dev Server Vite executando localmente em `http://127.0.0.1:3000/`.

### 4. Próximos Passos Sugeridos
1. **Passo 2 do MVP:** Popular a cena com 3 a 5 NPCs iniciais em Fase Meta de Consciência.
2. **Integração de Memória:** Conectar os scripts sociais observados pelos NPCs ao Qdrant para recuperação via RAG.

---

## Task ID: bloco-1-fase-0-confianca
- **Data:** 2026-10-18
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Estrutural & Operacional (Resolução de Pendências do Backlog v3.0)

### 1. Resumo Executivo
Execução completa do Bloco 1 (Fase 0 — Confiança e Integridade Rápida) do `task.md`, eliminando dívidas técnicas críticas apontadas na auditoria estática e alinhando o monorepo para a trilha do Marco M0.

### 2. Entregas Realizadas
- **Task-009 (Schema Drift):** Sincronizada a tabela `agent_experiences` no Drizzle (`packages/persistence/src/schema.ts`) adicionando a coluna `relatedEntityIds: text('related_entity_ids').array()` e o índice `idx_agent_exp_occurred_at` com `occurredAt.desc()`. Criado o script `scripts/check-schema-drift.ts` (`npm run check:schema-drift`) que valida paridade 100% entre `init.sql`, Drizzle schema e `@cidade-virtual/types`.
- **Task-010 (WorldService timeOfDay):** Corrigido `WorldService.setWeather` para preservar o horário atual do mundo em vez de resetar para 12h. Criado teste unitário `apps/api/src/modules/world/world.service.spec.ts`.
- **Task-011 (Remoção de Código Morto):** O arquivo legado `apps/web-client/src/index.ts` (Three.js vanilla com simulação paralela não montada) foi limpo e transformado em exportador limpo de tipos e componentes para o `@cidade-virtual/web-client`.
- **Task-012 (Reconciliação AgentExecutor):** Documentação do `worklog.md` alinhada à arquitetura nativa com `AntigravityAgent` e `CognitiveCycleManager`.
- **Task-018 (Setup e Documentação):** Criado o `README.md` canônico na raiz com guia de setup (< 15 min), comandos Docker, diagrama de arquitetura em Mermaid e estrutura do monorepo.
- **Task-019 (Pipeline de Validação Honesta):** Removidos scripts fakes com `console.log` e flags evasivas `--passWithNoTests` em `apps/api` e `apps/web-client`. Criado teste unitário para o frontend `agent-avatar.spec.ts`. Adicionado o check de drift ao fluxo do CI (`.github/workflows/ci.yml`).

### 3. Validação de Aceite
- `npm run check:schema-drift`: 100% sincronizado sem desvios.
- `npx vitest run`: 4 arquivos de teste, 9 asserções executadas e 100% aprovadas.
- `npm run typecheck`: Validação estática honesta em todos os projetos sem erros.

---

## Task ID: bloco-2-marco-m0
- **Data:** 2026-10-18
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Existencial & Estrutural (Marco M0: Habitante persiste, mundo emite, aprendizagem comprovada)

### 1. Resumo Executivo
Execução completa e validação de ponta a ponta do **Bloco 2 (Marco M0 - Onda 1)** do `task.md`. Todos os stubs e fachadas críticas foram eliminados e substituídos por integrações reais com PostgreSQL 16 e Qdrant v1.12.1. O servidor tornou-se a única autoridade de estado e tempo (Socket.IO `/world`), e o ciclo de aprendizagem de 7 passos foi comprovado E2E sem nenhum mock de persistência ou memória vetorial.

### 2. Entregas Realizadas
- **Task-002 (CitizensService & Identidade Persistente):**
  - Conectado `CitizensService` ao `AgentIdentityRepository` e `ExperienceRepository` (Drizzle ORM).
  - Eliminados UUIDs hardcoded no backend, adotando `crypto.randomUUID()`.
  - Implementada persistência completa de habitantes, emissão de logs estruturados `[AUDIT]` e broadcast de eventos ambientais.
  - Testes unitários em `citizens.service.spec.ts` (3/3) e teste de integração contra PostgreSQL real em `tests/integration/citizens.test.ts` (2/2).
- **Task-003 & Task-021 (Mundo em Tempo Real & Servidor Autoritativo):**
  - Implementado `WorldGateway` no namespace `/world` encapsulado em `GatewayModule` (`@Global()`).
  - Definido ciclo DENATRAN autoritativo server-side (8s verde, 3s amarelo, 8s vermelho) com suporte a override God Mode `traffic_light:set` e log `[AUDIT]`.
  - Integrado `WorldGateway` em `WorldService` para broadcast de `world:state`, `world:event` e `world:tick`.
  - Eliminado o ciclo duplicado com `setTimeout` local no `App.tsx` (`grep setTimeout` = 0 ocorrências). O cliente agora escuta exclusivamente o servidor.
  - Unificados os contratos em `@cidade-virtual/types` (`TrafficLightSignal`, `WorldStateEventPayload`, `AvatarPositionPayload`).
  - Teste unitário em `apps/api/src/gateways/world.gateway.spec.ts` (4/4).
- **Task-001 (MemoryService sobre Qdrant Real):**
  - Container Qdrant v1.12.1 provisionado e verificado na porta 6333.
  - Implementado `packages/memory/index.ts` com gerador determinístico de embeddings L2-normalizados (1536 dimensões) via projeção de n-grams.
  - Configurada collection `memories` com métrica Cosine e índice HNSW (`m: 16, ef_construct: 100`).
  - Implementadas inserção (`addMemory`), busca semântica (`semanticQuery`), filtro por cidadão (`queryByCitizen`) e expurgo (`pruneMemory`).
  - Teste de integração contra o container Qdrant real em `tests/integration/memory.test.ts` (5/5).
- **Task-020 (DoD do Marco M0 — Prova E2E do Fluxo de Aprendizagem):**
  - Criado `tests/e2e/learning-flow.test.ts` validando os 7 passos fundamentais com zero mocks de dados:
    1. Habitante criado com identidade persistente em PostgreSQL.
    2. Observação do semáforo/faixa registrada como experiência (`sourceType: 'direct_observation'`).
    3. Indexação vetorial imediata no Qdrant com metadados estruturados.
    4. Recuperação semântica via similaridade de cossenos no Qdrant.
    5. Tomada de decisão cognitiva orientada pela memória recuperada.
    6. Validação e execução de movimento pelo motor para a faixa de pedestres.
    7. Registro do desfecho e feedback em PostgreSQL e Qdrant (`sourceType: 'action_result'`).

### 3. Validação de Aceite
- **Suíte Completa:** `npx vitest run` — 9 arquivos de teste, **24 testes executados e 100% aprovados** (520ms no teste E2E).
- **Sincronismo de Schema:** `npm run check:schema-drift` — 100% alinhado entre SQL, Drizzle e Types.
- **Tipagem Estática:** `npm run typecheck` — 0 erros em todos os pacotes e aplicações.
- **Serviços Ativos:** PostgreSQL (porta 5433) e Qdrant (porta 6333) operando saudáveis via Docker.

---

## Task ID: bloco-3-ciclo-cognitivo-e-workers
- **Data:** 2026-10-18
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Estrutural & Operacional (Onda 2: Autonomia dos Agentes, Ciclo Deliberativo e Filas de Mensageria)

### 1. Resumo Executivo
Execução completa do **Bloco 03 (Onda 2 — Autonomia dos Agentes)**. O motor cognitivo foi integrado ao grafo LangGraph do `packages/agent-cognition`, ponderando memórias do Qdrant e contexto urbano para deliberar ações reais com persistência em PostgreSQL. Foi implementada a infraestrutura assíncrona de mensageria com BullMQ sobre o Redis 7 real, além do `CognitionWorker` gerenciando taxa, concorrência e tolerância a falhas (DLQ).

### 2. Entregas Realizadas
- **Task-004 (Conexão do Ciclo Cognitivo):**
  - Conectado `CognitionService` ao `CognitiveCycleManager` (`packages/agent-cognition`), orquestrado por StateGraph/LangGraph.
  - Implementada recuperação semântica no Qdrant das top-3 memórias pertinentes antes da deliberação.
  - Criada política deliberativa: rotinas urbanas mantêm execução determinística com `confidence: 0.85`, enquanto situações novas ou de baixa confiança deliberam via `LLMProviderAdapter` com incremento da métrica `metrics.increment('llm.calls')` e logs de auditoria `[AUDIT] [COGNITION]`.
  - Persistência automática da ação resultante no PostgreSQL (`agent_experiences` com `sourceType: 'action_result'`).
  - Testes unitários em `apps/api/src/modules/cognition/cognition.service.spec.ts` (2/2).
- **Task-005 (Infraestrutura BullMQ & Filas Redis):**
  - Instalação e configuração de `bullmq` e `ioredis` sobre o container `synapse-city-redis` (porta 6379).
  - Criado `packages/event-system/queues.ts` com as filas `cognition-queue`, `simulation-queue`, `learning-queue` e a Dead Letter Queue (`dlq-queue`).
  - Configurados retries com backoff exponencial (1s a 8s), retenção de falhas e registro de tempo de espera com `SystemQueues.recordWaitTime()` na métrica `queue.wait.time.ms`.
  - Testes de integração com Redis real em `tests/integration/queues.test.ts` (5/5).
- **Task-006 (Worker de Cognição Assíncrono):**
  - Implementado `CognitionWorker` em `packages/event-system/workers/cognition.worker.ts` consumindo `cognition-queue`.
  - Concorrência configurada para 5 jobs paralelos, com rate limiting local (60 chamadas/min).
  - Roteamento para Dead Letter Queue após 5 tentativas de falha (`queues.sendToDLQ`).
  - Testes de integração em `tests/integration/cognition-worker.test.ts` (2/2) validando processamento concorrente sob carga com latência média de 50-80ms (< 2s p95).

### 3. Validação de Aceite
- **Suíte Completa:** `npx vitest run` — **12 arquivos de teste, 33 testes executados e 100% aprovados** sem mocks de banco, vetor ou fila.
- **Sincronismo de Schema:** `npm run check:schema-drift` — 100% alinhado entre SQL, Drizzle e Types.
- **Tipagem Estática:** `npm run typecheck` — 0 erros no monorepo.
- **Serviços Operacionais:** PostgreSQL 16 (5433), Qdrant 1.12.1 (6333) e Redis 7 (6379) ativos e saudáveis.

---

## Task ID: bloco-visual-frontend-task-023-024
- **Data:** 2026-10-18
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Operacional & Performance (Higiene de Estado, Desacoplamento 60 FPS e Otimização Gráfica)

### 1. Resumo Executivo
Execução completa da **Opção B (Épico E — Higiene de Estado & Escala Visual)** do `task.md`. Foi eliminado o gargalo de re-renderização a 60 Hz no React através da introdução de um store reativo desacoplado com `useSyncExternalStore` e updates diretos de telemetria no DOM. A cena 3D foi otimizada com `THREE.InstancedMesh` para árvores e postes, e o shadow map foi balanceado para 2048x2048, reduzindo draw calls em mais de 75% e preparando o motor para dispositivos móveis e WebXR.

### 2. Entregas Realizadas
- **Task-023 (Store Externo & Fim do Re-render por Frame):**
  - Criado `apps/web-client/src/store/city-store.ts` com store pub/sub de alta performance e hook `useCityStore` baseado em `useSyncExternalStore`.
  - Refatorado `Player.tsx`: telemetria e velocidade despachadas diretamente para o store sem passar por callbacks de estado do React.
  - Refatorado `HUD.tsx`: subscrições seletivas finas (semáforo, dia/noite, observações) e injeção direta de texto em refs do DOM para coordenadas e velocímetro (`telemetryDOMSubscribers`).
  - Geração de `snapshotData` migrada de `useMemo` a 60 Hz para cálculo sob demanda ao clicar no botão de Snapshot.
  - `App.tsx` e `Canvas` agora permanecem estáveis sem re-renders a cada tick do loop de animação.
  - Testes unitários do store em `apps/web-client/src/store/city-store.spec.ts` (4/4).
- **Task-024 (Instancing & Otimizações Gráficas na CityScene):**
  - Implementado `THREE.InstancedMesh` em `apps/web-client/src/scenes/city-scene.ts` para árvores urbanas (19 troncos + 19 copas consolidados em 2 meshes instanciados com matrizes de transformação dedicadas).
  - Implementado `THREE.InstancedMesh` para postes de iluminação pública (mastros e hastes consolidados em 2 meshes instanciados).
  - Redução de resolução da sombra direcional de 4096 para 2048x2048 (`shadow.mapSize`), economizando 75% de VRAM sem perda perceptível de nitidez.
  - Preservação total de colliders físicos do Rapier e percepção semântica de objetos interativos.

### 3. Validação de Aceite
- **Suíte Completa:** `npx vitest run` — **13 arquivos de teste, 37 testes executados e 100% aprovados**.
- **Sincronismo de Schema:** `npm run check:schema-drift` — 100% alinhado entre SQL, Drizzle e Types.
- **Tipagem Estática:** `npm run typecheck` — 0 erros no monorepo.

---

## 2026-10-18 — Bloco de Segurança: Task-022 (Endurecimento de Segurança para Exposição Pública)

### 1. Contexto & Motivação
- A superfície da Synapse City necessitava de endurecimento rigoroso para suportar conexões da internet com garantias estritas do OWASP Top 10 e de `mandatory-secure-web-skills`:
  - Handshake do Socket.IO aberto sem autenticação ou com credenciais estáticas.
  - CORS permissive (`origin: '*'`).
  - Ausência de headers defensivos (CSP, anti-clickjacking, no-sniff).
  - Ausência de rate limiting em rotas HTTP e conexões WS.
  - Movimentos do avatar aceitos no servidor sem validação física (vulnerável a teletransporte forjado e atravessamento de edifícios).

### 2. Implementações Realizadas
- **Gestão de Segredos & Criptografia (mandatory-secure-web-skills):**
  - Implementado `apps/api/src/auth/jwt.util.ts`:
    - Resolução multi-tiered segura: variável de ambiente `JWT_SECRET` com fallback automático via CSPRNG de 256 bits (`crypto.randomBytes(32)`) e log de alerta explícito `[SECURITY] [WARN] Ephemeral secret generated. Instance-isolated!`.
    - Assinatura estrita com algoritmo fixo `HS256`, validação compulsória de `exp` e rejeição de algoritmo `none`.
  - Criado `apps/api/src/auth/auth.controller.ts` e `AuthService`:
    - Endpoint seguro `POST /auth/guest-token` para o cliente Web obter sessão legítima com papel `guest`.
    - Endpoint `POST /auth/admin-token` e `GET /auth/me` para autenticação do `Principal`.
- **Proteção HTTP & CORS:**
  - Registrado `@fastify/helmet` no Fastify com Content Security Policy restrito, anti-clickjacking (`X-Frame-Options: DENY` e `frame-ancestors: 'none'`) e `X-Content-Type-Options: nosniff`.
  - Registrado `@fastify/rate-limit` com limite derivado de `OPERATIONAL_LIMITS.maxHttpRequestsPerMinute` (120 req/min).
  - CORS restrito por allowlist configurável via `CORS_ALLOWED_ORIGINS` (sem wildcard `*`).
  - Network binding seguro: `127.0.0.1` em desenvolvimento e testes; `0.0.0.0` apenas sob flag de produção.
- **Endurecimento de WebSockets (`WorldGateway`):**
  - Middleware no handshake do Socket.IO (`/world` namespace) validando o token JWT. Conexões sem token ou com tokens forjados são rejeitadas com `AUTHENTICATION_FAILED`.
  - Rate limiting individual por socket derivado de `OPERATIONAL_LIMITS.maxSocketMessagesPerSecond` (30 msgs/s) com alerta auditável `[SECURITY] [AUDIT]`.
  - Controle de Acesso Baseado em Papéis (RBAC): Comando administrativo de semáforo (`traffic_light:set`) restrito exclusivamente ao papel `admin`. Tentativas por `guest` ou outros papéis são bloqueadas com erro `FORBIDDEN`.
- **Validação Física Server-Side de Movimentos (`city-colliders.ts`):**
  - Mapeamento autoritativo de colisores estáticos da cidade (`CITY_STATIC_COLLIDERS`) e limites territoriais (`CITY_BOUNDS`).
  - Função autoritativa `validateAvatarMovement`:
    1. Rejeita coordenadas fora dos limites da cidade ($|x| > 65$ ou $|z| > 65$).
    2. Rejeita ponto de destino dentro de colisor de edifício, mureta, fonte monumental ou obstáculo urbano.
    3. Rejeita atravessamento de paredes (*wall phasing*) por amostragem ao longo da trajetória.
    4. Rejeita saltos instantâneos anômalos de teletransporte ($> 20\text{ m}$).
    5. Rejeita velocidade calculada superior a `OPERATIONAL_LIMITS.maxAvatarSpeedMps` (15 m/s).
  - Ao detectar violação, o servidor registra log de auditoria `[SECURITY] [AUDIT]` e emite evento `avatar:correction` com rollback para a última posição autorizada, impedindo broadcast de movimentos forjados.
- **Cliente Web 3D (`App.tsx`):**
  - Inicialização com handshake autenticado: obtém token em `/auth/guest-token` e envia no `auth: { token }` do Socket.IO.
  - Listener para eventos de erro e `avatar:correction`.
- **Documentação de Segurança:**
  - Elaborado documento completo `docs/security/OWASP_TOP10_CHECKLIST.md` com análise e status de cada item do Top 10 reduzido.

### 3. Validação de Aceite
- **Suíte de Testes:** `npx vitest run` — **14 arquivos de teste, 57 testes executados e 100% aprovados** (incluindo 17 novos testes em `tests/integration/security.test.ts`).
---

## 2026-10-18 — Fechamento da Onda 2: Workers Server-Side & Colisões 3D Mútuas

### 1. Entregas Realizadas
- **Task-007 (SimulationWorker — Física & Anti-Speedhack):**
  - Implementado `packages/event-system/workers/simulation.worker.ts` processando `simulation-queue`.
  - Valida física autoritativa server-side, limites de velocidade e colisões estáticas de avatares e entidades.
  - Testes em `tests/integration/simulation-worker.test.ts` (4/4).
- **Task-008 (LearningWorker — Consolidação Passiva Noturna):**
  - Implementado `packages/event-system/workers/learning.worker.ts` processando `learning-queue`.
  - Sintetiza experiências episódicas em conhecimento semântico e promove poda de registros obsoletos de baixa relevância.
  - Testes em `tests/integration/learning-worker.test.ts` (3/3).
- **Colisões Mútuas 3D no Frontend (`vehicle-collision.spec.ts`):**
  - Corrigido o bug onde veículos e agentes atravessavam uns aos outros.
  - Implementada física de colisão com desaceleração suave e vetor de pushback anti-interpenetração em `TrafficSystem.tsx`.
  - Testes unitários em `apps/web-client/src/vehicles/vehicle-collision.spec.ts` (7/7).

---

## 2026-10-18 — Task-013: Popular 3-5 NPCs com Fase Meta de Consciência

### 1. Contexto & Motivação
- Necessidade de popular a cidade virtual com identidades persistentes, cobrindo os arquétipos canônicos (`guard`, `worker`, `citizen`, `child`, `elder`) mapeados aos avatares 3D do frontend de Lira (Vega, Sulafat, Sheliak, Chasoň, Epsilon).
- Garantir que cada NPC nasça com histórico (`backstorySeed`), metas cívicas (`activeGoals`) e memórias episódicas iniciais persistidas no PostgreSQL e indexadas semanticamente no Qdrant para consulta deliberativa.

### 2. Implementações Realizadas
- **Configuração Canônica dos Habitantes (`citizens.seed.ts`):**
  - `agent-vega` (`guard` — Pioneira & Navegadora de Segurança): Foco em segurança viária, semáforo e cumprimento da Lei 12.305/10.
  - `agent-sulafat` (`worker` — Cientista & Ecologista Urbana): Foco em gestão de resíduos sólidos e arborização urbana.
  - `agent-sheliak` (`citizen` — Engenheiro & Cidadão Ativo): Foco em infraestrutura viária e mobilidade fluida.
  - `agent-chason` (`child` — Jovem Mensageiro & Skatista): Foco em aprendizagem de sinalização e convivência pacífica em calçadas.
  - `agent-epsilon` (`elder` — Filósofo & Guardião da Memória): Foco em patrimônio cultural, convivência cívica e história da cidade.
- **Serviço de Habitantes & Ciclo de Vida (`citizens.service.ts`):**
  - Integrado `OnModuleInit` do NestJS chamando `seedDefaultCitizens()`.
  - Upsert idempotente de identidades em `agent_identities` (PostgreSQL).
  - Inserção idempotente de $\ge 3$ experiências episódicas por NPC em `agent_experiences` (`sourceType: 'direct_observation'`).
  - Indexação vetorial imediata no Qdrant com geração de embeddings (1536 dimensões) via `MemoryService.addMemory()`.
  - Adicionados métodos de consulta `getCitizenExperiences()` e `getCitizenMemories()`.
- **Suíte de Testes de Integração Real (`tests/integration/npc-seed.test.ts`):**
  - 4 testes validando persistência no PostgreSQL, cobertura de arquétipos, memórias episódicas e busca semântica no Qdrant com 100% de aprovação.
  - Validação estrita de idempotência (segunda execução não duplica identidades nem memórias).

### 3. Validação de Aceite
- **Suíte Completa:** `npx vitest run` — **19 arquivos de teste, 85 testes executados e 100% aprovados** (0 mocks em testes de integração de persistência e vetor).
- **Tipagem Estática:** `npm run typecheck` — 0 erros.
- **Sincronismo de Schema:** `npm run check:schema-drift` — 100% síncrono.

---

## 2026-10-18 — Task-025: Contrato Canônico Principal + AgentAction API e RBAC

### 1. Contexto & Motivação
- Decisão arquitetural central do roadmap: unificar todas as identidades que atuam na cidade (usuário humano, avatar, NPC autônomo, agente cognitivo e agente externo MCP) sob a abstração canônica de um `Principal`.
- Toda e qualquer ação no mundo deve transitar pelo mesmo contrato `AgentAction API` (`ActionRequest` -> `ActionResult`), permitindo que a mesma ação (`move`, `observe`, `speak`, `interact`, `traffic_control`) seja executada indistintamente via HTTP REST ou WebSocket, sob controle de acesso rigoroso por papéis (`RBAC`) e permissões.

### 2. Implementações Realizadas
- **Contratos e Tipos em `@cidade-virtual/types`:**
  - Definidos `PrincipalType` (`'human' | 'npc' | 'system' | 'external_agent'`) e `PrincipalRole` (`'admin' | 'citizen' | 'guest' | 'moderator'`).
  - Definidas interfaces `Principal`, `ActionRequest`, `ActionResult` e tabela `DEFAULT_ROLE_PERMISSIONS`.
  - Função auxiliar `createPrincipal(...)` para instanciação consistente com permissões herdadas de papéis e suporte a wildcard `*`.
- **RBAC Guard e Decorators no NestJS (`apps/api`):**
  - Implementado `RbacGuard` em `apps/api/src/common/guards/rbac.guard.ts` integrando com o `Reflector`.
  - Decorators `@RequireRoles(...)`, `@RequirePermissions(...)` e `@CurrentPrincipal()` em `apps/api/src/common/decorators/rbac.decorator.ts`.
  - Resolução transparente de `Principal` via token Bearer JWT ou corpo da requisição autenticada, disparando logs de segurança auditáveis `[SECURITY] [AUDIT] [RBAC]` e `ForbiddenException` / `UnauthorizedException` em caso de violação.
- **Módulo de Ações Unificadas (`ActionsModule`):**
  - Implementado `ActionsService` (`apps/api/src/modules/actions/actions.service.ts`):
    - Executa ações espaciais (`move`), perceptuais (`observe`), dialógicas (`speak`), interativas (`interact`), semafóricas (`traffic_control`) e cognitivas (`routine_navigation`, `llm_deliberated_action`).
    - Validação de física server-side, anti-colisão e limites territoriais via `validateAvatarMovement`.
    - Broadcast de eventos de domínio em tempo real no `WorldGateway`.
  - Implementado `ActionsController` (`apps/api/src/modules/actions/actions.controller.ts`) expondo `POST /actions/execute` e `POST /actions/move`.
- **Integração com WebSocket (`WorldGateway`):**
  - Implementado listener `@SubscribeMessage('agent:action')` que constrói o `Principal` autenticado do socket e delega diretamente ao `ActionsService.executeAction()`, garantindo paridade total entre REST e WebSocket.
- **Adapter do Grafo Cognitivo (`CognitiveCycleManager`):**
  - Implementado método `evaluateActionRequest()` em `packages/agent-cognition/index.ts` que converte deliberações do LangGraph diretamente em um `ActionRequest` canônico assinado pelo Principal do NPC.
- **Suíte de Testes de Integração e Contrato (`tests/integration/principal-actions.test.ts`):**
  - 10 testes cobrindo:
    1. Criação e herança de permissões de Principals (admin, citizen, guest).
    2. Rejeição de ações restritas (ex: `agent-vega` tentando `traffic_control`) com motivo auditável.
    3. Execução idêntica da ação `move` via REST API e Socket.IO Gateway.
    4. Rejeição física de colisão em ambos os canais.
    5. Integração com o grafo cognitivo do `CognitiveCycleManager`.

### 3. Validação de Aceite
- **Suíte Completa:** `npx vitest run` — **20 arquivos de teste, 95 testes executados e 100% aprovados**.
- **Tipagem Estática:** `npm run typecheck` — 0 erros em todos os projetos.
- **Sincronismo de Schema:** `npm run check:schema-drift` — 100% síncrono.

