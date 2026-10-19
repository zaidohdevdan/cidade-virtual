# Checklist OWASP Top 10 Reduzido — Synapse City Engine (Task-022)

Este documento atesta a conformidade de segurança da Synapse City com o checklist reduzido do OWASP Top 10, obrigatório antes da exposição pública da API e dos WebSockets do ambiente virtual persistente.

---

## 1. A01:2021 — Broken Access Control (Controle de Acesso Quebrado)
- **Status:** ✅ Em conformidade
- **Implementação:**
  - O handshake do WebSocket (`/world`) exige autenticação via token JWT (`socket.handshake.auth.token`). Handshakes anônimos são rejeitados com `AUTHENTICATION_FAILED`.
  - Controle de Acesso Baseado em Papéis (RBAC): O comando administrativo de controle semafórico (`traffic_light:set`) é estritamente restrito a usuários com `role: 'admin'`. Tentativas por outros papéis (`guest`, `citizen`) são bloqueadas com código `FORBIDDEN` e registradas em log de auditoria `[SECURITY] [AUDIT]`.
  - Validação server-side de movimentação: o servidor rejeita posições fora dos limites territoriais da cidade ($X, Z \in [-65, 65]$), posições dentro de edifícios/obstáculos, saltos instantâneos ($> 20\text{ m}$) e transposição de paredes (*wall phasing*).

## 2. A02:2021 — Cryptographic Failures (Falhas Criptográficas)
- **Status:** ✅ Em conformidade
- **Implementação:**
  - Segredos fora do código-fonte: `JWT_SECRET` é lido a partir das variáveis de ambiente (`process.env.JWT_SECRET`).
  - Resolução segura multi-tiered (`jwt.util.ts`): Na ausência de variável de ambiente, um segredo efêmero de 256 bits é gerado em tempo de execução via `crypto.randomBytes(32)` com alerta explícito de isolamento por instância, eliminando qualquer risco de chaves padrão/estáticas (*hardcoded secrets*).
  - Assinatura e verificação exclusivas com o algoritmo seguro `HS256`, rejeitando qualquer tentativa com algoritmo `none`.
  - Requisitos de produção: Terminação TLS/HTTPS/WSS via reverse proxy (Nginx/Caddy).

## 3. A03:2021 — Injection (Injeção de Código e SQL)
- **Status:** ✅ Em conformidade
- **Implementação:**
  - Todas as 8 ferramentas do sistema (`@cidade-virtual/tools`) utilizam validação rigorosa de *schema* em tempo de execução com `Zod`.
  - Consultas ao PostgreSQL em `@cidade-virtual/persistence` utilizam exclusivamente o Drizzle ORM com consultas preparadas e parametrizadas (`prepared statements`), sem concatenação direta de strings SQL.
  - Payloads de posição de avatar recebidos via socket são sanitizados para garantir tipos numéricos válidos e rejeitar valores `NaN` ou injeções de atributos.

## 4. A04:2021 — Insecure Design (Design Inseguro)
- **Status:** ✅ Em conformidade
- **Implementação:**
  - Arquitetura autoritativa server-side: O ciclo semafórico DENATRAN de 2 fases roda exclusivamente no backend (`WorldGateway`), mantendo todos os clientes sincronizados e imunes a manipulações de tempo locais.
  - Modelo de colisão estática autoritativa em `@cidade-virtual/config`: O servidor verifica trajetórias e colisões contra o mapa urbano real antes de propagar qualquer movimento para os demais avatares.
  - Princípio do Menor Privilégio (*Least Privilege*): Contas de convidados recebem apenas permissão de transmissão de telemetria básica no mundo.

## 5. A05:2021 — Security Misconfiguration (Configuração Insegura)
- **Status:** ✅ Em conformidade
- **Implementação:**
  - Proteção de cabeçalhos HTTP com `@fastify/helmet`:
    - Content Security Policy (CSP) restrito (`default-src 'self'`).
    - Prevenção contra *clickjacking* via `X-Frame-Options: DENY` e CSP `frame-ancestors: 'none'`.
    - Proteção contra *MIME-sniffing* via `X-Content-Type-Options: nosniff`.
  - CORS por whitelist estrita configurável via `CORS_ALLOWED_ORIGINS` (sem wildcard `*`).
  - Segurança de binding de rede: A API escuta em `127.0.0.1` em desenvolvimento e testes, liberando `0.0.0.0` apenas sob flag explícita de produção.

## 6. A06:2021 — Vulnerable and Outdated Components (Componentes Desatualizados/Vulneráveis)
- **Status:** ✅ Em conformidade
- **Implementação:**
  - Dependências gerenciadas via monorepo npm workspaces com versões fixadas.
  - Auditoria regular via `npm audit` e varredura estática de dependências.
  - Separação entre pacotes de produção e desenvolvimento.

## 7. A07:2021 — Identification and Authentication Failures (Falhas de Identificação e Autenticação)
- **Status:** ✅ Em conformidade
- **Implementação:**
  - Tokens JWT contêm *claim* obrigatória de expiração (`exp`), rejeitando tokens expirados.
  - Verificação server-side em cada handshake do WebSocket e nas rotas protegidas da API HTTP (`/auth/me`).
  - Rate limiting HTTP derivado de `OPERATIONAL_LIMITS.maxHttpRequestsPerMinute` (120 req/min) via `@fastify/rate-limit`.

## 8. A08:2021 — Software and Data Integrity Failures (Falhas de Integridade de Software e Dados)
- **Status:** ✅ Em conformidade
- **Implementação:**
  - Validação estrita de contratos de domínio tipados em `@cidade-virtual/types` compartilhados entre API e cliente.
  - Script automatizado de verificação de *drift* de banco de dados (`scripts/check-schema-drift.ts`), garantindo 100% de paridade entre o banco físico (`init.sql`), esquemas ORM (`schema.ts`) e tipos TypeScript.

## 9. A09:2021 — Security Logging and Monitoring Failures (Falhas de Logging e Monitoramento de Segurança)
- **Status:** ✅ Em conformidade
- **Implementação:**
  - Todas as violações de segurança disparam logs estruturados com tag `[SECURITY] [AUDIT]`:
    - Falhas de autenticação no handshake do socket.
    - Tentativas não autorizadas de execução de comandos administrativos (God Mode).
    - Detecção de movimentos forjados, atravessamento de paredes (*wall phasing*) e saltos de teletransporte anômalos.
    - Violações de *rate limit* por socket ou por IP.
    - Chamadas a LLMs e deliberações de habitantes registram `metrics.increment` e logs auditáveis.

## 10. A10:2021 — Server-Side Request Forgery (SSRF)
- **Status:** ✅ Em conformidade
- **Implementação:**
  - Conexões com serviços de infraestrutura (Qdrant, Redis BullMQ, PostgreSQL) e provedores de IA são estritamente configuradas por variáveis de ambiente validadas, nunca aceitando URLs arbitrárias enviadas pelos clientes do mundo virtual.

---
*Relatório emitido em 2026-10-18 como parte da entrega da Task-022.*
