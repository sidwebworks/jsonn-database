import { mkdir, readdir, stat } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

export function isEqual(a, b) {
  const keys = Object.keys(a);

  for (const key of keys) {
    if (typeof a[key] !== 'object' && a[key] !== b[key]) return false;
    if (!isDeepStrictEqual(a[key], b[key])) return false;
  }

  return true;
}

export async function createOrReadDirectory(pathname) {
  const exists = await existsAsync(pathname, 'directory');
  const records = [];

  if (exists) {
    const entries = await readdir(pathname, { withFileTypes: true });

    for (const entry of entries) {
      records.push(entry);
    }

    return records;
  }

  await mkdir(pathname);

  return records;
}

export async function existsAsync(pathname, type) {
  try {
    const stats = await stat(pathname);
    return type === 'file' ? stats.isFile() : stats.isDirectory();
  } catch (error) {
    return false;
  }
}
