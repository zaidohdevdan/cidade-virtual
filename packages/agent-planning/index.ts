export interface PlanStep {
  stepIndex: number;
  action: string;
  target?: string;
}

export class GoalPlanner {
  generatePlan(goal: string): PlanStep[] {
    return [
      { stepIndex: 1, action: 'observe_environment', target: goal },
      { stepIndex: 2, action: 'navigate_to_target', target: goal },
    ];
  }
}
