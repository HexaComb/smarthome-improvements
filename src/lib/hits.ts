// First-party page-view counter for the paid landing pages, backed by an
// Upstash Redis store (Vercel Marketplace: Storage > Create > Upstash Redis;
// the REST URL/token env vars are injected automatically). Atomic INCRs, no
// race conditions, ~free at this volume. Degrades to "not connected" when
// the env vars are absent.
const env = (k: string): string =>
  (typeof process !== 'undefined' && process.env && process.env[k]) || '';

const restUrl = () => env('KV_REST_API_URL') || env('UPSTASH_REDIS_REST_URL');
const restToken = () => env('KV_REST_API_TOKEN') || env('UPSTASH_REDIS_REST_TOKEN');

export const hitsReady = () => restUrl().length > 0 && restToken().length > 0;

/** Run a pipeline of Redis commands over the Upstash REST API. */
async function pipeline(cmds: (string | number)[][]): Promise<any[] | null> {
  if (!hitsReady() || cmds.length === 0) return null;
  try {
    const res = await fetch(`${restUrl()}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${restToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data.map((d) => d?.result ?? null) : null;
  } catch {
    return null;
  }
}

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Small JSON cache on the same store (used for rate-limited upstream APIs). */
export async function kvGetJson<T>(key: string): Promise<T | null> {
  const r = await pipeline([['GET', key]]);
  const raw = r?.[0];
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** ttlSeconds <= 0 stores without expiry. */
export async function kvSetJson(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
  const cmd: (string | number)[] = ['SET', key, JSON.stringify(value)];
  if (ttlSeconds > 0) cmd.push('EX', ttlSeconds);
  const r = await pipeline([cmd]);
  return r !== null;
}

/** Count one visit for a landing page path on a UTC day. */
export async function recordHit(path: string, day: string): Promise<boolean> {
  const r = await pipeline([
    ['INCR', `hits:${day}:${path}`],
    ['INCR', `hits:total:${path}`],
  ]);
  return r !== null;
}

/** Visits per path summed over the given days, plus all-time totals. */
export async function fetchHits(
  paths: string[],
  days: string[],
): Promise<{ range: Map<string, number>; total: Map<string, number> } | null> {
  if (!hitsReady()) return null;
  const range = new Map<string, number>();
  const total = new Map<string, number>();
  const keys: string[] = [];
  for (const p of paths) for (const d of days) keys.push(`hits:${d}:${p}`);
  const totalKeys = paths.map((p) => `hits:total:${p}`);
  // MGET in chunks to stay well under request limits.
  const CHUNK = 500;
  const cmds: (string | number)[][] = [];
  for (let i = 0; i < keys.length; i += CHUNK) cmds.push(['MGET', ...keys.slice(i, i + CHUNK)]);
  cmds.push(['MGET', ...totalKeys]);
  const out = await pipeline(cmds);
  if (!out) return null;
  const flat: any[] = out.slice(0, -1).flat();
  keys.forEach((k, i) => {
    const p = k.slice(k.indexOf(':', 5) + 1); // hits:YYYY-MM-DD:<path>
    range.set(p, (range.get(p) || 0) + (Number(flat[i]) || 0));
  });
  const totals: any[] = out[out.length - 1] || [];
  paths.forEach((p, i) => total.set(p, Number(totals[i]) || 0));
  return { range, total };
}
