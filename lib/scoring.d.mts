export interface BongoLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface WeatherSnapshot {
  locationId?: string;
  temperatureC: number;
  windMs: number;
  gustMs: number;
  precipitationMm: number;
  cloudCoverPct: number;
  sunElevationDeg?: number | null;
  daylight: boolean;
  observedAt?: string;
  source?: string;
  providerUpdatedAt?: string;
}

export interface BongoFactor {
  label: string;
  value: string;
  score: number;
  weight: number;
}

export interface ScoredCore {
  score: number;
  label: string;
  factors: Record<'sun' | 'wind' | 'temperature' | 'precipitation' | 'daylight', BongoFactor>;
}

export interface BongoResult extends ScoredCore {
  location: BongoLocation;
  explanation: string;
  observedAt?: string;
  source?: string;
  providerUpdatedAt?: string;
}

export interface TimelineEntry {
  time: string;
  score: number;
  label: string;
  temperatureC: number;
  windMs: number;
  cloudCoverPct: number;
  precipitationMm: number;
  daylight: string;
}

export interface BongoWindow {
  startIndex: number;
  endIndex: number;
  startTime: string;
  endTime: string;
  bestScore: number;
  threshold: number;
  hours: number;
}

export const WEIGHTS: Record<string, number>;
export function clamp(value: number, min?: number, max?: number): number;
export function getBongoLabel(score: number): string;
export function scoreSnapshotCore(snapshot: WeatherSnapshot): ScoredCore;
export function scoreBongo(location: BongoLocation, snapshot: WeatherSnapshot): BongoResult;
export function rankLocations(
  locations: BongoLocation[],
  snapshotsByLocationId: Record<string, WeatherSnapshot>,
  limit?: number,
): BongoResult[];
export function nearestBetterLocations(
  currentLocation: BongoLocation,
  scoredLocations: Array<{ location: BongoLocation; score: number; label?: string }>,
  currentScore: number,
  limit?: number,
): Array<{ location: BongoLocation; score: number; label?: string; distanceKm: number }>;
export function scoreTimeline(instants: WeatherSnapshot[]): TimelineEntry[];
export function findNextBongoWindow(
  timeline: TimelineEntry[],
  options?: { threshold?: number; horizonHours?: number },
): BongoWindow | null;
export function findBestAnswerWindow(timeline: TimelineEntry[]): BongoWindow | null;
export function formatWindowMessage(window: BongoWindow | null, now: Date, timeZone?: string): string;
