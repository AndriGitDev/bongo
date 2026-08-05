import type { BongoLocation } from './scoring.mjs';

export function isValidCoordinate(lat: unknown, lon: unknown): boolean;
export function parseCoordinate(raw: unknown): number | null;
export function roundCoordinate(value: number, decimals?: number): number;
export function roundLocation(location: { lat: number; lon: number }, decimals?: number): { lat: number; lon: number };
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number;
export function nearestKnownLocation(
  point: { lat: number; lon: number },
  locations: BongoLocation[],
): { location: BongoLocation; distanceKm: number } | null;
export function describePlace(
  point: { lat: number; lon: number },
  locations: BongoLocation[],
  nearKm?: number,
): { name: string; nearest: { location: BongoLocation; distanceKm: number } | null };
