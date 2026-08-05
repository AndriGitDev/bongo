import type { BongoLocation, WeatherSnapshot } from './scoring.mjs';

export interface MetNoOptions {
  fetchImpl?: typeof fetch;
  now?: Date;
  timeoutMs?: number;
}

export interface MetNoLocationResult {
  snapshot: WeatherSnapshot;
  timeline: WeatherSnapshot[];
}

export interface LiveResultOk {
  ok: true;
  locationId: string;
  snapshot: WeatherSnapshot;
  timeline: WeatherSnapshot[];
}

export interface LiveResultError {
  ok: false;
  locationId: string;
  error: string;
}

export interface MergedSnapshots {
  snapshots: Record<string, WeatherSnapshot>;
  timelines: Record<string, WeatherSnapshot[]>;
  failedLocationIds: string[];
  liveCount: number;
  mode: 'live' | 'partial-live' | 'mock';
}

export const METNO_SOURCE: string;
export function buildMetNoUrl(location: { lat: number; lon: number }): string;
export function findBestTimeseriesEntry(payload: any, targetDate?: Date): any;
export function metNoTimeseriesToSnapshot(
  locationId: string,
  entry: any,
  providerUpdatedAt: string | undefined,
  location: BongoLocation,
): WeatherSnapshot;
export function metNoTimeseriesToTimeline(
  location: BongoLocation,
  payload: any,
  options?: { horizonHours?: number; now?: Date },
): WeatherSnapshot[];
export function fetchMetNoLocation(location: BongoLocation, options?: MetNoOptions): Promise<MetNoLocationResult>;
export function fetchMetNoSnapshot(location: BongoLocation, options?: MetNoOptions): Promise<WeatherSnapshot>;
export function fetchLiveSnapshots(locations: BongoLocation[], options?: MetNoOptions): Promise<Array<LiveResultOk | LiveResultError>>;
export function mergeLiveSnapshots(
  mockSnapshots: Record<string, WeatherSnapshot>,
  liveResults: Array<LiveResultOk | LiveResultError>,
): MergedSnapshots;
export function getWeatherSnapshots(
  locations: BongoLocation[],
  mockSnapshots: Record<string, WeatherSnapshot>,
  options?: MetNoOptions,
): Promise<MergedSnapshots>;
