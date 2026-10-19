// packages/agent-planning/htn-decomposer.ts
// Decomposição hierárquica de tarefas (HTN) para comportamentos urbanos

import type { PlanStep } from './types.js';
import { normalizeGoalKey } from './memory-store.js';

export class HTNDecomposer {
  /**
   * Decompõe uma meta de alto nível em uma sequência ordenada de passos operacionais.
   */
  decompose(goal: string, context?: Record<string, unknown>): PlanStep[] {
    const key = normalizeGoalKey(goal);

    if (key.includes('praca') || key.includes('praza') || key.includes('square')) {
      return this.decomposePracaGoal(goal, context);
    }

    if (key.includes('patrulh') || key.includes('guarda') || key.includes('ronda')) {
      return this.decomposePatrolGoal(goal, context);
    }

    if (key.includes('trabalh') || key.includes('servico') || key.includes('posto')) {
      return this.decomposeWorkGoal(goal, context);
    }

    if (key.includes('compr') || key.includes('loja') || key.includes('mercado')) {
      return this.decomposeTradeGoal(goal, context);
    }

    return this.decomposeGenericGoal(goal, context);
  }

  private decomposePracaGoal(goal: string, context?: Record<string, unknown>): PlanStep[] {
    const targetLocation = 'Praca_Central_Core';
    return [
      {
        stepIndex: 1,
        action: 'observe_environment',
        target: 'Avenida_Central_Sidewalk',
        description: 'Mapear arredores e identificar pontos de referência até a praça',
        parameters: { scanRadiusMeters: 25, focus: 'pedestrian_route' },
        status: 'pending',
        estimatedDurationMs: 1500,
      },
      {
        stepIndex: 2,
        action: 'navigate_to_waypoint',
        target: 'Waypoint_Sidewalk_North',
        description: 'Navegar com segurança pela calçada da Avenida Central em direção ao setor sul',
        parameters: { speed: 1.2, sidewalkOnly: true },
        status: 'pending',
        estimatedDurationMs: 4000,
      },
      {
        stepIndex: 3,
        action: 'avoid_obstacles',
        target: 'Pedestrian_Obstacle_Zone',
        description: 'Detectar e contornar pedestres e mobiliário urbano no passeio público',
        parameters: { clearanceRadius: 1.0, reactiveAvoidance: true },
        status: 'pending',
        estimatedDurationMs: 2500,
      },
      {
        stepIndex: 4,
        action: 'cross_pedestrian_walkway',
        target: 'Crosswalk_Central_01',
        description: 'Aguardar sinal seguro e realizar a travessia na faixa de pedestres',
        parameters: { crosswalkId: 'crosswalk-central-01', obeyTrafficLight: true },
        status: 'pending',
        estimatedDurationMs: 3500,
      },
      {
        stepIndex: 5,
        action: 'arrive_at_destination',
        target: targetLocation,
        description: 'Chegar ao destino na Praça Central e registrar conclusão da meta',
        parameters: { finalGoal: goal, recordArrivalExperience: true },
        status: 'pending',
        estimatedDurationMs: 1000,
      },
    ];
  }

  private decomposePatrolGoal(goal: string, context?: Record<string, unknown>): PlanStep[] {
    return [
      {
        stepIndex: 1,
        action: 'inspect_checkpoint_north',
        target: 'Checkpoint_Alpha',
        description: 'Inspecionar perímetro norte da via pública',
        status: 'pending',
        estimatedDurationMs: 2000,
      },
      {
        stepIndex: 2,
        action: 'navigate_avenue_patrol',
        target: 'Avenida_Central_Main',
        description: 'Percorrer a Avenida Central mantendo patrulha ostensiva',
        status: 'pending',
        estimatedDurationMs: 5000,
      },
      {
        stepIndex: 3,
        action: 'monitor_traffic_compliance',
        target: 'Traffic_Light_01',
        description: 'Monitorar pedestres e fluxo veicular no cruzamento principal',
        status: 'pending',
        estimatedDurationMs: 3000,
      },
      {
        stepIndex: 4,
        action: 'log_patrol_report',
        target: 'Security_Log',
        description: 'Registrar relatório de segurança pública e conformidade urbana',
        status: 'pending',
        estimatedDurationMs: 1000,
      },
    ];
  }

  private decomposeWorkGoal(goal: string, context?: Record<string, unknown>): PlanStep[] {
    return [
      {
        stepIndex: 1,
        action: 'prepare_work_route',
        target: 'Residence_Exit',
        description: 'Traçar rota para o posto de trabalho municipal',
        status: 'pending',
        estimatedDurationMs: 1500,
      },
      {
        stepIndex: 2,
        action: 'navigate_sidewalk',
        target: 'Commercial_Sector_Sidewalk',
        description: 'Deslocar-se pela calçada urbana com velocidade moderada',
        status: 'pending',
        estimatedDurationMs: 4000,
      },
      {
        stepIndex: 3,
        action: 'cross_crosswalk_safely',
        target: 'Crosswalk_Central_01',
        description: 'Atravessar cruzamento com atenção redobrada ao semáforo veicular',
        status: 'pending',
        estimatedDurationMs: 3000,
      },
      {
        stepIndex: 4,
        action: 'clock_in_workplace',
        target: 'Municipal_Workshop',
        description: 'Ingressar no posto de serviço e iniciar jornada produtiva',
        status: 'pending',
        estimatedDurationMs: 1000,
      },
    ];
  }

  private decomposeTradeGoal(goal: string, context?: Record<string, unknown>): PlanStep[] {
    return [
      {
        stepIndex: 1,
        action: 'locate_commercial_store',
        target: 'Market_Zone',
        description: 'Localizar estabelecimento comercial com mercadorias disponíveis',
        status: 'pending',
        estimatedDurationMs: 1500,
      },
      {
        stepIndex: 2,
        action: 'navigate_commercial_zone',
        target: 'Store_Entrance',
        description: 'Caminhar com segurança até a zona de comércio',
        status: 'pending',
        estimatedDurationMs: 3500,
      },
      {
        stepIndex: 3,
        action: 'request_merchant_trade',
        target: 'Merchant_Counter',
        description: 'Interagir com vendedor e negociar itens essenciais',
        status: 'pending',
        estimatedDurationMs: 2000,
      },
      {
        stepIndex: 4,
        action: 'verify_wallet_balance',
        target: 'Ledger_Wallet',
        description: 'Confirmar débito em carteira interna e concluir transação',
        status: 'pending',
        estimatedDurationMs: 1000,
      },
    ];
  }

  private decomposeGenericGoal(goal: string, context?: Record<string, unknown>): PlanStep[] {
    return [
      {
        stepIndex: 1,
        action: 'survey_route',
        target: goal,
        description: `Analisar ambiente e traçar rota preliminar para '${goal}'`,
        status: 'pending',
        estimatedDurationMs: 1500,
      },
      {
        stepIndex: 2,
        action: 'navigate_intermediate_waypoint',
        target: goal,
        description: 'Deslocamento seguro pela malha viária urbana',
        status: 'pending',
        estimatedDurationMs: 4000,
      },
      {
        stepIndex: 3,
        action: 'mitigate_urban_hazards',
        target: goal,
        description: 'Evitar obstáculos móveis e aguardar sinalizações de trânsito',
        status: 'pending',
        estimatedDurationMs: 2500,
      },
      {
        stepIndex: 4,
        action: 'reach_target_goal',
        target: goal,
        description: `Atingir objetivo final '${goal}' e consolidar memória`,
        status: 'pending',
        estimatedDurationMs: 1000,
      },
    ];
  }
}
