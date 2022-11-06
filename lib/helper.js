import { isDeepStrictEqual } from 'node:util';

export function isEqual(a, b) {
  const keys = Object.keys(a);

  for (const key of keys) {
    if (typeof a[key] !== 'object' && a[key] !== b[key]) return false;
    if (!isDeepStrictEqual(a[key], b[key])) return false;
  }

  return true;
}
