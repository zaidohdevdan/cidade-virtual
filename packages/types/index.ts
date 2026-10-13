// packages/types/index.ts

export type CitizenId = string & { readonly __brand: 'CitizenId' };
export type EventId = string & { readonly __brand: 'EventId' };
export type TicketId = string & { readonly __brand: 'TicketId' };

export interface GeoCoords {
  lat: number;
  lng: number;
  altitude?: number;
}

export type CitizenArchetype = 'worker' | 'guard' | 'citizen' | 'child' | 'elder';

export type EmotionState =
  | 'calm'
  | 'fearful'
  | 'curious'
  | 'angry'
  | 'joyful'
  | 'melancholic'
  | 'confused';

export interface MemorySnippet {
  id: string;
  citizenId: CitizenId;
  content: string;            // texto natural da memória
  embedding: number[];         // vetor
  timestamp: Date;
  sensoryTags: ('visual' | 'auditory' | 'social' | 'internal')[];
  emotionalWeight: number;    // 0..1 — quanto maior, mais central na identidade
  origin: 'observation' | 'interaction' | 'event' | 'reflection';
}

export interface EventLog {
  id: EventId;
  type: 'accident' | 'festival' | 'crime' | 'weather' | 'civic';
  location: GeoCoords;
  timestamp: Date;
  affectedCitizens: CitizenId[];
  description: string;
}

export interface DiffPatch {
  filePath: string;
  before: string;
  after: string;
  rationale: string;
}

export interface SceneSnapshot {
  scenarioId: string;
  citizens: Array<{ id: CitizenId; position: GeoCoords; emotion: EmotionState }>;
  objects: Array<{ id: string; type: string; position: GeoCoords }>;
  weather: 'clear' | 'rain' | 'storm' | 'fog' | 'snow';
  timeOfDay: number; // 0..23
}
