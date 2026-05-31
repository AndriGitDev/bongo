export function buildMetNoUrl(location: { lat: number; lon: number }): string;
export function findBestTimeseriesEntry(payload: any, targetDate?: Date): any;
export function metNoTimeseriesToSnapshot(locationId: string, entry: any, providerUpdatedAt?: string): any;
export function fetchMetNoSnapshot(location: any, options?: any): Promise<any>;
export function fetchLiveSnapshots(locations: any[], options?: any): Promise<any[]>;
export function mergeLiveSnapshots(mockSnapshots: Record<string, any>, liveResults: any[]): any;
export function getWeatherSnapshots(locations: any[], mockSnapshots: Record<string, any>, options?: any): Promise<any>;
export const METNO_SOURCE: string;
