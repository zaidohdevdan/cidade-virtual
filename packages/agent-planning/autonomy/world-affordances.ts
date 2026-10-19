// packages/agent-planning/autonomy/world-affordances.ts
// Registro de entidades do mundo e suas affordances reais (o que o mundo físico oferece).
// Nenhuma entidade pertence a um agente específico: qualquer cidadão ou avatar pode
// interagir ou se aproximar conforme suas próprias necessidades e curiosidade.

import type { WorldEntity } from './types.js';

export const SYNAPSE_WORLD_ENTITIES: WorldEntity[] = [
  // ─── PRAÇA CENTRAL E LAZER (SW) ───
  {
    id: 'fountain-monumental',
    label: 'Fonte Monumental da Praça',
    kind: 'fountain',
    position: { x: -22, y: 0.19, z: 22 },
    approach: { x: -22, y: 0.19, z: 19 },
    affordances: ['contemplate', 'observe', 'explore'],
    quality: 1.3,
  },
  {
    id: 'bench-praca-west',
    label: 'Banco da Praça (Oeste)',
    kind: 'bench',
    position: { x: -26.5, y: 0.19, z: 22 },
    approach: { x: -25.5, y: 0.19, z: 22 },
    affordances: ['rest', 'socialize', 'contemplate'],
    quality: 1.1,
  },
  {
    id: 'bench-praca-east',
    label: 'Banco da Praça (Leste)',
    kind: 'bench',
    position: { x: -17.5, y: 0.19, z: 22 },
    approach: { x: -18.5, y: 0.19, z: 22 },
    affordances: ['rest', 'socialize', 'contemplate'],
    quality: 1.1,
  },
  {
    id: 'bench-praca-north',
    label: 'Banco da Praça (Norte)',
    kind: 'bench',
    position: { x: -22, y: 0.19, z: 17.5 },
    approach: { x: -22, y: 0.19, z: 18.5 },
    affordances: ['rest', 'socialize', 'contemplate'],
    quality: 1.1,
  },
  {
    id: 'bench-praca-south',
    label: 'Banco da Praça (Sul)',
    kind: 'bench',
    position: { x: -22, y: 0.19, z: 26.5 },
    approach: { x: -22, y: 0.19, z: 25.5 },
    affordances: ['rest', 'socialize', 'contemplate'],
    quality: 1.1,
  },

  // ─── ALIMENTAÇÃO E COMÉRCIO (NE / N) ───
  {
    id: 'market-central',
    label: 'Super Mercado Central',
    kind: 'market',
    position: { x: 0, y: 0.19, z: -48 },
    approach: { x: 0, y: 0.19, z: -38 },
    affordances: ['shop', 'eat', 'socialize', 'shelter'],
    quality: 1.25,
    hasCover: true,
  },
  {
    id: 'cafe-bistro',
    label: 'Café Bistro',
    kind: 'cafe',
    position: { x: 32, y: 0.19, z: -20 },
    approach: { x: 24, y: 0.19, z: -20 },
    affordances: ['eat', 'socialize', 'rest', 'shelter'],
    quality: 1.2,
    hasCover: true,
  },
  {
    id: 'cafe-table-outdoor',
    label: 'Mesa Externa do Café',
    kind: 'bench',
    position: { x: 26, y: 0.19, z: -16 },
    approach: { x: 25, y: 0.19, z: -16 },
    affordances: ['eat', 'rest', 'socialize'],
    quality: 1.15,
    hasCover: false,
  },

  // ─── MOBILIDADE E ESPERAS ───
  {
    id: 'bus-stop-west',
    label: 'Ponto de Ônibus Municipal',
    kind: 'bus_stop',
    position: { x: -11.5, y: 0.19, z: -20 },
    approach: { x: -10, y: 0.19, z: -20 },
    affordances: ['rest', 'observe', 'shelter'],
    quality: 0.9,
    hasCover: true,
  },
  {
    id: 'crosswalk-north',
    label: 'Travessia de Pedestres Norte',
    kind: 'crosswalk',
    position: { x: 0, y: 0.19, z: -10 },
    approach: { x: -4, y: 0.19, z: -10 },
    affordances: ['observe', 'explore'],
    quality: 0.8,
  },
  {
    id: 'crosswalk-south',
    label: 'Travessia de Pedestres Sul',
    kind: 'crosswalk',
    position: { x: 0, y: 0.19, z: 10 },
    approach: { x: 4, y: 0.19, z: 10 },
    affordances: ['observe', 'explore'],
    quality: 0.8,
  },

  // ─── AMBIENTE E INFORMAÇÃO URBANA ───
  {
    id: 'trash-area-praca',
    label: 'Ponto Ecológico & Lixeira Pública',
    kind: 'trash_bin',
    position: { x: -10, y: 0.19, z: 10 },
    approach: { x: -10, y: 0.19, z: 8.5 },
    affordances: ['observe', 'explore'],
    quality: 0.75,
  },
  {
    id: 'billboard-tech',
    label: 'Painel Informativo Cidade Conectada',
    kind: 'billboard',
    position: { x: -36, y: 0.19, z: -18 },
    approach: { x: -32, y: 0.19, z: -18 },
    affordances: ['observe', 'contemplate'],
    quality: 0.85,
  },
  {
    id: 'billboard-eco',
    label: 'Painel Educativo Preserve o Verde',
    kind: 'billboard',
    position: { x: 36, y: 0.19, z: 18 },
    approach: { x: 32, y: 0.19, z: 18 },
    affordances: ['observe', 'contemplate'],
    quality: 0.85,
  },

  // ─── ÁREAS VERDES E SOMBRA ───
  {
    id: 'tree-boulevard-nw',
    label: 'Sombra das Árvores (Alameda Noroeste)',
    kind: 'tree',
    position: { x: -9.5, y: 0.19, z: -25 },
    approach: { x: -9.5, y: 0.19, z: -25 },
    affordances: ['rest', 'contemplate', 'explore'],
    quality: 0.9,
  },
  {
    id: 'tree-boulevard-sw',
    label: 'Arborização Urbana da Praça',
    kind: 'tree',
    position: { x: -32, y: 0.19, z: 12 },
    approach: { x: -30, y: 0.19, z: 12 },
    affordances: ['rest', 'contemplate', 'explore'],
    quality: 1.0,
  },
  {
    id: 'tree-boulevard-se',
    label: 'Alameda Leste Florada',
    kind: 'tree',
    position: { x: 9.5, y: 0.19, z: 25 },
    approach: { x: 9.5, y: 0.19, z: 25 },
    affordances: ['observe', 'explore'],
    quality: 0.9,
  },

  // ─── ANEL VIÁRIO PERIMETRAL (NOVAS VIAS INTERLIGADAS) ───
  {
    id: 'bench-perimetral-south',
    label: 'Banco da Avenida Perimetral Sul',
    kind: 'bench',
    position: { x: 20, y: 0.19, z: 76.5 },
    approach: { x: 20, y: 0.19, z: 75.5 },
    affordances: ['rest', 'contemplate', 'socialize'],
    quality: 1.15,
  },
  {
    id: 'bench-perimetral-west',
    label: 'Banco da Avenida Perimetral Oeste',
    kind: 'bench',
    position: { x: -76.5, y: 0.19, z: 20 },
    approach: { x: -75.5, y: 0.19, z: 20 },
    affordances: ['rest', 'observe', 'contemplate'],
    quality: 1.1,
  },
  {
    id: 'tree-perimetral-south',
    label: 'Alameda Arborizada da Perimetral Sul',
    kind: 'tree',
    position: { x: -40, y: 0.19, z: 76.5 },
    approach: { x: -40, y: 0.19, z: 75.5 },
    affordances: ['rest', 'explore', 'contemplate'],
    quality: 0.95,
  },
  {
    id: 'tree-perimetral-north',
    label: 'Alameda Boulevard da Perimetral Norte',
    kind: 'tree',
    position: { x: 40, y: 0.19, z: -76.5 },
    approach: { x: 40, y: 0.19, z: -75.5 },
    affordances: ['observe', 'explore'],
    quality: 0.95,
  },
  {
    id: 'lookout-perimetral-se',
    label: 'Mirante Urbano do Anel Viário Sudeste',
    kind: 'billboard',
    position: { x: 68, y: 0.19, z: 68 },
    approach: { x: 65, y: 0.19, z: 65 },
    affordances: ['explore', 'observe', 'contemplate'],
    quality: 1.2,
  },
];

/**
 * Avalia se uma entidade do mundo oferece cobertura contra chuva e intempéries climáticas (Task-040).
 * Regra física global e objetiva, independente de agente.
 */
export function isCoveredEntity(entity: WorldEntity): boolean {
  if (entity.hasCover !== undefined) return entity.hasCover;
  return (
    entity.affordances.includes('shelter') ||
    entity.kind === 'market' ||
    entity.kind === 'cafe' ||
    entity.kind === 'bus_stop'
  );
}
