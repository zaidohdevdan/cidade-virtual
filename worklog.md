# Worklog — Cidade Virtual de IAs Humanizadas

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

