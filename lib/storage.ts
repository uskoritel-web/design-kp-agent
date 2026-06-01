const memoryStore = new Map<string, unknown>();

export async function saveKP(id: string, data: unknown): Promise<void> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = await import('@vercel/kv');
    await kv.set(`kp:${id}`, data, { ex: 60 * 60 * 24 * 60 });
  } else {
    memoryStore.set(id, data);
  }
}

export async function loadKP(id: string): Promise<unknown | null> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = await import('@vercel/kv');
    return await kv.get(`kp:${id}`);
  }
  return memoryStore.get(id) ?? null;
}
