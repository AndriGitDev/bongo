export function clamp(value: number, min?: number, max?: number): number;
export function getBongoLabel(score: number): string;
export function scoreBongo(location: any, snapshot: any): any;
export function rankLocations(locations: any[], snapshotsByLocationId: Record<string, any>, limit?: number): any[];
export function nearestBetterLocations(currentLocation: any, scoredLocations: any[], currentScore: number, limit?: number): any[];
