# Worklog — Cidade Virtual de IAs Humanizadas

## Task: Desvio Ativo de Obstáculos para NPCs e Evasão por Buzina de Automóvel
- **Data:** 2026-10-19
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Física de Navegação Autônoma, IA Comportamental e Interação Veicular

### 1. Resumo Executivo
Atendimento pleno à demanda de evasão por buzina de veículos e desvio dinâmico de obstáculos pelos habitantes autônomos (NPCs):
1. **Desvio Proativo e Preditivo de Obstáculos (`computeAvoidanceSteering`)**:
   - Implementado algoritmo de sensoriamento preditivo por feixe de sensores (whiskers) em `agent-avatar.ts`.
   - O habitante projeta sensores de alcance dinâmico (`lookahead = 1.3m a 2.8m`) à frente. Caso detecte um obstáculo (prédio, poste, banco, árvore, veículo dinâmico ou outro cidadão), avalia ângulos alternativos de contorno ($\pm 30^\circ$, $\pm 50^\circ$, $\pm 75^\circ$, $\pm 100^\circ$, $\pm 125^\circ$).
   - Integrado campo repulsivo contínuo de proximidade para garantir que colisões em quinas e perímetros escorreguem suavemente por deslizamento tangencial sem travar ou penetrar.
2. **Reação Dinâmica à Buzina de Automóvel (`VehicleHornEvent` & `evadeVehicle`)**:
   - `VehicleAudioEngine` estendido com barramento pub/sub de eventos acústicos de buzina (`onHorn`, `emitHorn`) integrando posição, vetor direcional, alcance (24m) e ID do veículo.
   - Os veículos autônomos (`VehicleAgent`) acionam a buzina (`this.honk()`) com prioridade elevada (0.7s) quando pedestres ou o avatar Daniel bloqueiam a faixa de rolamento à frente.
   - Quando um carro buzina, todo NPC situado na trajetória ou proximidade da via ativa a rotina de fuga (`handleVehicleHorn`):
     - **Sair da frente:** Move-se lateralmente para fora do eixo de marcha do veículo em direção à calçada.
     - **Buscar local livre aleatório:** `findFreeRandomLocation` analisa até 24 pontos candidatos no raio seguro de 6m a 16m, rejeitando pistas asfálticas (`isRoadAsphalt === false`), colisões com prédios ou mobília urbana, e mantendo distância de segurança (> 6.5m) do veículo.
     - **Reação vocal e corrida rápida:** O habitante exclama contextualizadamente (ex: *"Opa! Buzina de carro, saindo da frente!"*), acelera a velocidade para passo de fuga acelerado (`1.65x`), atinge o local livre e descansa brevemente (2.0s) antes de retomar suas rotas.
3. **Validação de Testes**:
   - Suíte unitária `agent-avatar.spec.ts` expandida com 2 novos testes específicos de desvio de obstáculos e evasão completa por buzina com saída da pista veicular.
   - Suíte `apps/web-client`: 8 arquivos de teste e 46 testes aprovados (100% green).
   - Suíte raiz `tests/`: 22 arquivos e 112 testes aprovados (100% green).

---

## Task: Refatoração do Chat (Canto Padrão) e Remoção de Balões de Nomes dos NPCs
- **Data:** 2026-10-19
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** UX / Interface Conversacional e Limpeza Visual da Cena 3D

### 1. Resumo Executivo
Atendimento à solicitação de desobstrução visual e ajuste ergonômico da interface de diálogo e do campo de visão da cidade 3D:
1. **Remoção dos Balões Estáticos Flutuantes de Nomes dos NPCs (`AgentAvatar` & `style.css`)**:
   - Desativados os elementos HTML flutuantes gerados em `this.label` no `agent-avatar.ts` (`✦ NOME DO NPC / Designação Estelar / Cargo`), que ficavam permanentemente projetados sobre os 7 NPCs na cena 3D e se aglomeravam na praça/vias.
   - Atualizado `style.css` com `.agent-label { display: none !important; }` para blindagem contra renderização.
   - Atualizado `updateLabel()` para não reativar `this.label.style.display = 'block'`.
   - O balão de fala dinâmico (`speechBubble`) permanece ativo exclusivamente durante emissões de diálogo real (`agent.say()`) quando o jogador está próximo.
   - Atualizada a suíte de testes `agent-avatar.spec.ts` para verificar que balões estáticos não são anexados ao DOM e que a limpeza no `dispose()` é preservada.
2. **Reposicionamento do Chat no Canto Padrão de Aplicações/Jogos (`DialogueModal.tsx`)**:
   - Eliminado o overlay fullscreen escuro opaco (`inset: 0`, `backgroundColor: rgba(5, 10, 20, 0.65)` e `backdropFilter: blur(8px)`) que bloqueava a visualização do mundo 3D.
   - O diálogo agora é renderizado como widget de chat compacto e moderno no **canto inferior direito** (`bottom: 20px; right: 20px; width: 380px; height: 520px; max-height: calc(100vh - 40px)`).
   - Glassmorphism refinado (`rgba(15, 23, 42, 0.94)`, borda `rgba(56, 189, 248, 0.35)`, sombra com glow ciano e animação `chatSlideIn`).
   - Fechamento ergonômico por botão `✕`, tecla `Escape` e clique fora do card (clicar no mundo 3D fecha o chat).
   - Chips compactos de perguntas rápidas, histórico rolável e input responsivo com envio via `Enter`.
3. **Desobstrução do HUD (`App.tsx`)**:
   - `nearbyAgent` é temporariamente silenciado no HUD enquanto o chat estiver aberto, impedindo sobreposição do card "Pressione E para conversar".
4. **Validação de Testes**:
   - `npx vitest run apps/web-client`: 8 arquivos e 44 testes aprovados (100% green).
   - Monorepo completo (`npx vitest run`): 44 arquivos de teste e 251 testes aprovados (100% green).

---

## Task: Task-040 — Mundo que afeta a mente: clima, hora e tráfego no decisor
- **Data:** 2026-10-19
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Cognição Ecológica, Física do Mundo e Decisão Autônoma

### 1. Resumo Executivo
Implementação da interação ecológica do ambiente sobre o circuito cognitivo dos habitantes autônomos. As condições físicas do mundo (clima, relógio solar e tráfego veicular) deixam de ser puramente cosméticas e passam a moldar dinamicamente o decaimento fisiológico de necessidades e as utilidades marginais de ação:
1. **Extensão Canônica da Percepção (`Percept`)**:
   - `packages/agent-planning/autonomy/types.ts` estendido com `weather` (`clear`, `rain`, `storm`, `fog`, `snow`), `timeOfDay` (0..24), `trafficDensity` (0..1) e `vehicles` (`PerceivedVehicle[]`).
   - `WorldEntity` e `ActionCandidate` enriquecidos com a propriedade física `hasCover` (presença de teto/cobertura contra intempéries).
   - Inclusão da affordance contextual `shelter` nas entidades cobertas (`cafe-bistro`, `market-central`, `bus-stop-west`).
2. **Fisiologia e Decaimento sob Pressão Ambiental (`needs.ts`)**:
   - `needWeights(p, env)` modula os pesos vitais: de noite (`timeOfDay >= 20 || timeOfDay < 6`), o multiplicador de `energy` é elevado para 2.5x, tornando o repouso urgente; sob chuva ao ar livre, a aversão/carência de `fun` é ampliada em 1.6x.
   - `decayNeeds(needs, p, dtSeconds, env)`: acelera o consumo de energia à noite (1.8x, sono acumulado) e drena diversão/humor sob chuva desabrigada (2.2x).
   - `mostPressingNeed(needs, p, env)`: garante fisiologicamente que à noite, com necessidades basais equilibradas, a necessidade prioritária selecionada é `'energy'` (orientando o comportamento de `rest`).
3. **Física Global do Decisor de Utilidade (`utility-decider.ts`)**:
   - Criação da função pura `calculateEnvironmentalModifier(cand, percept)`:
     - **Chuva / Tempestade:** Bônus expressivo (`+0.55` a `+0.82`) para alvos cobertos (`hasCover = true` / affordance `shelter`) e penalidade severa (`-0.60` a `-0.90`) para exposição a céu aberto (bancos na praça, fontes, travessias).
     - **Noite:** Bônus ambiental de repouso (`+0.45` para affordance `rest`) e desestímulo a atividades externas como `explore` (`-0.35`) e `shop` (`-0.30`).
     - **Segurança e Tráfego:** Penalidade de segurança proporcional à proximidade imediata de veículos em movimento (`minDist < 6m`) e fluxo denso na pista (`trafficDensity > 0.4`), favorecendo calçadas protegidas e interiores.
   - O modificador entra no `score` final e no breakdown auditável `{ environmentalModifier }`.
4. **Neutralidade e Regras Universais**:
   - Nenhuma regra depende de `agentId`, arquétipo ou nome de habitante. As regras ambientais são leis físicas globais da simulação de Synapse City, iguais para todos.
5. **Integração no Runtime Autoritativo (`simulation.service.ts` e `cognition.service.ts`)**:
   - A cada tick, `SimulationService` consulta o estado real do mundo em `WorldService.getWorldState()` e alimenta `agent.mind.update(dt, { weather, timeOfDay })` e o `Percept`.
6. **Validação de Testes**:
   - Suíte unitária dedicada criada em `tests/unit/world-modifiers.test.ts` (11 testes, 100% aprovados).
   - Testes integrados no pacote `@cidade-virtual/agent-planning/autonomy.spec.ts` (27 testes aprovados).
   - Suíte raiz (`npx vitest run tests/`): 22 arquivos, 112 testes aprovados (100% green) em 9.83s.
   - Monorepo completo (`npm test`): 26/26 projetos aprovados.

---

## Task: Task-016 — Expandir cobertura de testes
- **Data:** 2026-10-19
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Qualidade Contínua, Resiliência e Prevenção de Regressões

### 1. Resumo Executivo
Expansão massiva da suíte de testes automatizados do monorepo, elevando a cobertura para 21 arquivos de teste e 101 testes executados (100% green), com novas suítes unitárias, de integração e ponta a ponta (E2E) cobrindo schemas, ciclo cognitivo, event bus, persistência de cidadãos e snapshots do mundo:
1. **Validação de Schemas Zod e Ferramentas (`tests/unit/tools.test.ts` e `packages/tools/tools.spec.ts`)**:
   - 17 testes na suíte raiz + 9 testes no pacote `@cidade-virtual/tools`.
   - Cobertura estrita dos 8 schemas canônicos da cidade: `createCitizenSchema`, `triggerEventSchema`, `getNPCMemorySchema`, `setEmotionStateSchema`, `requestHumanReviewSchema`, `weatherSetConditionSchema`, `npcBroadcastAlertSchema` e `getSceneSnapshotSchema`.
   - Rejeição de valores fora de faixa, coordenadas inválidas, enums desconhecidos e campos obrigatórios faltantes.
   - Validação da factory `createTool` e execução tipada.
2. **Ciclo Cognitivo e Deliberação (`tests/unit/cognitive-cycle.test.ts`)**:
   - 4 testes unitários cobrindo o `CognitiveCycleManager`.
   - Teste com LLM mockado deliberando ações com raciocínio e fala estruturados.
   - Teste de fallback defensivo em caso de falha ou erro no provedor de LLM.
   - Validação de emissão de `ActionRequest` assinado com identidade de `Principal` e telemetria de auditoria.
3. **Event Bus e Mensageria Assíncrona (`tests/unit/event-bus.test.ts`)**:
   - 4 testes unitários cobrindo pub/sub em memória.
   - Suporte a múltiplos handlers assíncronos disparados em paralelo para o mesmo tópico de domínio.
   - Segregação de tópicos e imunidade a falhas (um handler que lança exceção não derruba os demais).
   - Despacho idempotente em tópicos vazios.
4. **Ciclo de Vida de Habitantes (`tests/integration/citizens.test.ts`)**:
   - Adição do teste de ciclo de vida completo: criação de cidadão (`createCitizen`), alteração de humor/emoção (`setEmotionState`) e listagem filtrada (`listCitizens`), persistido de ponta a ponta no PostgreSQL real.
5. **Snapshot E2E do Mundo (`tests/e2e/snapshot.test.ts`)**:
   - 4 testes E2E validando a ferramenta `getSceneSnapshotTool` consumindo os dados reais do banco PostgreSQL.
   - Validação estrutural do schema de `SceneSnapshot` (população ativa, clima atual, anomalias, histórico de eventos).
   - Reatividade comprovada a mutações climáticas no banco.
6. **Estabilização de Concorrência e CI**:
   - Criação do `vitest.config.ts` com `testTimeout: 30000` e `hookTimeout: 30000` na raiz.
   - Isolamento de conexões no teste de persistência para evitar encerramento prematuro de pool compartilhado.
   - Atualização do `.github/workflows/ci.yml` incluindo `@cidade-virtual/tools` no job de validação e atualizando o contador para 21 arquivos / 101 testes.
7. **Métricas Finais**:
   - `npx vitest run tests/`: 21/21 arquivos aprovados, 101/101 testes verdes em 6.74s.
   - `npm test`: 26/26 projetos Nx aprovados (100%).
   - `npm run check:schema-drift`: 100% sincronizado (zero drift).
   - `npx nx run-many -t lint --all`: 25/25 projetos sem erros.
   - `npx nx run-many -t build --all`: 25/25 projetos construídos com sucesso.

---

## Task: Motor de Autonomia Real e Emergente dos Agentes (Fase 1: A1 a A6)
- **Data:** 2026-10-19
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Cognição, Percepção Espacial e Arquitetura de Agentes Autônomos

### 1. Resumo Executivo
Substituição definitiva de rotas, waypoints e tarefas pré-fixadas por um ecossistema de **autonomia real e emergente**, onde os habitantes decidem para onde ir e o que fazer por conta própria a partir de necessidades internas, personalidade e affordances do ambiente:
1. **Registro de Affordances do Mundo Físico (`packages/agent-planning/autonomy/world-affordances.ts`)**:
   - Catálogo canônico de entidades urbanas de Synapse City com coordenadas físicas 3D reais (fonte monumental, bancos de descanso da praça, mercado central, mesas do café bistro, ponto de ônibus, canteiros floridos, árvores e placas).
   - Cada entidade expõe suas *affordances* naturais (`rest`, `eat`, `socialize`, `observe`, `contemplate`, `shop`, `explore`) sem pertencer a nenhum agente.
2. **Dinâmica Contínua de Necessidades Internas (`packages/agent-planning/autonomy/needs.ts`)**:
   - 5 necessidades biológicas e psicológicas fundamentais (`energy`, `hunger`, `social`, `curiosity`, `fun`).
   - Decaimento contínuo modulado pelos traços de personalidade Big Five (ex.: agentes extrovertidos sentem carência social mais rápido; abertos à experiência demandam mais novidade).
   - Efeitos físicos universais restauradores ao utilizar as affordances.
3. **Decisor por Utilidade e Anti-Repetição (`packages/agent-planning/autonomy/utility-decider.ts`)**:
   - Geração dinâmica de candidatos de ação a partir de entidades e atores percebidos no raio físico.
   - Pontuação por ganho de utilidade marginal (com urgência exponencial para déficits severos de fome/energia), custo de locomoção atenuado e bônus de novidade / fadiga de repetição (evita ficar preso ao mesmo local).
4. **Deliberação Estruturada com LLM (`packages/agent-planning/autonomy/llm-deliberator.ts`)**:
   - LLM recebe contexto de necessidades, personalidade e opções de alto valor, decidindo via JSON estruturado `{ chosenCandidateId, reason, speech }`.
   - A decisão do LLM ou da utilidade determina diretamente o destino e a ação executada.
5. **Mente Individual do Habitante (`packages/agent-planning/autonomy/agent-mind.ts`)**:
   - Encapsula necessidades, histórico de visitas, afinidades sociais e execução temporal de atividades (ex.: sentar no banco por 3 ticks para descansar).
6. **Integração no Motor de Simulação (`simulation.service.ts`)**:
   - Remoção de `URBAN_DESTINATIONS` em ciclo fixo.
   - Percepção espacial real computada a cada tick (entidades próximas, avatar Daniel, outros agentes, semáforo).
   - Inclusão dos 7 cidadãos canônicos (`ALL_CITIZENS`) no runtime autoritativo.
   - Falas espontâneas contextuais geradas pela intenção ativa, sem tabelas estáticas de switch por ID.

7. **Validação de Testes e Tipos**:
   - Novos testes unitários (`autonomy.spec.ts`): 7/7 aprovados.
   - Suíte de simulação (`simulation.service.spec.ts`): 4/4 aprovados.
   - Suíte completa do monorepo: 25/25 projetos aprovados (100%).
   - `npm run typecheck`: 0 erros.

---

## Task: Manobras Ativas de Desvio e Contorno de Obstáculos (OBSTACLE_BYPASS)
- **Data:** 2026-10-19
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Física de Veículos e Inteligência Coletiva de Trânsito

### 1. Resumo Executivo
Implementação do comportamento de ultrapassagem/contorno autônomo de obstáculos (`OBSTACLE_BYPASS`) para os veículos do tráfego urbano:
1. **Detecção Dinâmica de Bloqueio**:
   - Quando um carro fica retido por um obstáculo (outro veículo quebrado/parado ou um agente/pedestre na pista) por mais de 2.0s, o veículo transiciona automaticamente para o estado `OBSTACLE_BYPASS`.
2. **Avaliação Espacial Lateral (`chooseBypassSide` e `canBypassObstacle`)**:
   - O veículo analisa a geometria da via e os limites das guias (meio-fio $X \in [-6.2, 6.2]$).
   - Verifica a presença de outros veículos, agentes e pedestres à esquerda e à direita para escolher o lado de ultrapassagem mais desimpedido e seguro.
3. **Manobra Preparatória de Ré com Pisca-Alerta**:
   - Caso o veículo esteja muito próximo do obstáculo ($< 1.8\text{m}$), realiza uma ré curta de abertura de raio de giro ($\approx 2.2\text{m}$) com pisca-alerta ativado.
4. **Trajetória em Curva Bézier Cúbica (`buildBypassArc`)**:
   - Gera um arco suave de 4 pontos de controle com desvio lateral de até $2.4\text{m}$ e retorno à pista $12\text{m}$ adiante.
   - Aciona a seta do lado do desvio (esquerda ou direita) durante a primeira metade da manobra.
   - Ao ultrapassar o obstáculo (progresso $> 55\%$), troca a seta para o lado de retorno à pista e reassume a linha central da faixa original suavemente.
5. **Prevenção de Falso Travamento Sensorial**:
   - Durante a manobra `OBSTACLE_BYPASS`, o veículo ignora o obstáculo contornado em seu cone frontal para não engasgar a aceleração na curva, garantindo velocidade contínua até o reingresso seguro.
6. **Validação de Testes**:
   - Suíte `vehicle-collision.spec.ts`: 12/12 testes aprovados (100%).
   - Suíte completa do monorepo: 25/25 projetos aprovados (100%).
   - `npm run typecheck`: 0 erros.

---

## Task: Voz dos Atores — Síntese TTS no Navegador com Web Speech API (Passo 2)
- **Data:** 2026-10-19
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Sensorial / Áudio e Imersão Client-Side (Web Speech API)

### 1. Resumo Executivo
Implementação do sistema client-side de síntese de voz (TTS) audível em Português (`pt-BR`) utilizando a Web Speech API (`window.speechSynthesis`) nativa dos navegadores:
1. **Perfis Acústicos Distintos por Cidadão (`apps/web-client/src/audio/speech-synth.ts`)**:
   - Calibração de `pitch`, velocidade (`rate`), gênero e timbres para os 7 cidadãos canônicos:
     - **Vega:** Pitch 1.15, Rate 1.05, Voz feminina assertiva e firme (Arquiteta Urbana).
     - **Sulafat:** Pitch 0.88, Rate 0.95, Voz masculina ponderada, calma e zelosa (Zelador Urbano).
     - **Sheliak:** Pitch 1.05, Rate 1.15, Voz neutra, dinâmica e analítica (Técnico de Mobilidade).
     - **Chason:** Pitch 1.25, Rate 1.15, Voz jovem, acelerada e animada (Estudante e Skatista).
     - **Epsilon:** Pitch 0.72, Rate 0.82, Voz madura, grave, pausada e reflexiva (Idoso e Filósofo).
     - **Aladfar:** Pitch 0.95, Rate 0.95, Voz suave e contemplativa (Artista Urbano).
     - **Xihe:** Pitch 1.12, Rate 1.08, Voz feminina expressiva, clara e curiosa (Entusiasta Botânica).
2. **Higienização Acústica (`cleanText`)**:
   - Remoção de emojis, símbolos Unicode, seletores de variação (`\uFE0F`), zero-width joiners (`\u200D`) e marcações Markdown para evitar leitura indesejada de códigos ou descrições como "emoji de carro".
3. **Integração com Movimentação e Diálogos**:
   - Conectado diretamente a `AgentAvatar.say(message)`: qualquer mensagem de fala espontânea por proximidade física ou resposta deliberada por LLM no `DialogueModal` e eventos de rede (`agent.speech`) é pronunciada audivelmente.
4. **Controles de Áudio no HUD e Teclado**:
   - Botão interativo no HUD (`id="btn-audio-mute"`): `🔊 Voz: Ativa` / `🔇 Voz: Mudo` com feedback visual dinâmico.
   - Tecla de atalho `[M]` para silenciar/reativar imediatamente o áudio durante a exploração.
   - Cancelamento imediato de falas ativas ao silenciar.
5. **Validação de Aceite**:
   - `npm run typecheck`: **0 erros de tipagem** em todos os projetos.
   - `npx vitest run --fileParallelism=false`: **27 arquivos de teste, 141 testes executados e 100% aprovados** (0 falhas).

---

## Task: Conectar LLM Real no Cérebro dos Agentes (Autonomia 65% ➔ 95%)
- **Data:** 2026-10-19
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Cognitivo / Inteligência Generativa e Diálogos em Tempo Real

### 1. Resumo Executivo
Implementação completa e integração da camada de adaptadores de Large Language Models (`@cidade-virtual/llm-adapters`) conectada aos cérebros cognitivos dos habitantes da Cidade Virtual:
1. **Arquitetura Desacoplada (`packages/llm-adapters/`)**:
   - `GeminiLLMAdapter`: Integração nativa com a API do Google Gemini (`gemini-2.0-flash` padrão, controle de temperatura por arquétipo, timeout com AbortController).
   - `OpenAILLMAdapter`: Suporte a endpoints OpenAI e OpenRouter (`https://openrouter.ai/api/v1`). Integração com modelos ultra-rápidos e gratuitos (`liquid/lfm-2.5-2.6b:free`) com fallback automático de modelos descontinuados (`qwen/qwen2.5-coder:free` e `nemotron`).
   - `OllamaLLMAdapter`: Suporte a modelos locais para execução offline.
   - `createDefaultLLMAdapter()`: Factory inteligente com priorização automática de variáveis de ambiente (`GEMINI_API_KEY` -> `OPENAI_API_KEY` -> `OLLAMA_BASE_URL` -> fallback heurístico gracioso).
2. **Integração no Ciclo Cognitivo (`CognitionModule` e `CognitionService`)**:
   - Injeção do token `'LLM_ADAPTER'` no NestJS.
   - Método `generateConversationalDialogue()` que recupera memórias semânticas no Qdrant, injeta a persona/biografia do habitante, o estado urbano (semáforo, horário) e a fala do usuário para sintetizar respostas ricas e contextualizadas.
   - Validação da política de rotina: ações rotineiras de deslocamento na calçada executam em tempo ultrarrápido (~100ms via política de rotina), reservando o processamento do LLM para deliberações genuínas e conversações interativas com o jogador.
3. **Resolução de Erros e Sincronização dos 7 Cidadãos**:
   - Adicionados os 2 cidadãos adicionais (`Aladfar` e `Xihe`) em `citizens.seed.ts`, sanando o erro "Habitante não encontrado. Aladfar".
   - Todos os 7 habitantes agora possuem identificação, arquétipo, rotas e capacidade de deliberação cognitiva ativa.
4. **Validação de Aceite**:
   - `npm run typecheck`: **0 erros de tipagem** em todos os projetos.
   - `npx vitest run --fileParallelism=false`: **26 arquivos de teste, 133 testes executados e 100% aprovados** (0 falhas).

---

## Task: Motor de Autonomia Urbana — AutonomousSimulationService e Sincronização em Tempo Real
- **Data:** 2026-10-19
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Operacional / Simulação e Vida Autônoma em Tempo Real

### 1. Diagnóstico e Causa-Raiz
Uma auditoria técnica rigorosa identificou por que a cidade continuava aparentando ter apenas NPCs sem autonomia após as etapas anteriores:
1. **Ausência de Heartbeat/Ticker no Servidor**: Os módulos cognitivos (`CognitionService`, `GoalPlanner`, `NavigationService`, LangGraph e memórias Qdrant) foram implementados e aprovados nos testes unitários/integrados, mas **não havia nenhum serviço contínuo de simulação em execução no processo da API (`apps/api`)**. O servidor subia, semeava os habitantes no PostgreSQL e ficava passivo, alternando apenas o semáforo.
2. **Frontend em Modo Fallback Local**: Como o backend nunca emitia os eventos `agent.moved` ou `agent.speech`, os avatares 3D no cliente Three.js caíam no fallback local de uma patrulha triangular estática de 3 pontos hardcoded (`patrolPoints`), parecendo NPCs mecânicos.
3. **Desconexão do Loop de Deliberação**: Ninguém invocava `CognitionService.processCycle()` ou `NavigationService.findPath()` durante o runtime normal de `npm run dev`.

### 2. Implementações Realizadas
1. **`AutonomousSimulationService` (`apps/api/src/modules/simulation/`)**:
   - Serviço injetado no ciclo de vida do NestJS (`OnModuleInit`/`OnModuleDestroy`).
   - Inicializa a NavMesh Recast WASM no bootstrap do servidor.
   - Mantém estado em runtime dos habitantes canônicos (posição, destino, waypoints, pensamentos).
   - Executa um loop contínuo de simulação (heartbeat a cada 3.5 segundos).
   - A cada tick:
     - Incrementa o tick do mundo via `WorldService.incrementTick()`.
     - Sincroniza o estado semafórico na NavMesh do servidor.
     - Seleciona ciclicamente um habitante para deliberação ativa.
     - Invoca `CognitionService.processCycle()` com recuperação de memórias semânticas no Qdrant e decomposição hierárquica via `GoalPlanner`.
     - Calcula rota urbana inteligente e contorno de obstáculos via `NavigationService.findPath()`.
     - Transmite em tempo real via WebSocket (`WorldGateway.broadcastDomainEvent`):
       - `agent.moved`: Com a coordenada calculada do waypoint, fazendo o avatar 3D navegar intencionalmente.
       - `agent.speech`: Com o pensamento ou fala contextual do arquétipo, acionando o balão flutuante estilizado de vidro (`agent-speech-bubble`) no 3D.
     - Persiste a posição e as experiências deliberadas no PostgreSQL.
2. **`SimulationModule`**: Registrado em `app.module.ts`, integrando `PersistenceModule`, `GatewayModule`, `CognitionModule`, `CitizensModule` e `WorldModule`.
3. **Isolamento de Testes**: Configurado para operar em modo desacoplado sob testes Vitest, evitando conflito de filas ou concorrência com os testes de integração.
4. **Suporte de Tipagem**: Adicionado triple-slash directive em `navigation.service.ts` para resolver os tipos Recast em compilações do TypeScript.

### 3. Validação de Aceite
- `npm run typecheck`: **0 erros de tipagem** em todos os projetos (apps/api e apps/web-client).
- `npx vitest run --fileParallelism=false`: **25 arquivos de teste, 123 testes executados e 100% aprovados** (0 falhas).

---

## Task: Task-015 — NavigationService com Recast Navigation e NavMesh
- **Data:** 2026-10-18
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Estrutural / Espacial e Simulação 3D (NavMesh, Pathfinding, Reatividade Semafórica)

### 1. Resumo Executivo
Substituição integral do stub de `NavigationService` em `@cidade-virtual/world-engine` por um motor canônico de navegação 3D baseado em Recast Navigation WASM (`recast-navigation` e `@recast-navigation/generators`):
1. **Geração Procedural de NavMesh (`geometry-builder.ts`)**: Conversão do relevo urbano e dos obstáculos sólidos da cidade (`Mercado_Municipal`, `Edificio_Norte`, `Cafe_Avenida`, `Praca_Monumento_Fonte`) em malha triangular indexada compatível com o Recast (`generateSoloNavMesh`).
2. **Anti-Transposição de Paredes e Edifícios**: Os NPCs utilizam pathfinding real (`NavMeshQuery.computePath`). Rotas entre lados opostos de um quarteirão contornam as quinas externas dos edifícios pelo passeio público, eliminando a transposição cega através de paredes.
3. **Validação de Posições (`isNavigable`)**: Rejeita posições interiores de obstáculos sólidos estáticos e suporta obstáculos dinâmicos (`addDynamicObstacle`), como veículos ou barreiras temporárias.
4. **Reatividade Semafórica e Segurança Viária**: Quando o semáforo veicular está verde (`trafficLightState === 'green'`), a travessia na faixa de pedestres central é bloqueada; o pathfinding recalcula a rota (`recalculatedDueToSignal: true`), conduzindo o pedestre para a calçada de espera segura antes do meio-fio (`x = ±8.0m`). Quando o sinal veicular fica vermelho (`trafficLightState === 'red'`), a faixa é liberada e a travessia prossegue normalmente (`crosswalkIncluded: true`).

### 2. Implementações Realizadas
- `packages/world-engine/types.ts`: Tipos `Vector3Like`, `NavMeshGeometryInput`, `ObstacleBox`, `ObstacleCylinder`, `SceneObstacle`, `DynamicObstacle`, `PathfindingOptions`, `PathfindingResult`.
- `packages/world-engine/geometry-builder.ts`: Construtor procedural de geometria de solo e obstáculos sólidos (`SYNAPSE_CITY_STATIC_OBSTACLES`, `buildMeshFromObstacles`).
- `packages/world-engine/navigation.service.ts`: `NavigationService` completo com Recast Navigation WASM, `findPath`, `isNavigable`, `getClosestPoint`, `addDynamicObstacle` e reatividade ao semáforo.
- `packages/world-engine/recast.d.ts`: Declarações de tipo TypeScript de alta fidelidade para `recast-navigation` e `@recast-navigation/generators` sob `NodeNext`.
- `packages/world-engine/package.json`: Adicionadas dependências `@recast-navigation/core` e `@recast-navigation/generators`.
- `packages/world-engine/tsconfig.json`: Estendido de `tsconfig.base.json`.
- `packages/world-engine/navigation.service.spec.ts`: 5 testes unitários cobrindo navegação, contorno de edifícios, obstáculos dinâmicos e semáforo.
- `tests/unit/navigation.test.ts`: 2 testes de conformidade com os critérios de aceite do marco.

### 3. Validação de Aceite
- `npx vitest run --fileParallelism=false`: **24 arquivos de teste, 120 testes executados e 100% aprovados** (0 falhas).
- `npm run typecheck`: **0 erros de tipagem** em todos os projetos.
- `npm run check:schema-drift`: 100% alinhado.

---
- **Data:** 2026-10-18
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Estrutural / Cognitivo e Planejamento Hierárquico (HTN, LLM, Memória Procedural)

### 1. Resumo Executivo
Substituição integral do stub anterior de planejamento por um subsistema canônico completo em `@cidade-virtual/agent-planning`. O `GoalPlanner` agora suporta:
1. **Decomposição Hierárquica (HTN)**: Metas de alto nível (ex: "ir à praça") são decompostas em sequências operacionais ordenadas de ≥4 passos distintos (`observe_environment`, `navigate_to_waypoint`, `avoid_obstacles`, `cross_pedestrian_walkway`, `arrive_at_destination`), contemplando navegação, contorno de obstáculos e respeito a faixas de pedestres.
2. **Memória Procedural (`InMemoryProceduralMemoryStore`)**: Cache de estratégias e planos eficazes. Ao registrar execução bem-sucedida (`recordPlanSuccess`), o histórico é atualizado (`successCount++`, `executionsCount++`) e a confiança (`confidence`) é elevada (ex: 0.75 → 0.90), retornando com estratégia `'procedural_cache'`.
3. **Plano de Contingência e Replanejamento (`PlanRevisionService`)**: Reação ativa diante de falhas, injetando desvios (`avoid_obstacle_detour`) sob obstruções e passos de espera (`wait_for_green_signal`) diante de semáforo fechado.
4. **Deliberação LLM (`llmAdapter`)**: Fallback deliberativo para metas abertas e complexas com geração estruturada JSON.
5. **Políticas de Arquétipo e Avaliação (`BehaviorPolicy` e `PlanEvaluator`)**: Filtragem de metas coerentes com os arquétipos dos habitantes e métricas de progresso de execução.
6. **Integração no Ciclo Cognitivo (`CognitionService`)**: Conexão com o `CognitionService` do NestJS para decompor `context.activeGoal` e enriquecer o contexto de deliberação dos habitantes.

### 2. Implementações Realizadas
- `packages/agent-planning/types.ts`: Tipos canônicos `PlanStep`, `Plan`, `PlanStrategy`, `PlanStatus`, `ProceduralMemoryStore`, `GoalPlanningOptions`, `PlanRevisionRequest`, `BehaviorPolicyRule`.
- `packages/agent-planning/memory-store.ts`: `InMemoryProceduralMemoryStore` com normalização fonética/diacrítica de chaves (`normalizeGoalKey`).
- `packages/agent-planning/htn-decomposer.ts`: `HTNDecomposer` para praça, patrulha, trabalho, comércio e genérico.
- `packages/agent-planning/plan-revision.ts`: `PlanRevisionService` com injeção de contingência.
- `packages/agent-planning/behavior-policy.ts`: `BehaviorPolicy` com regras de arquétipos.
- `packages/agent-planning/plan-evaluator.ts`: `PlanEvaluator` com cálculo de progresso e viabilidade.
- `packages/agent-planning/goal-planner.ts`: `GoalPlanner` orquestrador unificado.
- `packages/agent-planning/goal-planner.spec.ts`: 11 testes unitários cobrindo HTN, cache procedural, revisão e LLM.
- `tests/unit/goal-planner.test.ts`: 3 testes de conformidade com os critérios de aceite do marco.
- `apps/api/src/modules/cognition/cognition.service.ts`: Integração com `goalPlanner` na resolução do ciclo cognitivo.

### 3. Validação de Aceite
- `npx vitest run`: **22 arquivos de teste, 113 testes executados e 100% aprovados** (0 falhas).
- `npm run typecheck`: **0 erros de tipagem** em todos os projetos.
- `npm run check:schema-drift`: 100% alinhado.

---
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

---

## 2026-10-18 — Task-026B: Ciclo Autônomo dos NPCs no Frontend (WebSockets & Balões de Fala)

### 1. Contexto & Motivação
- Com a persistência dos 5 NPCs canônicos (Task-013) e o contrato unificado `AgentAction API` (Task-025), era necessário conectar o motor gráfico Three.js/R3F do frontend (`apps/web-client`) para refletir a autonomia dos habitantes em tempo real.
- O cliente precisava deixar de ser apenas um loop de patrulha cego e passar a reagir dinamicamente a comandos de deslocamento server-side (`agent.moved`), comunicação verbal/pensamento (`agent.speech`, `npc.alert`) e sinalização semafórica de pedestres na Avenida Central.

### 2. Implementações Realizadas
- **Comunicação e Expressão nos Avatares (`agent-avatar.ts`):**
  - Implementado método `say(message, durationSeconds = 4.0)` com balões de fala/pensamento flutuantes em glassmorphism moderno (`rgba(15, 23, 42, 0.90)`), bordas translúcidas e animações suaves de entrada/saída.
  - Projeção tridimensional na tela em `updateLabel(camera, renderer)` logo acima da tag de identificação do habitante.
  - Limpeza automática de elementos DOM no `dispose()`.
- **Navegação Orientada pelo Servidor (`setTargetPosition` & `stopMovement`):**
  - O avatar agora aceita `targetPosition: THREE.Vector3 | null` emitido pelo servidor.
  - Prioriza a navegação orientada pelo backend com rotação angular suave (`lerp`), velocidade dinâmica e animação proporcional dos membros (`walkCycleTime`). Ao atingir o objetivo, conclui o trajeto e retoma pausas ou rotinas locais.
- **Reação Cívica e Viária ao Semáforo:**
  - O método `update(delta, colliders, trafficLightState)` agora recebe o estado autoritativo do semáforo municipal.
  - Quando um agente se aproxima da faixa de pedestres central e o sinal veicular está verde (`trafficLightState === 'green'`), ele interrompe a travessia e aguarda na calçada (`isWaitingAtCrosswalk = true`), retomando a marcha com segurança quando o sinal fecha para veículos (`'red'`).
- **Sincronização em Tempo Real (`App.tsx` & `Agents.tsx`):**
  - Registrados listeners de `world:event` no Socket.IO:
    - `agent.moved`: localiza o `AgentAvatar` pelo ID e despacha `setTargetPosition(position)`.
    - `agent.speech`: aciona `agent.say(message)`.
    - `npc.alert`: aciona balão de advertência `⚠️` para os habitantes impactados.
  - No `Agents.tsx`, o estado do semáforo é lido de forma reativa a cada frame via `cityStore.getState().trafficLightState` sem provocar re-renderizações React.
- **Suíte de Testes Unitários (`apps/web-client/src/avatars/agent-avatar.spec.ts`):**
  - 6 testes cobrindo instanciação dos 7 agentes de Lira, balões de fala, navegação por `targetPosition`, respeito ao semáforo na faixa e descarte de nós DOM.

### 3. Validação de Aceite
- **Suíte Completa:** `npx vitest run` — **20 arquivos de teste, 99 testes executados e 100% aprovados**.
- **Tipagem Estática:** `npm run typecheck` — 0 erros no monorepo.
- **Sincronismo de Schema:** `npm run check:schema-drift` — 100% síncrono.

---

## 2026-10-19 — Autonomia Real & Diálogo Bidirecional dos Atores com o Avatar Daniel

### 1. Contexto & Motivação
- O usuário requisitou que os habitantes de Synapse City deixassem de ser NPCs estáticos e se tornassem atores autônomos com cognição real, capazes de perceber proativamente a proximidade do avatar protagonista Daniel, cumprimentá-lo de forma espontânea e engajar em diálogos bidirecionais interativos.

### 2. Implementações Realizadas
- **Motor de Simulação Autônoma em Runtime (`AutonomousSimulationService`):**
  - Integração contínua do ciclo cognitivo (`CognitionService`), memória vetorial no Qdrant, planejamento de metas (`GoalPlanner`) e rotas reais via Recast NavMesh WASM (`NavigationService`).
  - Execução contínua a cada 3.5 segundos sem interferir com workers assíncronos do BullMQ em suítes de teste.
- **Percepção e Atenção à Proximidade de Daniel:**
  - `AutonomousSimulationService` e `WorldGateway` mantêm rastreamento das posições do jogador via `avatar:position` e calculam proximidade com `getClosestPlayer(point)`.
  - Ao aproximar-se a menos de 3.5 metros, os habitantes desaceleram o passo, voltam o olhar na direção de Daniel e emitem saudações personalizadas de acordo com seus arquétipos (ex: Vega verifica conformidade, Sulafat aborda questões de zeladoria/reparos, Sheliak reflete sobre fluxo de dados).
- **Interface e Mecânica de Diálogo (`DialogueModal.tsx` & `App.tsx`):**
  - Criado componente em React com estética glassmorphism cyberpunk escuro para conversa ao vivo com o habitante selecionado.
  - O HUD exibe indicador flutuante `[💬 Pressione E para conversar com <Nome>]` quando Daniel está próximo de um habitante.
  - Ao pressionar `[E]`, a interface de diálogo é aberta com histórico, chips de perguntas rápidas contextuais, suporte a `Enter` para envio e `Esc` para fechar.
  - Isolamento de eventos de teclado no modal para que digitação (W, A, S, D) não movimente o avatar acidentalmente.
- **Balões de Fala 3D Bidirecionais:**
  - Implementado `say()` em `daniel-avatar.ts` projetando balão de fala ciano sobre o protagonista.
  - Respostas dos habitantes são transmitidas via WebSocket (`agent:dialogue`) e projetadas simultaneamente no balão flutuante 3D e no modal de chat.
  - Registro de todas as interações no PostgreSQL (`agent_experiences`) como memória social contextual com entidade `avatar-daniel`.

### 3. Validação de Aceite
---

## 2026-10-19 — Autonomia Emergente Real: Zero Dependência Pré-fixada (Fases 1 & 2)

### 1. Contexto & Diretriz do Usuário
- "Cidade de agentes autônomos com zero dependência pré-fixada do tipo: 'cuidar das árvores', 'ande pela calçada'; o foco é os agentes decidirem aonde irem, o que fazerem, por conta própria com base na interação com o ambiente e com o avatar."
- Eliminação completa de roteiros hardcoded (`URBAN_DESTINATIONS`, patrulhas cíclicas fixas, saudações estáticas com `switch/case`).

### 2. Implementações Realizadas

#### A. Arquitetura de Autonomia Emergente (`packages/agent-planning/autonomy`)
1. **Registro de Entidades e Affordances Físicas (`world-affordances.ts`):**
   - Mapeamento das affordances do mundo (`rest`, `eat`, `socialize`, `observe`, `contemplate`, `shop`, `explore`) para entidades reais da cidade: Fonte Monumental (`fountain-monumental`), Mercado Central (`market-central`), Café Bistro (`cafe-bistro`), Mesas Externas, Bancos da Praça Norte/Sul/Leste/Oeste, Ponto de Ônibus Central, Árvores do Boulevard e Letreiros.
2. **Dinâmica Biológica e Psicológica de Necessidades (`needs.ts`):**
   - 5 necessidades internas (`energy`, `hunger`, `social`, `curiosity`, `fun`).
   - Decaimento contínuo ponderado pelo perfil de personalidade Big Five (Abertura, Conscienciosidade, Extroversão, Amabilidade, Neuroticismo).
   - Efeitos restauradores físicos mapeados por affordance (`AFFORDANCE_EFFECTS` e `AFFORDANCE_DURATION_TICKS`).
3. **Decisor Autônomo por Utilidade & Anti-Repetição (`utility-decider.ts`):**
   - Cálculo de utilidade marginal não-linear ($u = \text{déficit}^{1.6}$).
   - Amortização por custo de deslocamento espacial euclidiano.
   - Penalidade de repetição recente (`repetitionPenalty` via `visitCounts` e `lastVisitedAt`) e bônus de novidade para impedir loops locais.
4. **Deliberação Estruturada com LLM (`llm-deliberator.ts`):**
   - Prompt de deliberação gerando JSON estruturado (`chosenCandidateId`, `thought`, `speech`).
   - Fallback gracioso para a melhor escolha por utilidade matemática caso a API do LLM esteja indisponível ou em timeout.
5. **Mente Autônoma do Agente (`agent-mind.ts`):**
   - Mantém estado interno, memória de curto prazo, atividades em andamento e atualizações de bem-estar.

#### B. Interação Dinâmica e Aprendizado Contínuo (Fase 2)
6. **Autoridade do Servidor e Repouso no Cliente (A7 em `agent-avatar.ts`):**
   - Adicionada flag `hasReceivedServerTarget`. Quando o agente alcança seu destino determinado pelo servidor, repousa no local realizando sua atividade em repouso em vez de retornar para rotas locais hardcoded.
7. **Estímulo e Sugestões do Avatar Daniel (A8):**
   - Método `receivePlayerInteraction(playerMessage)`: detecta menções contextuais a locais ("café", "mercado", "praça", "banco", "árvore"), incrementa a afinidade com Daniel e ativa um bônus atrativo transitório (`suggestedTargets`).
8. **Interação Mútua Espontânea entre Habitantes (A9):**
   - Método `interactWithAgentPeer(peer)`: quando dois agentes autônomos se encontram em proximidade, interagem mutuamente, restauram suas carências sociais e constroem afinidade interpessoal recíproca.
9. **Aprendizado Hedônico de Preferências por Locais (A10):**
   - Ao concluir uma atividade em uma entidade física, calcula a variação de bem-estar ($\Delta \text{wellbeing}$) e ajusta `placePreferences[targetId]`. Locais que proporcionam experiências satisfatórias tornam-se "locais favoritos" orgânicos do agente.
10. **Integração no Serviço de Simulação (`AutonomousSimulationService`):**
    - Removido `URBAN_DESTINATIONS`.
    - Os 7 cidadãos de Lira instanciam mentes autônomas completas com seus perfis Big Five (`citizens.seed.ts`).
    - Ciclo de simulação gera percepção espacial do ambiente, detecta proximidade entre agentes para conversas espontâneas e processa sugestões do avatar Daniel.

### 3. Validação de Aceite
- **Testes Unitários de Autonomia:** `packages/agent-planning/autonomy.spec.ts` — **10 testes aprovados (100%)**.
- **Testes de Avatares no Cliente:** `apps/web-client/src/avatars/agent-avatar.spec.ts` — **9 testes aprovados (100%)**.
- **Testes de Simulação:** `apps/api/src/modules/simulation/simulation.service.spec.ts` — **4 testes aprovados (100%)**.
- **Suíte Completa do Monorepo:** `npm test` — **25 de 25 projetos aprovados (100%)**.
- **Verificação de Tipos:** `npm run typecheck` — **0 erros de TypeScript**.
- **Controle de Versão:** Commits `ef679172` (Fase 1) e `355ceb2c` (Fase 2) mesclados em `main` e `feat/1-mvp-rua-central` e sincronizados no GitHub.

---

## 2026-10-19 — Construção da Malha Viária: Anel Viário Perimetral & Interligações Urbanas

### 1. Contexto & Solicitação do Usuário
- "construa essas novas vias com o objetivo de interligar. conforme print"
- Baseado em imagem com traçado magenta/rosa ilustrando o fechamento perimetral da malha viária, circundando os 4 quadrantes da cidade (atrás do Super Mercado / edifícios norte, parque/edifícios ao sul, leste e oeste) e interligando os 4 eixos existentes da Avenida Central e Rua Transversal.

### 2. Implementações Realizadas

#### A. Geometria Viária & Sinalização (CTB / CONTRAN) em `CityScene.ts`
1. **Anel Viário Perimetral (4 Vias Circundantes de 14m):**
   - **Avenida Perimetral Sul:** $z = +68.0\text{m}$, extensão $X \in [-75, 75]\text{m}$.
   - **Avenida Perimetral Norte:** $z = -68.0\text{m}$ (passando atrás do Super Market com recuo generoso), extensão $X \in [-75, 75]\text{m}$.
   - **Avenida Perimetral Oeste:** $x = -68.0\text{m}$, extensão $Z \in [-75, 75]\text{m}$.
   - **Avenida Perimetral Leste:** $x = +68.0\text{m}$, extensão $Z \in [-75, 75]\text{m}$.
   - Padrão viário brasileiro com 2 faixas de rolamento de 7.0m de largura útil cada (total 14.0m de asfalto).
2. **Conectores Radiais:**
   - Eixo Sul da Avenida Central conectado ao anel em $z = +61\text{m}$ até $z = +68\text{m}$.
   - Eixo Norte com via de serviço/logística atrás do Super Market conectando ao anel em $z = -61\text{m}$ até $z = -68\text{m}$.
   - Eixos Leste e Oeste da Rua Transversal conectados ao anel em $x = \pm 61\text{m}$ até $x = \pm 68\text{m}$.
3. **Passeios Públicos e Meio-Fio:**
   - Calçadas de concreto elevado ($y = 0.18\text{m}$) com largura generosa de 5.0m contornando todo o perímetro externo e as esquinas internas dos 4 quadrantes.
   - Meio-fio de granito escurecido em $y = 0.20\text{m}$.
4. **Sinalização Horizontal & Vertical:**
   - Linhas duplas amarelas seccionadas (faixas de divisão de sentidos opostos).
   - Linhas de bordo brancas contínuas demarcando o acostamento e calçada.
   - 22 setas direcionais CONTRAN pintadas no asfalto reforçando a mão de direção à direita.
   - 4 placas de nomenclatura urbana: `AV. PERIMETRAL SUL`, `AV. PERIMETRAL NORTE`, `AV. PERIMETRAL OESTE`, `AV. PERIMETRAL LESTE`.
5. **Mobiliário Urbano e Iluminação Pública:**
   - 8 novos postes de iluminação pública ao longo das calçadas do Anel Perimetral com luz dinâmica dia/noite.
   - 8 novas árvores urbanas ao longo das calçadas e esquinas do Anel.
   - Expansão do plano de solo para $220\text{m} \times 220\text{m}$ e do frustum de sombras para cobrir o anel.

#### B. Física, Colisores e Limites da Cidade
1. **Colisores de Solo e Limites da Cidade:**
   - `packages/config/city-colliders.ts`: `CITY_BOUNDS` expandido de $[-65, 65]\text{m}$ para $[-85, 85]\text{m}$ em $X$ e $Z$.
   - `packages/world-engine/geometry-builder.ts`: `DEFAULT_CITY_BOUNDS` para Recast NavMesh expandido de $[-50, 50]\text{m}$ para $[-85, 85]\text{m}$.
   - `apps/web-client/src/components/City.tsx`: Rapier CuboidCollider do solo expandido de $75\text{m} \times 75\text{m}$ para $95\text{m} \times 95\text{m}$.
   - `apps/web-client/src/vehicles/vehicle-agent.ts`: `ROAD_END` expandido para 60m para permitir que veículos acessem as extremidades arteriais e novos entroncamentos.

#### C. Integração com Autonomia dos Agentes (`world-affordances.ts`)
1. **Novas Entidades Físicas para a Mente dos Cidadãos:**
   - `bench-perimetral-south`: Banco de repouso e socialização na calçada sul.
   - `bench-perimetral-west`: Banco na calçada oeste para contemplação urbana.
   - `tree-perimetral-south` e `tree-perimetral-north`: Alamedas arborizadas para descanso e caminhadas.
   - `lookout-perimetral-se`: Mirante urbano do anel viário sudeste para exploração e contemplação.

### 3. Validação de Aceite
- **Testes Unitários da Cena Urbana:** `apps/web-client/src/scenes/city-scene.spec.ts` — **3 de 3 testes aprovados (100%)**.
- **Suíte Completa do Monorepo:** `npm test` — **25 de 25 projetos aprovados (100%)**.
- **Checagem Estática de Tipos:** `npm run typecheck` — **0 erros em todo o monorepo**.

---

## 2026-10-19 — Task-036: Persistir a Mente Subjetiva (`AgentMind`) e Memória Hedônica no PostgreSQL

### 1. Contexto & Motivação
- Antes desta entrega, o estado subjetivo dos agentes (`AgentMind`: necessidades biológicas, histórico de visitas `visitCounts`, preferências hedônicas por locais `placePreferences`, afinidade interpessoal `actorAffinity` e intenções ativas) residia exclusivamente na memória RAM do `AutonomousSimulationService`.
- A cada reinício ou deploy da API, os cidadãos sofriam amnésia hedônica total, perdendo todo o aprendizado de lugares que gostavam ou não gostavam e sua proximidade afetiva construída com o avatar Daniel.

### 2. Implementações Realizadas
1. **Modelagem de Dados e Sincronismo de Schema (Drizzle ↔ init.sql ↔ types):**
   - Criada a tabela `agent_minds` em `infrastructure/database/init.sql` com colunas `agent_id` (PK com FK cascade para `agent_identities`), `needs` (JSONB), `memory` (JSONB), `current_intention` (JSONB), `current_activity` (JSONB), `created_at` e `updated_at`.
   - Adicionado índice temporal `idx_agent_minds_updated_at` sobre `updated_at DESC`.
   - Mapeada a tabela `agentMindsTable` no Drizzle ORM (`packages/persistence/src/schema.ts`).
   - Declarados os contratos em `@cidade-virtual/types`: `AgentMindState`, `AgentNeedsState` e `AgentMemoryContextState`.
   - Script de validação `scripts/check-schema-drift.ts` estendido com o passo 5 para garantir sincronismo 100% estrito e honesto entre SQL, Drizzle e types.
2. **Repositório Relacional `AgentMindRepository` (`packages/persistence`):**
   - Implementados métodos `getByAgentId(id)`, `upsert(data)`, `saveAll(rows)`, `deleteByAgentId(id)` e `deleteAll()`.
   - Registrado e exportado no `PersistenceModule` do NestJS.
3. **Serialização e Restauração em `AgentMind` (`packages/agent-planning`):**
   - Adicionado método `serializeState()` gerando snapshot estruturado e imutável.
   - Adicionado método `restoreState(state)` reconstruindo necessidades e memórias afetivas sem perder o baseline de personalidade Big Five.
   - Construtor atualizado com suporte a `initialMemory`.
4. **Ciclo de Vida no `AutonomousSimulationService` (`apps/api`):**
   - **`onModuleInit()`:** Consulta `agentMindRepo.listAll()` e restaura automaticamente o histórico, preferências e carências de cada cidadão antes do primeiro tick cognitivo. Se não houver snapshot prévio, nasce no baseline de arquétipo.
   - **Snapshot Periódico:** Timer de 60 segundos gravando o estado de todas as mentes em segundo plano sem bloquear o heartbeat da simulação.
   - **`onModuleDestroy()`:** Executa `saveAllAgentMinds()` persistindo o estado final no encerramento limpo da API.
   - **Reset de Desenvolvimento:** Métodos `resetMind(agentId)` e `resetAllMinds()` para recriação limpa de vidas em testes ou depuração.

### 3. Validação de Aceite
- **Teste de Integração Real:** `tests/integration/agent-mind-persistence.test.ts` — **3 de 3 testes aprovados (100%)** contra o container PostgreSQL 16 real:
  - Criação de preferências hedônicas, simulação de restart e restauração com precisão de float.
  - Snapshot em lote de 7 mentes executado em **menos de 2ms** (critério de aceite do marco: $< 50\text{ms}$).
  - Reset e retorno para o baseline de nascimento validado.
- **Testes Unitários:** `apps/api/src/modules/simulation/simulation.service.spec.ts` — **6 de 6 testes aprovados**.
- **Schema Drift:** `npm run check:schema-drift` — **100% sincronizado**.
- **Suíte Completa:** `npm test` — **25 de 25 projetos aprovados**.
- **Checagem de Tipos:** `npm run typecheck` — **0 erros de TypeScript em todo o monorepo**.

---

## [2026-10-19] — Task-038: Cérebro Único — Aposentadoria da Política por Palavra-Chave

### 1. Diagnóstico do Problema (Divergência de Cérebros)
- O subsistema de cognição continha um resíduo legado em `packages/agent-cognition/index.ts`: o nó `interpretSituation` utilizava correspondência hardcoded de strings (`obsLower.includes('caminha') || ... ('patrulha') ... ('rotina')`), roteando o agente para uma ação enlatada `routine_navigation` com `reasonCode: 'ROUTINE_POLICY'`.
- Essa lógica coexistia em paralelo ao cérebro orgânico `AgentMind` + `utility-decider` + `llm-deliberator`, violando o princípio fundamental do projeto de **zero comportamento pré-fixado**.

### 2. Mudanças Estruturais Realizadas
1. **Erradicação Completa de Palavras-chave em `packages/agent-cognition`:**
   - Removidas todas as checagens por palavras-chave (`caminha`, `patrulha`, `rotina`, etc.).
   - Removidos os códigos legados `ROUTINE_POLICY` e `routine_navigation`.
   - Substituídos por avaliação autônoma orientada a utilidade (`actionType: 'autonomous_navigation'`, `reasonCode: 'UTILITY_EVALUATION'`) e deliberação por LLM (`LLM_REASONING`).
2. **Orquestração Exclusiva via `AgentMind` em `CognitionService` (`apps/api`):**
   - `CognitionService.processCycle(...)` agora orquestra a tomada de decisão exclusivamente através de `AgentMind.decideNextIntention(...)`.
   - Registrador de mentes (`registerMind`, `getMind`, `getOrCreateMind`) garantindo que `SimulationService` e `CognitionService` compartilhem o mesmo cérebro subjetivo sem discrepâncias.
   - Percepção de entidades (`SYNAPSE_WORLD_ENTITIES`), semáforo e proximidade de atores (como o avatar Daniel) alimentam diretamente a função de utilidade hedônica.
3. **Harmonização do `ActionsService` (`apps/api`):**
   - Atualizados os manipuladores e permissões RBAC para `autonomous_navigation`.
4. **Resiliência e Tolerância de Deliberação (`packages/agent-planning`):**
   - `DeciderOptions` estendido com `forceLLM?: boolean`.
   - `shouldInvokeLLM` ajustado para ativar a LLM quando forçado pelo ciclo ou na presença próxima do avatar Daniel com ambivalência de escolhas (`topDiff < 0.25`).
   - `deliberateWithLLM` enriquecido para aceitar respostas em texto puro quando o modelo não responder estritamente em JSON, preservando o status `source: 'llm'`.
5. **Otimização de Consulta em `ExperienceRepository` (`packages/persistence`):**
   - `getByAgentId` agora suporta filtragem atômica de `sourceType` no banco PostgreSQL via `drizzle-orm`, prevenindo truncamento em bancos com alto volume de ações.

### 3. Validação e Critérios de Aceite
- **Zero Ocorrências em Caminhos de Decisão:** `rg "includes\('caminha'|ROUTINE_POLICY|routine_navigation"` retorna **0** ocorrências em todo o código do monorepo.
- **Auditoria 100% Utilitária / LLM:** Todas as decisões registradas nos testes e no runtime produzem `reasonCode` prefixado por `UTILITY_*` (`UTILITY_DECISION`, `UTILITY_EVALUATION`) ou `LLM_*` (`LLM_REASONING`).
- **Suíte de Testes 100% Verde:**
  - `apps/api/src/modules/cognition/cognition.service.spec.ts` — **4 de 4 testes aprovados**.
  - `tests/integration/principal-actions.test.ts` — **10 de 10 testes aprovados**.
  - `tests/integration/agent-mind-persistence.test.ts` — **3 de 3 testes aprovados**.
  - `tests/integration/npc-seed.test.ts` — **4 de 4 testes aprovados**.
  - `tests/e2e/learning-flow.test.ts` — **1 de 1 teste aprovado**.
  - `npx vitest run tests/` — **15 de 15 arquivos de teste e 69 de 69 testes aprovados**.
  - `npm test` — **25 de 25 projetos Nx aprovados**.
  - `npm run typecheck` — **0 erros de TypeScript**.
  - `scripts/check-schema-drift.ts` — **100% sincronizado**.

---

## [2026-10-19] — Task-039: Loop de Aprendizado Fechado — Memória Semântica → Utilidade + Transmissão Social NPC-NPC

### 1. Contexto & Motivação
- Antes desta entrega, o `utility-decider` baseava-se primordialmente em contadores in-memory voláteis (`visitCounts`, `lastVisitedAt`). As experiências consolidadas registradas no PostgreSQL (`agent_experiences`) e as memórias vetoriais do Qdrant informavam apenas logs ou o fluxo de aprendizagem sem retroalimentar de forma contínua as preferências hedônicas dos agentes (`placePreferences`).
- Adicionalmente, quando dois habitantes se encontravam na cidade, não havia propagação cultural de conhecimentos ou aversões: o aprendizado de um cidadão permanecia estritamente individual.
- A Task-039 fechou esse circuito:
  1. Experiências consolidadas (PostgreSQL e Qdrant) viram viés quantitativo em `placePreferences` com decaimento temporal.
  2. Ao conversarem (`interactWithAgentPeer`), os habitantes transmitem preferências entre si com fator de decaimento geracional de $0{,}85$ por salto (proposta P6 do Dossiê Técnico).
  3. Essas preferências modulam a utilidade esperada no `utility-decider`, permitindo que um cidadão evite locais perigosos por $N$ ticks mesmo sem tê-los visitado pessoalmente.

### 2. Implementações Realizadas
1. **Mecanismo de Transmissão Social Cultural (`packages/agent-planning`):**
   - Constante `SOCIAL_TRANSMISSION_FACTOR = 0.85` exportada canonicamente.
   - `AgentMind.receiveSocialPreference(placeId, transmittedValue)`: absorve o viés cultural transmitido e integra suavemente ao histórico subjetivo prévio.
   - `AgentMind.transmitSocialPreferences(peer, factor = 0.85)`: realiza a troca bidirecional de preferências hedônicas entre agentes, aplicando o decaimento $V \times 0{,}85$ por geração/salto.
   - `AgentMind.interactWithAgentPeer(peer)`: estendido para executar automaticamente `this.transmitSocialPreferences(peer)` a cada conversa espontânea.
2. **Arrefecimento Temporal Contínuo (`packages/agent-planning`):**
   - `AgentMind.coolDownPreferences(decayFactor = 0.98)`: decai gradualmente as preferências hedônicas ao longo do tempo, podando vieses residuais inferiores a $|0{,}02|$ para prevenir aversões ou fixações perpétuas.
   - Chamada contínua integrada a `AgentMind.update(dtSeconds)`.
3. **Consolidação de Experiências (`packages/agent-planning`):**
   - `AgentMind.integrateExperiences(experiences, now)`: analisa experiências históricas (PostgreSQL `agent_experiences` e Qdrant `MemorySnippet`), avalia a valência (risco/desconforto vs benefício/segurança), pondera por importância e confiança, aplica decaimento temporal ($0{,}97^{\Delta t}$) e atualiza `placePreferences[targetId]`.
4. **Modulação do `utility-decider` (`packages/agent-planning`):**
   - `scoreCandidate` agora pondera as preferências aprendidas com fator $0{,}50$ e suporte a aliases espaciais, aplicando penalidade ou bônus robusto na pontuação de candidatos de ação.
5. **Integração no Ciclo de Vida da API (`apps/api`):**
   - **`CognitionService.processCycle(...)`:** Memórias semânticas recuperadas via Qdrant e experiências do PostgreSQL alimentam diretamente `mind.integrateExperiences(...)` antes da geração da intenção.
   - **`CognitionService.syncExperiences(citizenId)`:** Método para sincronização ativa do histórico relacional.
   - **`SimulationService.onModuleInit()`:** Ao inicializar a simulação da cidade, integra até 50 experiências consolidadas do banco para cada habitante autônomo.
   - **`SimulationService.executeSimulationStep()`:** Ao detectarem proximidade ($\le 2{,}8\text{m}$), os agentes dialogam e trocam preferências culturais com fator $0{,}85$.

### 3. Validação e Critérios de Aceite
- **Teste de Integração Real:** `tests/integration/social-transmission.test.ts` — **1 de 1 teste aprovado (100%)**:
  - NPC A vivencia perigo e comida estragada no `market-central` e registra no PostgreSQL.
  - A mente de A integra a experiência e assume forte viés negativo ($\le -0{,}70$).
  - NPC B inicializa com mente limpa (`placePreferences` vazio).
  - A e B dialogam espontaneamente (`interactWithAgentPeer`) $\to$ viés negativo transmitido a B ($V_A \times 0{,}85 \approx -0{,}65$).
  - B com fome relevante toma decisões ao longo de $N = 5$ ticks sob arrefecimento contínuo e **evita o mercado central em 100% das vezes**, optando pelo café bistro.
- **Testes Unitários:** `packages/agent-planning/autonomy.spec.ts` — **13 de 13 testes aprovados (100%)**:
  - Transmissão geracional A $\to$ B $\to$ C comprovando decaimento exato: salto 1 ($0{,}85$), salto 2 ($0{,}85^2 = 0{,}7225$).
  - Arrefecimento temporal comprovado e poda de preferências antigas.
  - Integração de experiências Postgres/Qdrant modulando diretamente o ranking do `utility-decider`.
- **E2E Learning Flow Preservado:** `tests/e2e/learning-flow.test.ts` — **1 de 1 teste aprovado (100%)**.
- **Suíte de Integração Completa:** `npx vitest run tests/integration/` — **12 arquivos e 63 testes aprovados (100%)**.
- **Suíte Geral de Testes:** `npx vitest run tests/` — **16 arquivos e 70 testes aprovados (100%)**.
---

## 2026-10-19 — Task-041: Prova MA "Nasce um Hábito" (DoD da Autonomia Emergente) & MARCO MA ATINGIDO

### 1. Resumo Executivo
- **Objetivo:** Executar o teste observável E2E definitivo que comprova a autonomia emergente real dos habitantes de Synapse City, consolidando o **Marco MA** (*"O habitante decide sozinho, aprende sem scripts e sobrevive a restart"*).
- **Roteiro em 8 Passos (`tests/e2e/autonomy-habit.test.ts`):**
  1. **Início da Cidade e Percepção:** Habitante Lyra percebe o avatar Daniel a 2.0m na via (`Percept` com ator `kind: 'player'`).
  2. **Objetivo Próprio e Decisão por Utilidade:** Lyra forma objetivo autônomo baseado em carências e utilidade (`UTILITY_DECISION`, fonte `utility`), com **zero** keywords legadas (`ROUTINE_POLICY`, `routine_navigation`, `caminha`, `rotina`) no trace cognitivo auditado.
  3. **Planejamento Hierárquico e Navegação Real:** HTN decompõe o objetivo em $\ge 3$ passos (`HTNPlan`), navegando espacialmente na malha Recast NavMesh WASM contornando esquinas e calçadas.
  4. **Registro de Experiência e Memória:** O resultado da ação é gravado como experiência episódica no PostgreSQL (`agent_experiences`) e indexado no Qdrant como embedding semântico de 1536 dimensões.
  5. **Aprendizado Hedônico e Snapshot Mental:** A mente assimila o reforço positivo (`placePreferences['cafe-bistro'] > 0.65`) e o estado mental completo é persistido em PostgreSQL `agent_minds` com precisão de ponto flutuante.
  6. **Simulação de Restart/Cold Boot:** Destruição completa do estado em memória. Inicialização de um novo serviço restaurando a mente de Lyra diretamente do PostgreSQL (`AgentMindRepository`).
  7. **Divergência Decisória pós-Restart:** Com a carência de fome retornada e sem nenhum script, Lyra avalia as opções e **diverge** sua escolha em favor do hábito adquirido (`score = 1.36` para Café Bistro vs `1.03` para Mercado Central).
  8. **Difusão Cultural Social NPC $\to$ NPC:** Lyra dialoga com o habitante Orion via `interactWithAgentPeer`. Orion assimila o viés cultural com decaimento geracional de $0{,}85$ ($0{,}85 \times 0{,}70 \approx 0{,}595$) e, ao deliberar autonomamente, também prioriza o Café Bistro (`score = 1.25`).

### 2. Implementação e Ajustes Arquiteturais
1. **Suíte E2E da Prova MA (`tests/e2e/autonomy-habit.test.ts`):**
   - 351 linhas de código de teste de ponta a ponta conectadas a banco PostgreSQL real (porta 5433), Qdrant real (porta 6333) e Recast NavMesh WASM nativo.
   - Assertions rígidas de integridade, divergência numérica, persistência e transmissão.
2. **Refinamento do Gatilho de Deliberação LLM (`packages/agent-planning/autonomy/agent-mind.ts`):**
   - Condição `shouldInvokeLLM` refatorada para acionar o adaptador de LLM apenas quando explicitamente forçado (`forceLLM`) ou na presença imediata do jogador avatar (`playerNearby`), garantindo que a rotina autônoma dos habitantes execute exclusivamente por utilidade pura (`UTILITY_DECISION`), sem desperdício de chamadas externas de LLM.
3. **Isolamento de Estado em Testes de Integração (`tests/integration/persistence.test.ts`):**
   - Isolamento do identificador de mundo no teste de durabilidade (`test-persistence-world`) para evitar interferência concorrente de ticks da simulação em execução no dev server.
4. **Resiliência no Ciclo de Vida da Simulação (`apps/api/src/modules/simulation/simulation.service.ts`):**
   - Adicionada verificação defensiva de tipagem para o método `getByAgentId` do repositório de experiências durante a inicialização do módulo.

### 3. Validação e Critérios de Aceite
- **Prova E2E MA:** `tests/e2e/autonomy-habit.test.ts` — **1 de 1 teste aprovado (100%) em 906ms**:
  - [x] E2E verde no CI.
  - [x] Zero ocorrência de `ROUTINE_POLICY` ou `routine_navigation` no trace.
  - [x] Decisão pós-restart diverge em favor do hábito aprendido (`score: 1.36` vs `1.03`).
  - [x] Transmissão social verificada (Orion exibe o viés de $0{,}85$ e decide pelo Café Bistro).
  - [x] Marco MA registrado como atingido no Mapa de Marcos em 2026-10-19.
- **Suíte Geral de Testes:** `npx vitest run tests/` — **17 arquivos e 71 testes aprovados (100%)**.
- **Monorepo Nx:** `npm test` — **25 de 25 projetos aprovados (100%)**.
- **Build Geral:** `npm run build` — **25 de 25 projetos compilados com sucesso**.
- **Checagem de Schema Drift:** `npx tsx scripts/check-schema-drift.ts` — **100% sincronizado**.

---

## 2026-10-19 — Task-037: CI Confiável para o Motor de Autonomia (Fim do Fake-Green)

### 1. Resumo Executivo
- **Objetivo:** Eliminar scripts "fake-green" (`node -e "console.log('... test ok')"`), integrar suítes reais de testes unitários e de integração nos pacotes centrais do motor de autonomia (`packages/agent-planning`, `packages/world-engine`, `packages/memory`, `packages/llm-adapters`, `packages/agent-cognition`, `packages/event-system`), registrar a suíte raiz como projeto oficial Nx (`@cidade-virtual/root-tests` via `tests/project.json`), e atualizar o pipeline do GitHub Actions (`.github/workflows/ci.yml`) com orquestração de containers de banco e mensageria reais (PostgreSQL 16, Qdrant v1.12.1, Redis 7).

### 2. Implementações Realizadas
1. **Substituição de Scripts Fake nos Pacotes do Motor:**
   - `packages/agent-planning/package.json`: `"test": "vitest run"`, `"lint": "tsc -p tsconfig.json --noEmit"`.
   - `packages/world-engine/package.json`: `"test": "vitest run"`, `"lint": "tsc -p tsconfig.json --noEmit"`.
   - `packages/llm-adapters/package.json`: `"test": "vitest run"`, `"lint": "tsc -p tsconfig.json --noEmit"`.
   - `packages/memory/package.json`: `"test": "vitest run"`, `"lint": "tsc -p tsconfig.json --noEmit"`.
   - `packages/agent-cognition/package.json`: `"test": "vitest run"`, `"lint": "tsc -p tsconfig.json --noEmit"`.
   - `packages/event-system/package.json`: `"test": "vitest run"`, `"lint": "tsc -p tsconfig.json --noEmit"`.
2. **Novas Suítes Unitárias nos Pacotes:**
   - `packages/memory/memory.spec.ts`: 11 testes cobrindo geração de embeddings determinísticos (1536 dimensões, normalização L2 euclidiana = 1.0), diferenciação semântica, criação de collection Qdrant (HNSW m=16, Cosine) e busca semântica por similaridade.
   - `packages/agent-cognition/agent-cognition.spec.ts`: 3 testes validando ciclo deliberativo em grafo (LangGraph StateGraph), deliberação autônoma por utilidade (`UTILITY_EVALUATION`), fallback contextual de regras urbanas, deliberação LLM (`LLM_REASONING`) e emissão de `ActionRequest` assinado com `Principal` do habitante.
   - `packages/event-system/event-system.spec.ts`: 3 testes cobrindo padronização das 4 filas (`simulation-queue`, `cognition-queue`, `learning-queue`, `dlq-queue`), conexão Redis resiliente com `maxRetriesPerRequest: null`, e políticas de retry exponencial e remoção de jobs completados.
3. **Integração das Suítes Raiz no Nx:**
   - Criado `tests/project.json` registrando `@cidade-virtual/root-tests` no monorepo Nx, permitindo execução unificada via `nx test @cidade-virtual/root-tests` e `nx run-many -t test --all` (26 projetos).
4. **Pipeline GitHub Actions (`.github/workflows/ci.yml`):**
   - Corrigido gatilho de execução: `push: branches: [main, 'feat/**']` e `pull_request: branches: [main]`.
   - Adicionado job `validate` executando build, lint e testes unitários de todos os pacotes do motor e web-client sem dependência externa.
   - Adicionado job `integration-and-e2e` provisionando containers Docker reais via `docker compose -f infrastructure/docker/docker-compose.yml up -d`, aguardando readiness do PostgreSQL, validando paridade de schema Drizzle/SQL/Types e executando a suíte completa de 17 arquivos e 71 testes E2E e de integração.

### 3. Validação e Demonstração do Gate
- **Teste de Regressão Proposital Honesta:**
   - Inserida anomalia intencional no cálculo de vetor de `MemoryService` (`vector[0] = 0.0`).
   - O CI/Nx rejeitou imediatamente: `FAIL memory.spec.ts`, código de saída 1, comprovação de que o gate agora reprova com honestidade.
   - Regressão revertida com retorno para 100% verde (`vector[0] = 1.0`).
- **Suítes de Pacotes:** `npx vitest run packages/` — **7 arquivos e 54 testes aprovados (100%)**.
- **Suíte Geral de Testes:** `npx vitest run tests/` — **17 arquivos e 71 testes aprovados (100%)**.
- **Monorepo Nx:** `npm test` — **26 de 26 projetos aprovados (100%)**.
- **Lint Estático Monorepo:** `npm run lint` — **25 de 25 projetos aprovados (100%)**.
- **Paridade de Schema:** `npm run check:schema-drift` — **100% sincronizado**.

---

## 2026-10-19 — Habilitação Plena do Trânsito no Anel Viário Perimetral

### 1. Resumo Executivo
- **Problema Relatado:** As novas vias foram construídas, mas não era possível transitar por elas.
- **Diagnóstico Preciso das Causas-Raiz:**
  1. **Avatar do Jogador (Daniel):** Restrição artificial em `daniel-avatar.ts` (`clamp(nextX, -58, 58)` e `clamp(nextZ, -58, 58)`). Como as novas vias perimetrais possuem eixos em $\pm 68\text{m}$ (asfalto de $61\text{m}$ a $75\text{m}$ e calçadas até $80\text{m}$), o jogador colidia com uma barreira invisível fixa aos $58\text{m}$ e não conseguia dar um passo nas novas avenidas.
  2. **Tráfego Automotivo:** Os veículos existentes realizavam manobra de retorno prematuro em $z = 60\text{m}$, $z = -30\text{m}$ e $x = \pm 60\text{m}$ (`ROAD_END`), antes de alcançar os entroncamentos, e não havia veículos circulando no Anel Viário.
  3. **Conectividade Viária Norte:** A Avenida Central Norte terminava na fachada do Super Market sem alamedas laterais de contorno que ligassem o centro diretamente à Avenida Perimetral Norte.
  4. **Rotas dos Habitantes (NPCs):** Todos os waypoints de patrulha dos habitantes estavam confinados ao centro histórico ($< 35\text{m}$).

### 2. Implementações Realizadas
1. **Desbloqueio Físico da Locomoção do Avatar Daniel ([daniel-avatar.ts](file:///home/zaidoh/dsw/cidade-virtual/apps/web-client/src/avatars/daniel-avatar.ts)):**
   - Limites do mapa ampliados de $[-58, 58]$ para $[-82, 82]$, permitindo trânsito desimpedido por todo o asfalto perimetral, cruzamentos, calçadas, bancos perimetrais e o Mirante Panorâmico Sudeste em $(72, 72)$.
2. **Infraestrutura e Conectividade Viária ([city-scene.ts](file:///home/zaidoh/dsw/cidade-virtual/apps/web-client/src/scenes/city-scene.ts)):**
   - Construídas Alamedas Laterais de Contorno do Super Market (Alameda Noroeste em $x = -18.5$ e Alameda Nordeste em $x = +18.5$) com asfalto e calçadas contínuas de $z = -38$ a $z = -61$, além de pátio de manobra e ligação transversal nos fundos.
   - Adicionadas calçadas largas nos Conectores Sul, Leste e Oeste, além de sinalização zebrada visual nas 4 entradas do Anel Viário.
3. **Circulação Veicular Autônoma no Anel Viário ([vehicle-agent.ts](file:///home/zaidoh/dsw/cidade-virtual/apps/web-client/src/vehicles/vehicle-agent.ts)):**
   - Adicionado suporte a `routeCircuit: 'PERIMETER_CCW' | 'PERIMETER_CW'` com navegação contínua ao longo dos 4 ramos perimetrais, cálculo de alinhamento lateral na faixa regulamentar (externa $71.5\text{m}$, interna $64.5\text{m}$, padrão CTB), controle de aproximação de esquinas com setas antecipadas e curvas suaves de Bézier de 90° nos quatro cantos (SE, NE, NW, SW).
   - Expandidos os limites das artérias centrais (`ROAD_END.NS_SOUTH = 62`, `ROAD_END.EW = 62`, `ROAD_END.NS_NORTH = -34`) para que os carros centrais avancem até as bocas dos conectores.
   - Expandida a frota `CITY_VEHICLES` de 4 para 8 veículos, integrando 4 veículos dedicados às pistas do Anel Viário: Ônibus Circular Perimetral (`veh-bus-perimetral`), Viatura de Trânsito Perimetral (`veh-patrol-perimetral`), Coupe Aerodinâmico (`veh-coupe-perimetral`) e Compacto Neo Elétrico (`veh-hatch-perimetral`).
4. **Patrulha e Habitabilidade Urbana nas Vias Novas ([agent-avatar.ts](file:///home/zaidoh/dsw/cidade-virtual/apps/web-client/src/avatars/agent-avatar.ts)):**
   - Integrados destinos e alamedas perimetrais nas rotas de Sulafat (Alameda Oeste & Banco Oeste), Sheliak (Conector Sul, Banco Sul e Mirante Panorâmico SE), Epsilon (Conector Leste e Banco Leste), Xihe (Alamedas do Super Market e Banco Norte) e Chasoň (Conector e Alameda Sul).
5. **Cobertura Automatizada de Testes Unitários:**
   - Criado `apps/web-client/src/vehicles/perimeter-traffic.spec.ts` (4 testes validando frota de 8 veículos, navegação nas pistas externa e interna e transição para estado `TURNING`).
   - Criado `apps/web-client/src/avatars/daniel-avatar.spec.ts` (2 testes comprovando que o Daniel anda livremente além de $58\text{m}$ até as pistas perimetrais a $75\text{m}$).

### 3. Validação de Aceite
- **Suíte de Testes Frontend:** `npx vitest run apps/web-client` — **7 arquivos e 42 testes aprovados (100%)**.
- **Suíte de Integração e E2E:** `npx vitest run tests/` — **22 arquivos e 112 testes aprovados (100%)**.
- **Monorepo Nx:** `npm test` — **26 de 26 projetos aprovados (100%)**.
- **Checagem de Schema Drift:** `npm run check:schema-drift` — **100% sincronizado**.

---

## 2026-10-19 — Correção da Orientação das Setas Indicativas de Sentido (SIC 01 - CTB / CONTRAN)

### 1. Resumo do Problema
- Na sinalização horizontal das Avenidas Perimetrais Sul ($z = +68\text{m}$) e Norte ($z = -68\text{m}$), os ângulos de rotação `rotY` das setas direcionais desenhadas no asfalto estavam invertidos em 180° em relação ao fluxo regulamentar dos veículos (mão direita conforme CTB):
  - Na Perimetral Sul, a pista externa ($z = +71.5\text{m}$) apontava para o Oeste em vez de Leste, e a pista interna ($z = +64.5\text{m}$) apontava para o Leste em vez de Oeste.
  - Na Perimetral Norte, a pista externa ($z = -71.5\text{m}$) apontava para o Leste em vez de Oeste, e a pista interna ($z = -64.5\text{m}$) apontava para o Oeste em vez de Leste.

### 2. Correções Aplicadas
- **Alinhamento em [city-scene.ts](file:///home/zaidoh/dsw/cidade-virtual/apps/web-client/src/scenes/city-scene.ts):**
  - **Perimetral Sul:** Pista externa ($z = +71.5\text{m}$) ajustada para `rotY = Math.PI / 2` (Leste, $+X$); pista interna ($z = +64.5\text{m}$) ajustada para `rotY = -Math.PI / 2` (Oeste, $-X$).
  - **Perimetral Norte:** Pista externa ($z = -71.5\text{m}$) ajustada para `rotY = -Math.PI / 2` (Oeste, $-X$); pista interna ($z = -64.5\text{m}$) ajustada para `rotY = Math.PI / 2` (Leste, $+X$).
  - **Alamedas de Contorno:** Adicionadas setas direcionais nas alamedas laterais do Super Market (Alameda Noroeste com `rotY = Math.PI` para o Norte e Alameda Nordeste com `rotY = 0` para o Sul).
- **Cobertura de Testes:** Criado [perimeter-arrows.spec.ts](file:///home/zaidoh/dsw/cidade-virtual/apps/web-client/src/scenes/perimeter-arrows.spec.ts) validando formalmente os ângulos de rotação de cada uma das setas do anel viário e conectores contra as regras de trânsito brasileiras.

### 3. Validação
- `npx vitest run apps/web-client`: **8 arquivos e 44 testes aprovados (100%)**.
- `npx vitest run tests/`: **22 arquivos e 112 testes aprovados (100%)**.

---

## 2026-10-19 — Inteligência Anti-Aprisionamento (Anti-Stuck), Fuga para Local Livre e Aprendizado de Memória Espacial dos NPCs

### 1. Resumo da Demanda
- **Solicitação do Usuário:** "os npc nao podem ficar presos em nenhum local. eles devem ter inteligencia para achar a saída e ficar em um local livre. e devem aprender essa memoria."
- **Objetivos Chave:**
  1. **Detecção Contínua de Bloqueio/Aprisionamento (`stuckAccumulator`):** Identificar quando um NPC tem intenção de se mover (`speed > 0.1` ou `distToTarget > 0.5`), mas seu deslocamento real é frustrado por colisores ou cantos de obstáculos por mais de 1.2s.
  2. **Inteligência de Diagnóstico e Varredura Radial de Saída (`findEscapeRoute`):** Amostrar radialmente em 360° (32 direções de varredura raymarching até 14m) avaliando linha de visão desobstruída, ausência de colisores, afastamento do leito carroçável asfáltico e pontuação de espaço amplo/aberto (Clearance).
  3. **Aprendizado e Fixação de Memória Espacial (`SpatialStuckMemory` & `learnStuckMemory`):** O NPC memoriza o ponto crítico do bloqueio, o raio de influência da armadilha e a rota de fuga desobstruída descoberta. Em caso de reincidência, incrementa ocorrências e expande a zona de segurança.
  4. **Aplicação Preditiva da Memória Aprendida em Navegações Futuras (`computeAvoidanceSteering`):** Zonas de armadilha memorizadas geram campos de repulsão ativos combinados com vetores de atração em direção à saída segura aprendida, impedindo que o NPC volte a entrar no beco sem saída. Destinos de patrulha ou de servidor dentro de zonas memorizadas são automaticamente contornados.
  5. **Feedback Visual e Vocal dos Cidadãos:** O habitante emite balão de fala expressando a identificação da obstrução, a rota de fuga e a memorização ("Caminho sem saída! Memorizei este bloqueio e encontrei a saída para a área livre.") e, ao alcançar o local livre, expressa alívio e descansa com segurança no local aberto.

### 2. Implementações Realizadas
- **Interface e Estrutura de Memória (`apps/web-client/src/avatars/agent-avatar.ts`):**
  - Adicionada interface `SpatialStuckMemory` (`id`, `position`, `radius`, `escapeWaypoint`, `timestamp`, `description`, `occurrences`).
  - Adicionados campos no `AgentAvatar`: `isEscapingDeadlock`, `escapeTarget`, `escapeTimer`, `stuckMemories`, `stuckAccumulator`, `lastDisplacementPos`, `stuckCheckTimer`.
- **Diagnóstico e Fuga Autônoma (`findEscapeRoute` e `triggerAntiStuckEscape`):**
  - Implementado raymarching radial em 32 direções com testes de 3.0m a 14.0m.
  - Avaliação de desobstrução lateral (Clearance) em 8 probes circulares ao redor de cada ponto candidato.
  - Priorização de calçadas e praças com exclusão do leito asfáltico e rejeição de zonas já cadastradas na memória.
- **Integração de Memória Espacial no Steering (`computeAvoidanceSteering`):**
  - Incorporada força repulsiva contínua ($\times 2.5$) contra o centro de armadilhas memorizadas e vetor atrativo de guia ($\times 1.6$) em direção à saída segura aprendida.
  - Suporte à evasão de memórias mesmo sem colisores estáticos imediatos.
- **Adaptação Preventiva de Rotas:**
  - `setTargetPosition` sincroniza posição e reseta timers.
  - Pontos de patrulha e destinos de servidor são checados contra `isPositionInStuckMemory`: se bloqueados na memória, avançam ou re-roteiam para o waypoint de fuga seguro.
  - `findFreeRandomLocation` (evasão de veículos) descarta candidatos dentro de zonas memorizadas.
- **Suíte de Testes Unitários (`apps/web-client/src/avatars/agent-avatar.spec.ts`):**
  - 5 novos testes cobrindo diagnóstico de deadlock, inteligência geométrica de `findEscapeRoute`, mutação/aprendizado de memória espacial (`learnStuckMemory`), desvio repulsivo proativo via memória em `computeAvoidanceSteering` e permanência segura no local livre ao término da fuga.

### 3. Validação
- `npx vitest run apps/web-client`: **8 arquivos e 51 testes aprovados (100%)**.
- `npx vitest run tests/`: **22 arquivos e 112 testes aprovados (100%)**.
---

## Task ID: silenciamento-alertas-3-npcs-avatar-sem-aurea
- **Data:** 2026-10-19
- **Status:** Concluído
- **Responsável:** Agente Antigravity (Parceiro de Implementação)
- **Nível de Risco:** Baixo / UX & Performance Visual

### 1. Resumo Executivo
Atendimento à solicitação de refinamento de experiência urbana e visual:
1. **Silenciamento dos Alertas de Áudio de Bloqueio:** As notificações e falas de NPCs sobre bloqueios, obstáculos, saídas ou busca de locais livres continuam sendo expressas visualmente nos balões de fala 3D, porém com o áudio TTS (`speechSynth`) completamente suprimido.
2. **Redução para 3 NPCs Agentes Ativos:** O conjunto de cidadãos simulados na cidade foi otimizado para exatamente 3 agentes (`Vega`, `Sulafat` e `Sheliak`), mantendo suas rotas, papéis e desvios inteligentes de forma concentrada e fluida.
3. **Remoção da Áurea Mística do Avatar Daniel:** Eliminadas todas as cascas de fogo azul transparente, coroa de chamas, luz mística central, halos de piso e partículas de labaredas do DanielAvatar, mantendo o avatar com geometria limpa e colisão física íntegra.

### 2. Implementações Realizadas
- **Silenciamento de Áudio em Bloqueios (`agent-avatar.ts`):**
  - Adicionado parâmetro `playAudio: boolean = true` em `AgentAvatar.say()`.
  - Inserida verificação regex para mensagens de alerta de bloqueio/obstrução/saída/beco/livre/obstáculo (`isBlockageAlert`), suprimindo chamadas a `speechSynth.speak` caso verdadeiro ou caso `playAudio === false`.
  - Chamadas de alerta de fuga e chegada a local livre configuradas com `playAudio = false`.
- **Redução do Censo de NPCs para 3 Agentes (`agent-avatar.ts`):**
  - Reduzido o array `CITY_AGENTS` para conter os 3 agentes canônicos: `Vega`, `Sulafat` e `Sheliak`.
- **Limpeza do Avatar Daniel (`daniel-avatar.ts`):**
  - Removidos os campos `auraGroup`, `innerFlameShell`, `outerFlameShell`, `flameCrownShell`, `auraLight`, `flameParticles`, `auraGroundRing`, `auraGroundGlow` e `auraTime`.
  - Removidos os métodos `buildBlueFlameAura` e `updateBlueFlameAura`.
- **Testes Unitários Atualizados:**
  - `agent-avatar.spec.ts`: atualizado para testar exatamente os 3 NPCs ativos e verificar que alertas de bloqueio/fuga não disparam `speechSynth.speak`.
  - `daniel-avatar.spec.ts`: adicionado teste de integridade assegurando que Daniel não possui PointLight nem cascas de áurea mística.

### 3. Validação
- `npx vitest run apps/web-client`: **8 arquivos e 53 testes aprovados (100%)**.
- `npm test`: **26/26 projetos NX aprovados (100%)**.







