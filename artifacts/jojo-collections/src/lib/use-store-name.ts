export const STORE_NAME = "Lenz Fragrances";
export const STORE_NAME_SHORT = "Lenz";

export function useStoreName(): string {
  return STORE_NAME;
}

export function invalidateStoreName(): void {
  // no-op: name is hardcoded
}
