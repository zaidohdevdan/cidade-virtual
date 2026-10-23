// apps/api/src/modules/citizens/citizens.seed.ts
import type { CitizenArchetype, EmotionState } from '@cidade-virtual/types';
import type { Personality } from '@cidade-virtual/agent-planning';

export interface SeedExperience {
  eventType: string;
  description: string;
  sourceType: 'direct_observation' | 'environment' | 'inference';
  confidence: string;
  importance: string;
  locationId?: string;
}

export interface SeedCitizenConfig {
  id: string;
  name: string;
  archetype: CitizenArchetype;
  starDesignation: string;
  role: string;
  backstorySeed: string;
  activeGoals: string[];
  personality?: Personality;
  initialPosition: { x: number; y: number; z: number };
  initialEmotion: EmotionState;
  initialExperiences: SeedExperience[];
}

/**
 * Habitante canônico do MVP (Sulafat, arquétipo worker), alinhado com o frontend.
 */
export const SEED_CITIZENS: SeedCitizenConfig[] = [
  {
    id: 'agent-sulafat',
    name: 'Sulafat',
    archetype: 'worker',
    starDesignation: 'Gamma Lyrae (γ Lyr)',
    role: 'Cientista & Ecologista Urbana',
    backstorySeed: 'Dedicada à preservação ambiental e à gestão de resíduos sólidos municipais.',
    activeGoals: ['manter calçadas limpas', 'estudar flora da praça', 'descarte sustentável'],
    personality: {
      openness: 0.85,
      conscientiousness: 0.85,
      extraversion: 0.5,
      agreeableness: 0.85,
      neuroticism: 0.2,
    },
    initialPosition: { x: -25, y: 0.19, z: -5 },
    initialEmotion: 'curious',
    initialExperiences: [
      {
        eventType: 'trash_bin_inspected',
        description: 'Inspecionou a lixeira pública municipal logo em frente à placa de advertência ecológica.',
        sourceType: 'direct_observation',
        confidence: '0.96',
        importance: '0.85',
        locationId: 'lixeira-1',
      },
      {
        eventType: 'waste_disposal_noted',
        description: 'Observou o descarte consciente de resíduos por pedestres ao longo da calçada sul.',
        sourceType: 'direct_observation',
        confidence: '0.90',
        importance: '0.80',
        locationId: 'calcada-sul',
      },
      {
        eventType: 'flora_sample_analyzed',
        description: 'Coletou dados ambientais e inspecionou a arborização urbana ao redor da praça central.',
        sourceType: 'direct_observation',
        confidence: '0.94',
        importance: '0.75',
        locationId: 'praca-central',
      },
    ],
  },
];

/** Roster MVP: apenas Sulafat. Fonte única de verdade para backend e front. */
export const ALL_CITIZENS: SeedCitizenConfig[] = [...SEED_CITIZENS];
