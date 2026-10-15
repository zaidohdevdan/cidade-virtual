# Arquitetura do Synapse City Engine (v2.0.0)

## Princípios Centrais
1. **Separação entre Mundo, Cognição e Aprendizagem:** O motor físico, o ciclo de raciocínio e a consolidação de memórias operam de forma desacoplada.
2. **Autoridade do Servidor vs. Renderização:** O mundo virtual e seus habitantes persistem e evoluem no backend; o cliente visual (Three.js) apenas reflete e interage com o estado.
3. **Memória Estruturada vs. Parâmetros Neurais:** A aprendizagem inicial baseia-se em experiências persistidas no PostgreSQL e recuperação semântica no Qdrant, com proveniência rastreável.
