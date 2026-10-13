/** Mulberry32: deterministico, stato in un solo intero salvato nella partita. */
export function prossimo(s: { rng: number }): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function intero(s: { rng: number }, n: number): number {
  return Math.floor(prossimo(s) * n);
}

export function mescola<T>(s: { rng: number }, arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = intero(s, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
