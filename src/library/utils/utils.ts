/**
 * FNV-1a (Fowler-Noll-Vo) hash implementation.
 *
 * A fast, non-cryptographic hash function with good distribution properties.
 * Uses the 32-bit FNV-1a variant with the standard FNV prime and offset basis.
 *
 * @internal
 * @param str - The string to hash.
 * @returns A base-36 encoded hash string.
 *
 * @see {@link https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function}
 */
export function fnv1a(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(36);
}
