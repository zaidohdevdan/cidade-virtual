// packages/tools/schemas.ts
import { z } from 'zod';

export const createCitizenSchema = z.object({
  name: z.string().min(2).max(40),
  archetype: z.enum(['worker', 'guard', 'citizen', 'child', 'elder']),
  initialPosition: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    altitude: z.number().optional(),
  }),
  initialEmotion: z.enum([
    'calm', 'fearful', 'curious', 'angry', 'joyful', 'melancholic', 'confused'
  ]).default('calm'),
  backstorySeed: z.string().max(500).optional(),
});
export type CreateCitizenInput = z.infer<typeof createCitizenSchema>;

export const triggerEventSchema = z.object({
  type: z.enum(['accident', 'festival', 'crime', 'weather', 'civic']),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    altitude: z.number().optional(),
  }),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
  description: z.string().max(1000),
});
export type TriggerEventInput = z.infer<typeof triggerEventSchema>;

export const getNPCMemorySchema = z.object({
  npcId: z.string().uuid(),
  timeframeHours: z.number().min(1).max(720).default(24),
  limit: z.number().min(1).max(100).default(20),
});
export type GetNPCMemoryInput = z.infer<typeof getNPCMemorySchema>;

export const setEmotionStateSchema = z.object({
  citizenId: z.string().uuid(),
  emotion: z.enum([
    'calm', 'fearful', 'curious', 'angry', 'joyful', 'melancholic', 'confused'
  ]),
  intensity: z.number().min(0).max(1).default(0.5),
  durationMinutes: z.number().min(1).max(1440).default(60),
});
export type SetEmotionStateInput = z.infer<typeof setEmotionStateSchema>;

export const requestHumanReviewSchema = z.object({
  changeSet: z.array(z.object({
    filePath: z.string(),
    before: z.string(),
    after: z.string(),
    rationale: z.string(),
  })),
  priority: z.enum(['low', 'medium', 'high', 'blocker']).default('medium'),
  summary: z.string().max(500),
});
export type RequestHumanReviewInput = z.infer<typeof requestHumanReviewSchema>;

export const weatherSetConditionSchema = z.object({
  condition: z.enum(['clear', 'rain', 'storm', 'fog', 'snow']),
  scenarioId: z.string().uuid(),
  durationMinutes: z.number().min(1).max(1440).default(60),
  intensity: z.number().min(0).max(1).default(0.5),
});
export type WeatherSetConditionInput = z.infer<typeof weatherSetConditionSchema>;

export const npcBroadcastAlertSchema = z.object({
  scenarioId: z.string().uuid().optional(),
  citizenIds: z.array(z.string().uuid()).optional(), // se ausente, broadcasta para todos do cenário
  message: z.string().min(5).max(280),  // estilo Twitter: força concisão
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
});
export type NpcBroadcastAlertInput = z.infer<typeof npcBroadcastAlertSchema>;

export const getSceneSnapshotSchema = z.object({
  scenarioId: z.string().uuid(),
  includeMemories: z.boolean().default(false),
});
export type GetSceneSnapshotInput = z.infer<typeof getSceneSnapshotSchema>;
