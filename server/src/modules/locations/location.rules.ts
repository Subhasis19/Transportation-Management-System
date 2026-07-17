export function normalizeLocationName(cityName: string): string {
  return cityName.trim().replace(/\s+/g, " ");
}

export function areLocationNamesEquivalent(a: string, b: string): boolean {
  return normalizeLocationName(a).toLocaleLowerCase() === normalizeLocationName(b).toLocaleLowerCase();
}
