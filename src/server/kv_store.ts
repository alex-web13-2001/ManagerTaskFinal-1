import prisma from '../lib/prisma';

// Upsert key-value
export const set = async (key: string, value: any): Promise<void> => {
  await prisma.kvStore.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
};

export const get = async (key: string): Promise<any | null> => {
  const row = await prisma.kvStore.findUnique({ where: { key } });
  return row ? row.value : null;
};

export const del = async (key: string): Promise<void> => {
  await prisma.kvStore.deleteMany({ where: { key } });
};

export const mset = async (keys: string[], values: any[]): Promise<void> => {
  const ops = keys.map((k, i) =>
    prisma.kvStore.upsert({
      where: { key: k },
      create: { key: k, value: values[i] },
      update: { value: values[i] },
    }),
  );
  await Promise.all(ops);
};

export const mget = async (keys: string[]): Promise<any[]> => {
  const rows = await prisma.kvStore.findMany({ where: { key: { in: keys } } });
  const map = new Map(rows.map(r => [r.key, r.value]));
  return keys.map(k => map.get(k) ?? null);
};

export const getByPrefix = async (prefix: string): Promise<any[]> => {
  const rows: any = await prisma.$queryRawUnsafe(
    `SELECT value FROM "KvStore" WHERE key LIKE $1`,
    `${prefix}%`,
  );
  return rows.map((r: any) => r.value);
};