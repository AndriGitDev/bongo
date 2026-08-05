import type { BongoFactor, BongoWindow, TimelineEntry, WeatherSnapshot } from './scoring.mjs';

export type BongoMood = 'sun' | 'fair' | 'wind' | 'rain' | 'night';

export interface BongoPayload {
  place: { name: string; lat: number; lon: number; id: string | null };
  score: number;
  label: string;
  explanation: string;
  factors: Record<'sun' | 'wind' | 'temperature' | 'precipitation' | 'daylight', BongoFactor>;
  observedAt: string | null;
  source: string;
  providerUpdatedAt: string | null;
  timeline: TimelineEntry[];
  window: BongoWindow | null;
  windowMessage: string;
  mood: BongoMood;
}

export function moodFromSnapshot(snapshot: WeatherSnapshot): BongoMood;
export function assembleBongoPayload(
  place: { name: string; lat: number; lon: number; id?: string },
  data: { snapshot: WeatherSnapshot; timeline?: WeatherSnapshot[] | null },
  options?: { now?: Date },
): BongoPayload;
