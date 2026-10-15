---
name: synapse-city-engine
version: 2.0.0
description: Arquitetura de software e contrato mestre para simulação de sociedades virtuais povoadas por agentes artificiais com identidade persistente, memória individual, capacidade de adaptação comportamental e aprendizagem social.
language: pt-BR
author: Daniel Ferreira de Almeida
tags:
  - synapse-city-engine
  - autonomous-agents
  - persistent-simulation
  - cognitive-architecture
  - episodic-memory
  - semantic-knowledge
  - procedural-memory
  - social-learning
  - three-js
  - modular-monolith
triggers:
  - synapse city
  - criar habitante
  - simular cidade
  - memoria episodica
  - conhecimento semantico
  - aprendizagem individual
  - aprendizagem social
  - consolidacao passiva
---

# SYNAPSE CITY ENGINE

**Versão:** 2.0.0  
**Autor:** Daniel Ferreira de Almeida  
**Status:** Em desenvolvimento  
**Categoria:** Simulação de mundos virtuais, agentes autônomos e aprendizagem individual e coletiva  
**Linguagem principal:** TypeScript  
**Arquitetura inicial:** Monólito modular com processamento assíncrono  
**Objetivo central:** Construir uma sociedade virtual persistente na qual habitantes artificiais aprendam por meio da experiência, desenvolvam comportamentos próprios e transmitam conhecimentos entre si.

---

# 1. VISÃO GERAL

## 1.1. Definição

A Synapse City Engine é uma arquitetura de software para simulação de sociedades virtuais povoadas por agentes artificiais com identidade persistente, memória individual, capacidade de adaptação comportamental e aprendizagem social.

O sistema integra:

- Ambiente virtual tridimensional.
- Simulação física e navegação espacial.
- Percepção de acontecimentos e objetos.
- Agentes com objetivos, preferências e estados persistentes.
- Memória episódica, semântica, procedural e social.
- Aprendizagem ativa durante as interações.
- Consolidação passiva de experiências.
- Transmissão e validação social de conhecimentos.
- Evolução de estratégias e comportamentos.
- Persistência temporal do mundo e de seus habitantes.
- Processamento distribuído e assíncrono, conforme a necessidade de escala.

A engine deve permitir que os habitantes alterem seu comportamento em função de experiências anteriores, adquiram conhecimentos sobre o ambiente, desenvolvam expectativas, aprendam uns com os outros e participem da formação de uma cultura coletiva.

A aprendizagem deve ser verificável por mudanças persistentes no conhecimento, nas estratégias ou nas decisões dos agentes, e não apenas pela capacidade de produzir respostas que afirmem que aprenderam.

## 1.2. Princípio fundamental

A Synapse City não deve ser concebida apenas como um conjunto de NPCs que recebem comandos de um modelo de linguagem.

Cada habitante deve possuir um estado individual persistente, composto por identidade operacional, conhecimentos, experiências, objetivos, estratégias, relações sociais e histórico de aprendizagem.

A evolução do habitante deverá resultar da interação entre:

1. Sua configuração inicial.
2. As características do ambiente.
3. As experiências vivenciadas.
4. Os resultados de suas ações.
5. As memórias recuperadas.
6. Os conhecimentos recebidos de outros habitantes.
7. Os processos de consolidação e revisão.
8. Os mecanismos de adaptação comportamental.

O sistema deverá distinguir a aparência de aprendizagem da aprendizagem efetivamente demonstrada por alterações consistentes no comportamento.

## 1.3. Limites conceituais

A engine busca produzir agentes com comportamento progressivamente autônomo e funcionalmente semelhante a aspectos da aprendizagem humana.

Isso não pressupõe consciência subjetiva, experiência fenomenológica ou identidade psicológica humana.

A arquitetura deve representar explicitamente os estados, conhecimentos, objetivos e processos dos agentes, sem tratar uma variável chamada `consciousness` ou uma declaração produzida por um LLM como prova de consciência.

---

# 2. PRINCÍPIOS ARQUITETURAIS

## 2.1. Separação entre mundo, cognição e aprendizagem

A arquitetura deverá separar três responsabilidades fundamentais.

**Mundo:** representa o ambiente, os objetos, o espaço, o tempo, as interações e as regras físicas.

**Cognição:** interpreta situações, recupera memórias, estabelece objetivos, avalia alternativas e seleciona ações.

**Aprendizagem:** transforma experiências em conhecimentos, habilidades, estratégias e mudanças comportamentais persistentes.

Essas responsabilidades deverão se comunicar por contratos explícitos e eventos estruturados.

Uma mudança no motor físico não deverá exigir a reescrita da memória dos habitantes. Da mesma forma, uma alteração no modelo de linguagem não deverá comprometer a persistência do mundo.

## 2.2. Separação entre simulação e renderização

O mundo deverá continuar funcionando independentemente da renderização gráfica.

O servidor será responsável pelo estado autoritativo da simulação, pelas regras de interação e pela validação das ações.

O cliente será responsável pela visualização, pelos controles do avatar do usuário e pela apresentação do estado recebido do servidor.

A frequência de renderização não deverá determinar a frequência dos processos cognitivos.

## 2.3. Separação entre memória e parâmetros neurais

A memória persistente não deverá depender da modificação contínua dos parâmetros de um modelo de linguagem.

O sistema deverá permitir que um habitante aprenda inicialmente por meio de:

- Armazenamento e recuperação de experiências.
- Atualização de conhecimentos estruturados.
- Revisão de crenças e expectativas.
- Aprendizagem de preferências.
- Adaptação de estratégias.
- Atualização de políticas de comportamento.

O ajuste de parâmetros de modelos especializados poderá ser introduzido posteriormente, mediante avaliação, versionamento e possibilidade de reversão.

## 2.4. Separação entre aprendizagem individual e coletiva

Cada habitante deverá possuir sua própria memória e seu próprio estado cognitivo.

A sociedade poderá manter conhecimentos compartilhados, mas o compartilhamento de uma informação não deverá sobrescrever automaticamente as memórias ou os parâmetros neurais de todos os agentes.

O sistema deverá distinguir:

- Conhecimento adquirido diretamente.
- Conhecimento recebido de outro habitante.
- Conhecimento corroborado por múltiplas fontes.
- Conhecimento verificado por mecanismos objetivos.
- Hipóteses ainda não confirmadas.
- Informações desatualizadas ou contraditórias.

## 2.5. Eficiência computacional

Nem toda ação deverá exigir inferência por um modelo de linguagem.

A engine deverá utilizar diferentes níveis de processamento conforme a complexidade da situação:

- Simulação rotineira por regras e sistemas determinísticos.
- Decisões contextuais baseadas em estado, memória e planejamento.
- Inferência avançada para situações novas, ambíguas ou socialmente complexas.

A consolidação de memórias e outras tarefas demoradas deverão ocorrer de forma assíncrona, sem bloquear o movimento ou as interações dos habitantes.

---

# 3. ARQUITETURA MODULAR

A primeira implementação deverá utilizar um monólito modular, organizado por domínios e preparado para separar processos ou serviços quando houver necessidade comprovada.

A estrutura proposta é:

```text
synapse-city/
├── apps/
│   ├── api/
│   ├── simulation-worker/
│   ├── cognition-worker/
│   ├── learning-worker/
│   └── web-client/
│
├── packages/
│   ├── core-domain/
│   ├── world-engine/
│   ├── agent-identity/
│   ├── agent-perception/
│   ├── agent-cognition/
│   ├── agent-planning/
│   ├── memory-system/
│   ├── learning-system/
│   ├── social-system/
│   ├── knowledge-system/
│   ├── event-system/
│   ├── llm-adapters/
│   ├── persistence/
│   └── observability/
│
├── infrastructure/
│   ├── docker/
│   ├── database/
│   └── monitoring/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── cognitive/
│   └── simulation/
│
└── docs/
    ├── architecture/
    ├── cognition/
    ├── memory/
    ├── learning/
    └── decisions/
```

A estrutura é uma referência inicial, não uma exigência de criar todos esses pacotes antes de implementar o primeiro habitante.

## 3.1. `world-engine` — O Mundo

Responsável pelo ambiente virtual e pelas regras da simulação.

### Componentes

- `WorldStateManager`: mantém o estado autoritativo do mundo.
- `EnvironmentService`: administra locais, objetos e características ambientais.
- `WorldEventPublisher`: publica acontecimentos relevantes.
- `ObjectInteractionService`: valida interações com objetos.
- `TimeSimulationService`: administra o tempo virtual.
- `SpatialQueryService`: consulta proximidade, visibilidade e relações espaciais.

### Responsabilidades

- Representar locais, objetos e entidades.
- Validar interações.
- Registrar mudanças relevantes no ambiente.
- Disponibilizar informações ambientais aos agentes.
- Preservar a consistência do estado da simulação.

O sistema deverá distinguir a existência de uma informação no mundo da percepção dessa informação por um habitante.

Uma placa pode existir no ambiente sem que todos os habitantes tenham lido seu conteúdo.

---

## 3.2. `agent-identity` — Identidade persistente

Responsável pela continuidade operacional dos habitantes.

### Componentes

- `AgentIdentityService`.
- `AgentStateManager`.
- `AgentProfileRepository`.
- `AgentGoalManager`.
- `AgentPreferenceManager`.

### Dados administrados

- Identificador persistente.
- Perfil inicial.
- Preferências.
- Objetivos.
- Histórico de alterações relevantes.
- Estado atual.
- Relações com outros habitantes.
- Referências às memórias individuais.

A identidade não deverá depender exclusivamente do contexto temporário de uma conversa com um LLM.

A reinicialização do servidor não poderá apagar automaticamente o histórico de um habitante.

As alterações relevantes de perfil e comportamento deverão ser rastreáveis.

---

## 3.3. `agent-perception` — Percepção

Responsável por transformar acontecimentos do mundo em observações disponíveis aos agentes.

### Componentes

- `PerceptionService`.
- `VisibilityResolver`.
- `SceneMetadataResolver`.
- `ObservationBuilder`.
- `PerceptionFilter`.
- `EventPriorityManager`.

### Fontes de percepção

- Objetos visíveis.
- Placas e textos.
- Sons simulados.
- Movimentos de entidades.
- Interações sociais.
- Mudanças ambientais.
- Consequências observáveis das próprias ações.

### Princípio de percepção

O agente não deverá receber automaticamente todo o conhecimento existente no banco de dados.

O sistema deverá considerar, quando aplicável:

- Distância.
- Campo de visão.
- Obstáculos.
- Atenção simulada.
- Conhecimentos anteriores.
- Capacidades sensoriais configuradas.

No MVP, a percepção poderá ser baseada em eventos estruturados e metadados do ambiente.

A interpretação direta de imagens deverá ser introduzida somente quando houver necessidade funcional.

---

## 3.4. `agent-cognition` — Cognição

Responsável pelo processamento contextual necessário à interpretação de situações e à seleção de ações.

### Componentes

- `CognitiveCycleManager`.
- `ContextBuilder`.
- `MemoryRetrievalService`.
- `SituationInterpreter`.
- `DecisionService`.
- `ActionSelector`.

### Ciclo cognitivo

1. Receber uma observação.
2. Identificar a situação relevante.
3. Recuperar memórias e conhecimentos relacionados.
4. Interpretar o contexto.
5. Identificar objetivos aplicáveis.
6. Avaliar alternativas.
7. Selecionar uma ação.
8. Produzir uma justificativa estruturada, quando necessária.
9. Encaminhar a ação para validação.
10. Observar o resultado posteriormente.

O ciclo poderá ser interrompido, retomado ou simplificado conforme a situação.

A implementação não deverá presumir que todas as decisões precisam ser tomadas por um LLM.

### Contrato de ação

Uma decisão deverá resultar em uma estrutura validável, por exemplo:

```typescript
interface AgentAction {
  agentId: string;
  actionType: string;
  targetId?: string;
  parameters: Record<string, unknown>;
  reasonCode?: string;
  expectedOutcome?: string;
}
```

O tipo de ação e seus parâmetros deverão ser validados pelo domínio responsável antes da execução.

O texto livre produzido pelo modelo não deverá ser executado diretamente como comando físico.

---

## 3.5. `agent-planning` — Planejamento e comportamento

Responsável pela transformação de objetivos em sequências de ações.

### Componentes

- `GoalPlanner`.
- `BehaviorPolicy`.
- `NavigationPlanner`.
- `PlanEvaluator`.
- `PlanRevisionService`.

### Responsabilidades

- Definir objetivos intermediários.
- Selecionar ações adequadas.
- Considerar recursos e restrições.
- Acompanhar resultados.
- Replanejar diante de obstáculos.
- Aprender com falhas recorrentes.
- Reutilizar estratégias que demonstraram eficácia.

O planejamento cognitivo deverá ser separado do cálculo geométrico das rotas.

Por exemplo, o agente decide visitar uma biblioteca; o serviço de navegação calcula uma rota possível.

A escolha de visitar a biblioteca pertence ao domínio cognitivo. O deslocamento até ela pertence ao domínio de navegação e simulação.

---

## 3.6. `memory-system` — Memória

Responsável pela persistência, recuperação, classificação e organização das experiências e dos conhecimentos.

### Componentes

- `MemoryManager`.
- `EpisodicMemoryService`.
- `SemanticMemoryService`.
- `ProceduralMemoryService`.
- `SocialMemoryService`.
- `MemoryRetrievalService`.
- `MemoryProvenanceService`.
- `MemoryDecayPolicy`.
- `MemoryConsolidationInterface`.

### Tipos de memória

**Memória episódica:** acontecimentos vivenciados, incluindo contexto, local, participantes e resultados.

**Memória semântica:** fatos, conceitos e conhecimentos construídos ou adquiridos.

**Memória procedural:** habilidades, estratégias e procedimentos que podem ser reutilizados.

**Memória social:** informações sobre relações, interações, confiança e conhecimentos recebidos de outras pessoas.

**Memória coletiva:** conhecimentos disponibilizados à comunidade, com origem, validade e condições de acesso.

Esses tipos representam categorias funcionais. Não precisam corresponder a bancos de dados separados.

### Proveniência

As memórias relevantes deverão registrar sua origem.

Exemplos:

- Observação direta.
- Resultado de uma ação.
- Informação recebida de outro agente.
- Informação fornecida pelo ambiente.
- Inferência derivada de outras memórias.
- Hipótese ainda não confirmada.

O sistema deverá preservar a distinção entre o acontecimento registrado e a interpretação produzida a partir dele.

### Recuperação

A recuperação de memórias poderá combinar:

- Similaridade semântica.
- Identificadores de entidades.
- Relevância temporal.
- Importância atribuída.
- Relação com os objetivos atuais.
- Origem e confiabilidade.
- Validade temporal.
- Filtros por agente e contexto.

A busca vetorial será um dos mecanismos de recuperação, não o único.

---

## 3.7. `learning-system` — Aprendizagem e consolidação

Este é um dos subsistemas centrais da Synapse City.

Sua responsabilidade é transformar experiências em mudanças persistentes e avaliáveis no conhecimento ou no comportamento dos habitantes.

### Componentes

- `ExperienceEvaluator`.
- `PredictionErrorAnalyzer`.
- `ActiveLearningService`.
- `MemoryConsolidationWorker`.
- `PatternDiscoveryService`.
- `KnowledgeRevisionService`.
- `StrategyAdaptationService`.
- `LearningEvaluationService`.

### A. Aprendizagem ativa

Ocorre durante a interação do habitante com o ambiente.

Fluxo:

1. Registrar uma expectativa, quando aplicável.
2. Executar ou observar uma ação.
3. Registrar o resultado.
4. Comparar o resultado com a expectativa.
5. Identificar discrepâncias.
6. Avaliar a relevância da experiência.
7. Atualizar conhecimentos ou estratégias quando houver evidências suficientes.

O sistema não deverá exigir que toda ação produza uma nova memória permanente.

### B. Consolidação passiva

Ocorre por meio de tarefas agendadas, durante períodos de inatividade ou em janelas de processamento reservadas.

Fluxo:

1. Selecionar experiências relevantes.
2. Recuperar o contexto original.
3. Agrupar experiências relacionadas.
4. Identificar padrões.
5. Detectar contradições.
6. Propor generalizações.
7. Avaliar a qualidade das evidências.
8. Atualizar memórias ou conhecimentos quando apropriado.
9. Preservar hipóteses e incertezas.
10. Registrar as alterações realizadas.

A consolidação não deverá inventar acontecimentos nem apresentar inferências como observações diretas.

O sistema deverá permitir rastrear quais experiências sustentam uma conclusão.

### C. Adaptação comportamental

O aprendizado deverá poder modificar, conforme as regras do sistema:

- Preferências.
- Estratégias.
- Expectativas.
- Estimativas de risco.
- Seleção de ações.
- Critérios de prioridade.
- Conhecimentos sobre o ambiente.

As alterações deverão ser persistentes e verificáveis.

### D. Aprendizagem neural avançada

A atualização de parâmetros de modelos poderá ser experimentada em uma etapa posterior.

Qualquer ajuste deverá contar com:

- Conjunto de treinamento rastreável.
- Avaliação anterior e posterior.
- Testes de regressão.
- Versionamento.
- Possibilidade de reversão.
- Monitoramento de perda de desempenho.
- Proteção contra contaminação por experiências falsas ou de baixa qualidade.

A atualização de parâmetros não deverá ser requisito para o funcionamento básico do sistema de aprendizagem.

---

## 3.8. `social-system` — Sociedade e relações

Responsável pelas interações sociais e pela estrutura de relações entre habitantes.

### Componentes

- `SocialInteractionService`.
- `RelationshipManager`.
- `CommunicationService`.
- `TrustAssessmentService`.
- `SocialLearningService`.
- `CommunityMembershipService`.

### Responsabilidades

- Registrar interações.
- Representar relações sociais.
- Armazenar informações sobre interações anteriores.
- Permitir a transmissão de conhecimentos.
- Avaliar a procedência de informações.
- Representar confiança como uma variável contextual.
- Identificar relações entre indivíduos e grupos.

A confiança não deverá ser tratada como garantia de veracidade.

O agente poderá confiar em uma fonte em determinados assuntos e ainda assim verificar informações importantes ou contraditórias.

---

## 3.9. `knowledge-system` — Conhecimento coletivo e cultura

Responsável pela organização de conhecimentos que podem circular entre habitantes.

### Componentes

- `SharedKnowledgeRepository`.
- `KnowledgePublicationService`.
- `KnowledgePropagationService`.
- `KnowledgeVerificationService`.
- `CulturalPracticeRegistry`.
- `KnowledgeVersionManager`.

### Fluxo de transmissão

1. Um habitante adquire ou formula um conhecimento.
2. O sistema registra a origem e a natureza desse conhecimento.
3. O habitante pode comunicá-lo a outro agente.
4. O receptor registra que recebeu a informação.
5. A informação passa a integrar seu contexto de conhecimento com a procedência preservada.
6. O receptor pode verificar, questionar ou rejeitar a informação.
7. Conhecimentos corroborados podem ser disponibilizados à comunidade conforme as regras do sistema.

O conhecimento coletivo não deverá substituir automaticamente as memórias individuais.

A arquitetura deverá permitir divergências, conhecimentos locais, informações desatualizadas e diferentes níveis de confiança.

A cultura poderá emergir da repetição e transmissão de práticas, convenções e conhecimentos, mas sua formação deverá ser observada por meio de indicadores definidos, não presumida pela simples existência de vários agentes.

---

## 3.10. `world-physics` — Física e navegação

Responsável pela execução das ações físicas e pelo estado espacial.

### Componentes

- `PhysicsSimulationService`.
- `CollisionResolver`.
- `NavigationService`.
- `SpatialIndexer`.
- `MovementController`.
- `ActionExecutionValidator`.

### Responsabilidades

- Resolver colisões.
- Aplicar regras físicas.
- Controlar deslocamentos.
- Calcular rotas.
- Validar condições espaciais.
- Informar o resultado de ações.
- Publicar eventos relevantes.

O motor físico deverá permanecer independente do raciocínio cognitivo.

Uma ação planejada por um agente poderá ser recusada ou ajustada se violar as regras do mundo.

---

## 3.11. `client-render` — Interface tridimensional

Responsável pela visualização da cidade e pela interação do usuário.

### Componentes

- `CityCanvas`.
- `AvatarController`.
- `CameraController`.
- `WorldRenderer`.
- `AgentRenderer`.
- `InteractionController`.
- `DebugOverlay`.

### Funcionalidades

- Renderização da cidade.
- Movimentação do avatar do usuário.
- Seleção e inspeção de habitantes.
- Apresentação de interações.
- Visualização de eventos.
- Ferramentas administrativas.
- Instrumentação para depuração.

A interface de depuração deverá distinguir, quando permitido, estado interno, memórias recuperadas, decisões registradas e ações executadas.

Uma justificativa textual produzida pelo LLM deverá ser tratada como uma explicação registrada pelo sistema, não como acesso garantido a todos os processos internos do modelo.

---

# 4. STACK TECNOLÓGICA

A stack deverá privilegiar tecnologias maduras, interfaces substituíveis e separação entre responsabilidades.

As versões exatas deverão ser fixadas e verificadas durante a implementação, priorizando versões estáveis, compatíveis e ainda suportadas.

| Camada | Tecnologia | Papel |
|---|---|---|
| Linguagem | TypeScript | Contratos e lógica de aplicação |
| Runtime | Node.js LTS suportado | Execução do backend |
| Backend | NestJS | Organização modular e APIs |
| Frontend | React + Vite | Interface web |
| Renderização 3D | Three.js + React Three Fiber | Representação do mundo |
| Física | Rapier | Colisões e simulação física |
| Navegação | Recast Navigation | Rotas e navegação espacial |
| Orquestração cognitiva | LangGraph.js, se justificado | Fluxos de decisão com estado e retomada |
| Integração com LLMs | SDKs por adaptadores | Acesso substituível a modelos |
| Banco relacional | PostgreSQL | Persistência estruturada |
| Banco vetorial | Qdrant | Recuperação semântica |
| Cache e coordenação | Redis | Estado temporário e coordenação |
| Filas e processamento | Workers assíncronos | Consolidação e tarefas demoradas |
| Conhecimento relacional temporal | Graphiti, a avaliar | Relações e fatos que mudam ao longo do tempo |
| Visão computacional | ONNX Runtime, quando necessário | Inferência de modelos especializados |
| OCR | Tesseract.js ou alternativa adequada | Leitura de textos em imagens, se necessária |
| Comunicação em tempo real | Socket.IO | Eventos e sincronização com o cliente |
| Infraestrutura local | Docker Compose | Desenvolvimento reproduzível |
| Testes | Ferramentas de teste compatíveis com TypeScript | Validação de módulos e fluxos |
| Observabilidade | Logs estruturados, métricas e rastreamento | Diagnóstico e avaliação |

## 4.1. Regras de seleção

A inclusão de uma dependência deverá ser justificada por uma necessidade concreta.

Nenhuma biblioteca de agentes deverá ser considerada responsável, sozinha, pela memória, aprendizagem, identidade e evolução social.

Os adaptadores de LLM deverão permitir substituir provedores sem reescrever a lógica central dos agentes.

O banco relacional será responsável pelos registros persistentes estruturados. O banco vetorial complementará a recuperação de informações.

O uso de Graphiti, ONNX Runtime e outros componentes especializados deverá depender de testes e necessidades identificadas durante o desenvolvimento.

---

# 5. MODELO DE DADOS E MEMÓRIAS

O sistema deverá manter registros estruturados das experiências e dos conhecimentos relevantes.

Um evento poderá conter:

```typescript
interface AgentExperience {
  id: string;
  agentId: string;
  eventType: string;
  description: string;
  occurredAt: string;
  locationId?: string;
  sourceType:
    | "direct_observation"
    | "action_result"
    | "agent_report"
    | "environment"
    | "inference";
  sourceAgentId?: string;
  confidence?: number;
  importance?: number;
  relatedEntityIds: string[];
  metadata?: Record<string, unknown>;
}
```

Esse contrato é ilustrativo. Os tipos de eventos, os critérios de confiança e as regras de validação deverão ser definidos pelo domínio.

## 5.1. Regras para persistência

- Nem todo evento deverá gerar uma memória de longo prazo.
- Experiências relevantes deverão preservar o contexto necessário para interpretação posterior.
- Memórias derivadas deverão manter referências às fontes utilizadas.
- Conhecimentos temporais deverão poder ser marcados como desatualizados.
- Atualizações importantes deverão possuir histórico.
- Memórias individuais não deverão ser compartilhadas sem uma regra explícita.
- A consolidação deverá ser idempotente sempre que possível, evitando duplicações em caso de reprocessamento.

## 5.2. Recuperação de memórias

A recuperação deverá considerar o contexto da decisão.

Uma lembrança semanticamente semelhante pode ser irrelevante para a situação atual. Da mesma forma, uma lembrança pouco semelhante em palavras pode ser importante devido ao local, ao objeto, à pessoa envolvida ou ao resultado de uma ação anterior.

A estratégia de recuperação deverá combinar os sinais disponíveis e registrar, quando necessário, por que uma memória foi selecionada.

---

# 6. CICLO OPERACIONAL DO HABITANTE

O ciclo operacional deverá integrar percepção, ação, avaliação e aprendizagem sem exigir que todas as etapas sejam executadas a cada atualização física.

## 6.1. Fluxo principal

1. **Percepção:** o agente recebe observações que pode acessar.
2. **Interpretação:** identifica aspectos relevantes da situação.
3. **Recuperação:** consulta memórias e conhecimentos pertinentes.
4. **Planejamento:** identifica objetivos e alternativas.
5. **Decisão:** seleciona uma ação.
6. **Validação:** o sistema verifica se a ação é permitida.
7. **Execução:** o mundo aplica a ação.
8. **Observação do resultado:** o agente recebe informações sobre as consequências observáveis.
9. **Avaliação:** compara resultados com expectativas, quando aplicável.
10. **Registro:** armazena experiências relevantes.
11. **Adaptação:** atualiza conhecimentos ou estratégias quando justificado.
12. **Consolidação posterior:** revisa experiências e conhecimentos em tarefas assíncronas.
13. **Aprendizagem social:** transmite ou recebe informações conforme as interações.
14. **Verificação:** testes e métricas avaliam se as mudanças produziram os efeitos esperados.

## 6.2. Frequência de execução

As etapas deverão funcionar em ritmos diferentes.

A física pode ser atualizada frequentemente. O planejamento pode ser acionado por eventos ou objetivos. A consolidação pode ocorrer em intervalos maiores.

A engine deverá evitar chamadas repetitivas a modelos de linguagem para ações previsíveis e rotineiras.

---

# 7. PROCESSAMENTO ASSÍNCRONO E ESCALABILIDADE

A arquitetura deverá permitir que tarefas cognitivas e de aprendizagem sejam processadas independentemente da renderização e das operações físicas.

## 7.1. Classes de processamento

**Classe A — Rotinas determinísticas**

- Movimento.
- Navegação.
- Atualização de estados simples.
- Regras físicas.
- Interações previamente definidas.

**Classe B — Decisões contextuais**

- Seleção de objetivos.
- Recuperação de memórias.
- Escolhas entre alternativas conhecidas.
- Revisão de estratégias.

**Classe C — Cognição complexa**

- Interpretação de situações ambíguas.
- Resolução de conflitos.
- Planejamento com múltiplas etapas.
- Generalização de experiências.
- Análise de contradições relevantes.

**Classe D — Aprendizagem em segundo plano**

- Consolidação de memórias.
- Identificação de padrões.
- Atualização de conhecimentos.
- Avaliação de estratégias.
- Preparação de conjuntos de dados para experimentos de treinamento.

## 7.2. Regras de escalabilidade

- Não executar um LLM continuamente para cada habitante.
- Não renderizar todos os habitantes com o mesmo nível de detalhe.
- Priorizar processamento conforme relevância, proximidade e acontecimentos.
- Preservar os dados persistentes independentemente da frequência de atualização.
- Utilizar filas para tarefas demoradas.
- Permitir retomar tarefas após falhas.
- Evitar que uma falha em um agente interrompa toda a simulação.
- Monitorar custo, latência, consumo de memória e taxa de erros.
- Testar a escalabilidade antes de introduzir microsserviços.

O número de habitantes suportados dependerá da complexidade dos agentes, da frequência de atualização, dos modelos utilizados e da infraestrutura disponível. A capacidade não deverá ser presumida antes de medições.

---

# 8. COMUNICAÇÃO E CONTRATOS ENTRE MÓDULOS

Os módulos deverão trocar eventos e comandos por contratos tipados.

Exemplos de eventos:

```text
world.object.discovered
world.object.changed
agent.observation.created
agent.action.requested
agent.action.executed
agent.action.failed
agent.experience.recorded
agent.memory.consolidation.requested
agent.memory.consolidated
agent.knowledge.proposed
agent.knowledge.shared
agent.knowledge.verified
agent.strategy.updated
```

Os nomes são exemplos e deverão ser padronizados durante a implementação.

## 8.1. Regras de comunicação

- Eventos deverão possuir identificadores únicos.
- A origem e o horário deverão ser registrados.
- Consumidores deverão lidar com reprocessamentos.
- A execução de ações físicas deverá ser validada.
- A comunicação entre módulos deverá evitar dependências circulares.
- Eventos de aprendizagem deverão preservar referências às experiências de origem.
- A comunicação em tempo real com o navegador não deverá ser confundida com o mecanismo interno de persistência.

Socket.IO poderá transportar atualizações ao cliente, mas não deverá ser a única garantia de persistência ou entrega de eventos críticos.

---

# 9. OBSERVABILIDADE E AVALIAÇÃO COGNITIVA

A Synapse City deverá possuir mecanismos para verificar se os habitantes estão realmente evoluindo.

## 9.1. Indicadores de continuidade

- Persistência de identidade após reinicializações.
- Recuperação de memórias relevantes.
- Continuidade dos objetivos.
- Coerência entre conhecimentos registrados e decisões.

## 9.2. Indicadores de aprendizagem

- Redução de erros em tarefas repetidas.
- Alteração de estratégias após resultados desfavoráveis.
- Generalização para situações semelhantes.
- Recuperação adequada de experiências anteriores.
- Capacidade de reconhecer informações contraditórias.
- Preservação da origem e do grau de incerteza das informações.

## 9.3. Indicadores de aprendizagem social

- Conhecimentos transmitidos entre habitantes.
- Retenção de informações recebidas.
- Capacidade de distinguir relato de experiência direta.
- Correção de informações desatualizadas.
- Formação e disseminação de práticas compartilhadas.
- Divergências entre conhecimentos individuais e coletivos.

## 9.4. Testes controlados

Os testes deverão comparar o desempenho dos agentes antes e depois das experiências.

Sempre que possível, deverão utilizar cenários reproduzíveis, estados iniciais controlados e métricas previamente definidas.

A avaliação deverá distinguir:

- Mudança de resposta textual.
- Mudança de memória.
- Mudança de estratégia.
- Melhoria efetiva de desempenho.
- Generalização para uma situação não idêntica à experiência original.

O sucesso do projeto não deverá ser medido apenas pela fluidez das conversas ou pela aparência de personalidade dos habitantes.

---

# 10. SEGURANÇA E INTEGRIDADE DO SISTEMA

Os habitantes deverão operar dentro das regras do mundo virtual.

O sistema deverá separar a produção de decisões da autorização para executá-las.

Requisitos:

- Validar todas as ações recebidas do subsistema cognitivo.
- Impedir que texto livre seja interpretado diretamente como comando de infraestrutura.
- Controlar o acesso a dados e ferramentas.
- Registrar alterações relevantes no estado do mundo.
- Preservar a procedência de conhecimentos compartilhados.
- Proteger dados administrativos.
- Permitir auditar e reverter atualizações problemáticas.
- Tratar mensagens de outros agentes como informações potencialmente incorretas.
- Evitar que conteúdos recebidos sejam executados como instruções privilegiadas.

A arquitetura deverá contemplar também os riscos de propagação de informações falsas, ciclos de reforço de erros e contaminação de memórias compartilhadas.

---

# 11. ROADMAP DE IMPLEMENTAÇÃO

## Fase 1 — Fundação

Objetivo: estabelecer o mundo e a persistência.

- [ ] Configurar o repositório e a organização modular.
- [ ] Configurar TypeScript e o backend.
- [ ] Configurar PostgreSQL.
- [ ] Implementar o estado persistente do mundo.
- [ ] Criar os contratos de eventos.
- [ ] Criar uma API mínima.
- [ ] Implementar testes de persistência e integridade.

**Critério de conclusão:** o mundo mantém seu estado após reinicializações e as operações fundamentais são verificáveis.

## Fase 2 — Ambiente tridimensional

Objetivo: conectar a representação visual à simulação.

- [ ] Integrar React, Vite e Three.js.
- [ ] Implementar a cena inicial.
- [ ] Integrar Rapier quando necessário.
- [ ] Implementar navegação espacial.
- [ ] Criar o avatar do usuário.
- [ ] Integrar a comunicação em tempo real.
- [ ] Validar a autoridade do servidor sobre o estado do mundo.

**Critério de conclusão:** o usuário consegue interagir com um ambiente persistente e observar os resultados no cliente.

## Fase 3 — Primeiro habitante

Objetivo: construir um agente com identidade e comportamento persistentes.

- [ ] Criar identidade individual.
- [ ] Implementar percepção baseada em eventos.
- [ ] Definir objetivos simples.
- [ ] Implementar planejamento e execução de ações.
- [ ] Criar memória episódica.
- [ ] Integrar um modelo de linguagem por meio de um adaptador.
- [ ] Implementar recuperação contextual.
- [ ] Testar continuidade após reinicializações.

**Critério de conclusão:** o habitante recupera experiências anteriores e utiliza informações relevantes em decisões posteriores.

## Fase 4 — Aprendizagem ativa

Objetivo: transformar experiências em mudanças comportamentais.

- [ ] Registrar expectativas e resultados.
- [ ] Avaliar erros e sucessos.
- [ ] Implementar atualização de conhecimentos.
- [ ] Implementar adaptação de estratégias.
- [ ] Criar testes de aprendizagem em tarefas repetidas.
- [ ] Testar a generalização para situações semelhantes.

**Critério de conclusão:** experiências anteriores produzem alterações persistentes e mensuráveis no comportamento.

## Fase 5 — Consolidação passiva

Objetivo: revisar experiências fora do ciclo imediato de interação.

- [ ] Implementar filas e workers.
- [ ] Criar tarefas de consolidação.
- [ ] Identificar experiências relacionadas.
- [ ] Propor generalizações.
- [ ] Detectar contradições.
- [ ] Preservar incertezas e procedência.
- [ ] Testar a recuperação dos conhecimentos consolidados.
- [ ] Comparar os resultados com agentes sem consolidação.

**Critério de conclusão:** a consolidação melhora ou mantém o desempenho sem introduzir degradação sistemática de conhecimentos anteriores.

## Fase 6 — Sociedade e aprendizagem coletiva

Objetivo: permitir a transmissão de conhecimentos entre habitantes.

- [ ] Introduzir múltiplos habitantes.
- [ ] Criar registros de interação social.
- [ ] Implementar memória social.
- [ ] Permitir transmissão de informações.
- [ ] Preservar a origem dos conhecimentos recebidos.
- [ ] Implementar mecanismos de validação.
- [ ] Testar disseminação e correção de informações.
- [ ] Avaliar a formação de práticas compartilhadas.

**Critério de conclusão:** conhecimentos adquiridos por um habitante podem influenciar outros sem eliminar a individualidade de suas memórias.

## Fase 7 — Escalabilidade

Objetivo: aumentar a população e o volume de interações.

- [ ] Medir o custo por habitante.
- [ ] Separar as frequências de física, cognição e consolidação.
- [ ] Introduzir processamento por relevância.
- [ ] Otimizar recuperação de memórias.
- [ ] Implementar filas resilientes.
- [ ] Medir latência, uso de memória e custos de inferência.
- [ ] Executar testes de carga.
- [ ] Separar serviços somente quando os resultados justificarem.

**Critério de conclusão:** a população aumenta sem perda inaceitável de consistência, desempenho ou qualidade cognitiva.

## Fase 8 — Aprendizagem avançada

Objetivo: investigar formas adicionais de adaptação.

- [ ] Avaliar aprendizado por reforço em tarefas controladas.
- [ ] Experimentar modelos especializados.
- [ ] Avaliar fine-tuning e LoRA, se houver justificativa.
- [ ] Criar conjuntos de avaliação independentes.
- [ ] Implementar versionamento e reversão.
- [ ] Testar regressões e perda de conhecimentos anteriores.

**Critério de conclusão:** qualquer mecanismo adicional de aprendizagem demonstra benefícios mensuráveis em relação à arquitetura baseada em memória e adaptação comportamental.

---

# 12. REQUISITOS PARA CONTRIBUIDORES

Os colaboradores deverão compreender os princípios arquiteturais do projeto e respeitar a separação entre simulação, cognição, memória e aprendizagem.

Competências desejáveis:

1. TypeScript e arquitetura de aplicações.
2. Sistemas orientados a eventos.
3. Persistência relacional e busca semântica.
4. Integração com modelos de linguagem.
5. Sistemas de agentes e planejamento.
6. Simulação de ambientes e navegação.
7. Processamento assíncrono.
8. Testes automatizados e avaliação experimental.
9. Observabilidade e otimização de desempenho.
10. Modelagem de relações sociais e conhecimento temporal.

Toda nova dependência deverá ser acompanhada de uma justificativa técnica.

Toda nova capacidade de aprendizagem deverá ser acompanhada de critérios de avaliação.

Mudanças nos contratos centrais deverão ser documentadas.

---

# 13. DEFINIÇÃO DE SUCESSO

A Synapse City será considerada funcionalmente bem-sucedida quando demonstrar, por meio de testes reproduzíveis, que seus habitantes conseguem:

- Manter identidade e estado persistentes.
- Recuperar experiências relevantes.
- Modificar estratégias com base nos resultados de suas ações.
- Construir conhecimentos a partir de experiências.
- Consolidar informações sem confundir inferências com acontecimentos.
- Corrigir conhecimentos desatualizados.
- Receber e transmitir informações.
- Preservar diferenças entre memórias individuais.
- Participar da formação de conhecimentos compartilhados.
- Continuar operando em uma simulação persistente.
- Evoluir sem depender de chamadas constantes a modelos de linguagem.

A semelhança comportamental com seres humanos poderá ser investigada como uma propriedade emergente e mensurável de determinadas tarefas. Ela não deverá ser usada, isoladamente, como prova de consciência ou experiência subjetiva.

---

# 14. DIRETRIZ FINAL

A Synapse City Engine deverá evoluir de maneira incremental, preservando a simplicidade operacional do MVP e a possibilidade de expansão futura.

A prioridade inicial não é simular uma sociedade inteira, mas demonstrar que um habitante pode perceber, agir, aprender, lembrar e modificar seu comportamento de forma persistente.

Depois, essa capacidade deverá ser ampliada para múltiplos habitantes, transmissão de conhecimentos, consolidação coletiva e simulação em maior escala.

**A unidade fundamental do projeto não é o NPC renderizado. É o habitante persistente, cuja experiência produz consequências verificáveis para seu conhecimento e seu comportamento.**

O mundo virtual oferece as experiências; a arquitetura cognitiva interpreta as situações; a memória preserva a história; o sistema de aprendizagem transforma experiências em mudanças; e a sociedade permite que parte desse conhecimento circule entre indivíduos.

Essa integração constitui o núcleo da Synapse City Engine.
