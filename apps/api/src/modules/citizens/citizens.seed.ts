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
 * 5 Habitantes canônicos com arquétipos variados da Task-013:
 * worker, guard, citizen, child, elder — alinhados com o frontend (Lira).
 */
export const SEED_CITIZENS: SeedCitizenConfig[] = [
  {
    id: 'agent-vega',
    name: 'Vega',
    archetype: 'guard',
    starDesignation: 'Alpha Lyrae (α Lyr)',
    role: 'Pioneira & Navegadora de Segurança',
    backstorySeed: 'Responsável pela observação e segurança viária na Avenida Central.',
    activeGoals: ['monitorar semáforo', 'garantir travessia segura', 'prevenir infrações'],
    personality: {
      openness: 0.7,
      conscientiousness: 0.9,
      extraversion: 0.6,
      agreeableness: 0.8,
      neuroticism: 0.25,
    },
    initialPosition: { x: -4, y: 0.19, z: -25 },
    initialEmotion: 'calm',
    initialExperiences: [
      {
        eventType: 'traffic_law_observed',
        description: 'Observou a placa PROIBIDO JOGAR LIXO na calçada e orientou pedestres sobre a Lei 12.305/10.',
        sourceType: 'direct_observation',
        confidence: '0.98',
        importance: '0.90',
        locationId: 'placa-lixo-1',
      },
      {
        eventType: 'signal_cycle_monitored',
        description: 'Monitorou o ciclo do semáforo da Rua Central garantindo que veículos respeitem a linha de retenção.',
        sourceType: 'direct_observation',
        confidence: '0.95',
        importance: '0.85',
        locationId: 'semaforo-1',
      },
      {
        eventType: 'patrol_completed',
        description: 'Conduziu patrulha preventiva pelo cruzamento e registrou fluxo urbano pacífico.',
        sourceType: 'direct_observation',
        confidence: '0.92',
        importance: '0.70',
        locationId: 'cruzamento-central',
      },
    ],
  },
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
  {
    id: 'agent-sheliak',
    name: 'Sheliak',
    archetype: 'citizen',
    starDesignation: 'Beta Lyrae (β Lyr)',
    role: 'Engenheiro & Cidadão Ativo',
    backstorySeed: 'Engenheiro mecânico focado na infraestrutura viária e mobilidade urbana.',
    activeGoals: ['otimizar circulação', 'respeitar faixas de travessia', 'mobilidade fluida'],
    personality: {
      openness: 0.75,
      conscientiousness: 0.7,
      extraversion: 0.85,
      agreeableness: 0.75,
      neuroticism: 0.25,
    },
    initialPosition: { x: 20, y: 0.19, z: -14 },
    initialEmotion: 'joyful',
    initialExperiences: [
      {
        eventType: 'crosswalk_traversed',
        description: 'Utilizou a faixa de pedestres reflexiva no centro da Avenida Central.',
        sourceType: 'direct_observation',
        confidence: '0.95',
        importance: '0.85',
        locationId: 'faixa-pedestres',
      },
      {
        eventType: 'signal_lamps_inspected',
        description: 'Analisou a sincronização das lâmpadas volumétricas do semáforo na esquina nordeste.',
        sourceType: 'direct_observation',
        confidence: '0.90',
        importance: '0.75',
        locationId: 'semaforo-1',
      },
      {
        eventType: 'traffic_fluidity_approved',
        description: 'Apreciou a fluidez dos automóveis circulando em conformidade com o CTB.',
        sourceType: 'direct_observation',
        confidence: '0.92',
        importance: '0.70',
        locationId: 'avenida-central',
      },
    ],
  },
  {
    id: 'agent-chason',
    name: 'Chasoň',
    archetype: 'child',
    starDesignation: 'Eta Lyrae (η Lyr)',
    role: 'Jovem Mensageiro & Skatista',
    backstorySeed: 'Cidadão jovem e ágil que percorre as calçadas respeitando os pedestres e aprendendo as regras da cidade.',
    activeGoals: ['aprender sinalização viária', 'respeitar pedestres na calçada', 'explorar a praça'],
    personality: {
      openness: 0.9,
      conscientiousness: 0.45,
      extraversion: 0.9,
      agreeableness: 0.75,
      neuroticism: 0.3,
    },
    initialPosition: { x: 10, y: 0.19, z: 14 },
    initialEmotion: 'curious',
    initialExperiences: [
      {
        eventType: 'sign_reading_learned',
        description: 'Parou diante da placa PROIBIDO JOGAR LIXO e aprendeu sobre a lixeira municipal.',
        sourceType: 'direct_observation',
        confidence: '0.90',
        importance: '0.80',
        locationId: 'placa-lixo-1',
      },
      {
        eventType: 'pedestrian_signal_respected',
        description: 'Aguardou o semáforo de pedestres ficar verde antes de cruzar com o skate.',
        sourceType: 'direct_observation',
        confidence: '0.95',
        importance: '0.85',
        locationId: 'faixa-pedestres',
      },
      {
        eventType: 'plaza_recreation_enjoyed',
        description: 'Correu alegremente pelos canteiros floridos da Praça Central sem danificar a vegetação.',
        sourceType: 'direct_observation',
        confidence: '0.88',
        importance: '0.65',
        locationId: 'praca-central',
      },
    ],
  },
  {
    id: 'agent-epsilon',
    name: 'Epsilon',
    archetype: 'elder',
    starDesignation: 'Epsilon Lyrae (ε Lyr)',
    role: 'Filósofo & Guardião da Memória',
    backstorySeed: 'Ancião da cidade, arquivista da memória coletiva e observador da evolução das leis e costumes sociais.',
    activeGoals: ['transmitir cultura cívica', 'refletir sobre harmonia urbana', 'preservar memória social'],
    personality: {
      openness: 0.95,
      conscientiousness: 0.8,
      extraversion: 0.45,
      agreeableness: 0.9,
      neuroticism: 0.15,
    },
    initialPosition: { x: 16, y: 0.19, z: 22 },
    initialEmotion: 'calm',
    initialExperiences: [
      {
        eventType: 'civic_harmony_observed',
        description: 'Contemplou a coexistência entre regras formais e hábitos espontâneos dos cidadãos.',
        sourceType: 'direct_observation',
        confidence: '0.95',
        importance: '0.90',
        locationId: 'praca-central',
      },
      {
        eventType: 'urban_cleaning_reflected',
        description: 'Recordou a instalação das primeiras lixeiras e o impacto positivo na limpeza da avenida.',
        sourceType: 'direct_observation',
        confidence: '0.92',
        importance: '0.80',
        locationId: 'calcada-norte',
      },
      {
        eventType: 'avatar_daniel_interacted',
        description: 'Observou o avatar Daniel interagindo respeitosamente com os cidadãos e a praça.',
        sourceType: 'direct_observation',
        confidence: '0.96',
        importance: '0.85',
        locationId: 'calcada-central',
      },
    ],
  },
];

/**
 * Habitantes adicionais da Constelação de Lira presentes no frontend (Aladfar e Xihe).
 */
export const EXTRA_CITIZENS: SeedCitizenConfig[] = [
  {
    id: 'agent-aladfar',
    name: 'Aladfar',
    archetype: 'citizen',
    starDesignation: 'Delta Lyrae (δ Lyr)',
    role: 'Artista & Designer',
    backstorySeed: 'Artista e designer apaixonada pela estética urbana, luzes e contrastes de Synapse City.',
    activeGoals: ['explorar arquitetura da praça', 'dialogar com pedestres', 'estudar contrastes de iluminação'],
    personality: {
      openness: 0.95,
      conscientiousness: 0.6,
      extraversion: 0.8,
      agreeableness: 0.85,
      neuroticism: 0.3,
    },
    initialPosition: { x: -16, y: 0.19, z: 16 },
    initialEmotion: 'joyful',
    initialExperiences: [
      {
        eventType: 'art_inspiration_observed',
        description: 'Observou as reflexões de luz neon no asfalto molhado perto da praça.',
        sourceType: 'direct_observation',
        confidence: '0.94',
        importance: '0.80',
        locationId: 'calcada-central',
      },
      {
        eventType: 'urban_design_appreciated',
        description: 'Admirou a tipografia das placas de sinalização e os murais arquitetônicos da Rua Central.',
        sourceType: 'direct_observation',
        confidence: '0.92',
        importance: '0.75',
        locationId: 'praca-central',
      },
    ],
  },
  {
    id: 'agent-xihe',
    name: 'Xihe',
    archetype: 'worker',
    starDesignation: 'Zeta Lyrae (ζ Lyr)',
    role: 'Arquiteta & Botânica',
    backstorySeed: 'Especialista em botânica urbana, arborização e arquitetura sustentável de Synapse City.',
    activeGoals: ['catalogar botânica urbana', 'projetar espaços verdes', 'cuidar da arborização'],
    personality: {
      openness: 0.9,
      conscientiousness: 0.85,
      extraversion: 0.55,
      agreeableness: 0.85,
      neuroticism: 0.2,
    },
    initialPosition: { x: -10, y: 0.19, z: -20 },
    initialEmotion: 'curious',
    initialExperiences: [
      {
        eventType: 'botany_species_cataloged',
        description: 'Catalogou as espécies botânicas presentes nos canteiros ao redor da avenida.',
        sourceType: 'direct_observation',
        confidence: '0.96',
        importance: '0.85',
        locationId: 'canteiro-central',
      },
      {
        eventType: 'shade_architecture_planned',
        description: 'Mapeou a projeção de sombra dos edifícios sobre a vegetação nativa da calçada.',
        sourceType: 'direct_observation',
        confidence: '0.91',
        importance: '0.78',
        locationId: 'calcada-norte',
      },
    ],
  },
];

export const ALL_CITIZENS: SeedCitizenConfig[] = [...SEED_CITIZENS, ...EXTRA_CITIZENS];

