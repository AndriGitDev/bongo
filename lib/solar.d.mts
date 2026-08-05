export function dayOfYearUTC(date: Date): number;
export function solarDeclinationDeg(date: Date): number;
export function equationOfTimeMinutes(date: Date): number;
export function sunElevationDeg(lat: number, lon: number, date: Date): number;
export function isSunUp(lat: number, lon: number, date: Date): boolean;
export function daylightTier(elevationDeg: number): { id: string; label: string; score: number };
