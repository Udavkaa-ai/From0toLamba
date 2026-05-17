// Детерминированный RNG из строки seed: FNV-1a → u32 → mulberry32.
// Один и тот же seed всегда даёт одну и ту же последовательность чисел в [0..1).

function seedToU32(seed: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(a: number): () => number {
  return function () {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function rngFromSeed(seed: string): () => number {
  return mulberry32(seedToU32(seed))
}

export function pickInt(rng: () => number, minInclusive: number, maxExclusive: number): number {
  return Math.floor(rng() * (maxExclusive - minInclusive)) + minInclusive
}

export function pickOne<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}
