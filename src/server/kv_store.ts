import prisma from './db';

/**
 * KV Store implementation using Prisma
 * Replaces Supabase kv_store functionality
 */

/**
 * Set a key-value pair in the store (upsert)
 */
export async function set(key: string, value: any): Promise<void> {
  await prisma.kvStore.upsert({
    where: { key },
    update: { value, updatedAt: new Date() },
    create: { key, value },
  });
}

/**
 * Get a value by key
 */
export async function get(key: string): Promise<any> {
  const record = await prisma.kvStore.findUnique({
    where: { key },
  });
  return record?.value || null;
}

/**
 * Delete a key-value pair
 */
export async function del(key: string): Promise<void> {
  await prisma.kvStore.delete({
    where: { key },
  }).catch(() => {
    // Ignore if key doesn't exist
  });
}

/**
 * Set multiple key-value pairs
 */
export async function mset(keys: string[], values: any[]): Promise<void> {
  const operations = keys.map((key, index) =>
    prisma.kvStore.upsert({
      where: { key },
      update: { value: values[index], updatedAt: new Date() },
      create: { key, value: values[index] },
    })
  );
  await Promise.all(operations);
}

/**
 * Get multiple values by keys
 */
export async function mget(keys: string[]): Promise<any[]> {
  const records = await prisma.kvStore.findMany({
    where: { key: { in: keys } },
  });
  
  // Return values in the same order as keys
  return keys.map((key) => {
    const record = records.find((r) => r.key === key);
    return record?.value || null;
  });
}

/**
 * Delete multiple key-value pairs
 */
export async function mdel(keys: string[]): Promise<void> {
  await prisma.kvStore.deleteMany({
    where: { key: { in: keys } },
  });
}

/**
 * Get all key-value pairs with keys starting with a prefix
 */
export async function getByPrefix(prefix: string): Promise<any[]> {
  const records = await prisma.kvStore.findMany({
    where: {
      key: {
        startsWith: prefix,
      },
    },
  });
  return records.map((r) => r.value);
}

/**
 * Get all keys with a prefix (returns key-value pairs)
 */
export async function getKeysByPrefix(prefix: string): Promise<{ key: string; value: any }[]> {
  const records = await prisma.kvStore.findMany({
    where: {
      key: {
        startsWith: prefix,
      },
    },
  });
  return records.map((r) => ({ key: r.key, value: r.value }));
}
