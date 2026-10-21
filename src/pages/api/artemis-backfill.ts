// One-time (re-runnable) backfill of existing Artemis projects into
// JobNimbus + GHL through the same sync used by the webhook. Batched so
// each call stays inside the function time limit and the Artemis 60/min
// rate limit: ?batch=N (default 20) projects per call, newest first,
// progress kept in a GHL custom value so repeated calls continue where
// they left off. ?dry=1 lists what would be processed without writing.
// Auth: ?key=<DASH_KEY> (same as the other admin endpoints).
import type { APIRoute } from 'astro';
import { fetchArtemisProjects, fetchArtemisProject, lastArtemisStatus } from '../../lib/artemis';
import { syncArtemisProjectData, isInternalProject, isSigned, loadSyncMap, saveSyncMap } from '../../lib/artemisSync';

export const prerender = false;

const env = (k: string): string =>
  (typeof process !== 'undefined' && process.env && process.env[k]) || '';
const GHL_BASE = 'https://services.leadconnectorhq.com';
const ghlHeaders = () => ({ Authorization: `Bearer ${env('GHL_PIT')}`, Version: '2021-07-28', 'Content-Type': 'application/json', Accept: 'application/json' });
const PROGRESS_CV = 'Artemis Backfill JSON';

async function loadProgress(): Promise<{ done: string[]; id: string | null }> {
  const loc = env('GHL_LOCATION_ID');
  try {
    const res = await fetch(`${GHL_BASE}/locations/${loc}/customValues`, { headers: ghlHeaders() });
    const cv = ((await res.json())?.customValues || []).find((c: any) => c?.name === PROGRESS_CV);
    if (!cv) return { done: [], id: null };
    const parsed = JSON.parse(cv.value || '{}');
    return { done: Array.isArray(parsed?.done) ? parsed.done : [], id: cv.id };
  } catch {
    return { done: [], id: null };
  }
}
async function saveProgress(done: string[], id: string | null): Promise<void> {
  const loc = env('GHL_LOCATION_ID');
  const body = JSON.stringify({ name: PROGRESS_CV, value: JSON.stringify({ done, at: new Date().toISOString() }) });
  try {
    await fetch(id ? `${GHL_BASE}/locations/${loc}/customValues/${id}` : `${GHL_BASE}/locations/${loc}/customValues`, { method: id ? 'PUT' : 'POST', headers: ghlHeaders(), body });
  } catch {
    /* progress save is best-effort */
  }
}

export const GET: APIRoute = async ({ url }) => {
  const dashKey = env('DASH_KEY').trim();
  const key = (url.searchParams.get('key') || '').trim();
  if (!dashKey || key !== dashKey) return new Response('Unauthorized', { status: 401 });
  if (!env('ARTEMIS_API_KEY') || !env('JOBNIMBUS_API_KEY') || !env('GHL_PIT')) {
    return new Response(JSON.stringify({ ok: false, error: 'needs ARTEMIS_API_KEY, JOBNIMBUS_API_KEY, GHL_PIT' }), { status: 200 });
  }
  const batch = Math.max(1, Math.min(40, Number(url.searchParams.get('batch')) || 20));
  const dry = url.searchParams.get('dry') === '1';
  const reset = url.searchParams.get('reset') === '1';

  const all = await fetchArtemisProjects(0);
  if (!all) return new Response(JSON.stringify({ ok: false, error: 'Artemis list failed (rate limit?)' }), { status: 200 });
  const progress = reset ? { done: [] as string[], id: (await loadProgress()).id } : await loadProgress();
  const doneSet = new Set(progress.done);
  // Signed contracts only (proposals stay in Artemis until the homeowner signs).
  const queue = all.filter((p) => isSigned(p) && !doneSet.has(p.id)).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const take = queue.slice(0, batch);

  const store = await loadSyncMap();
  const map = store?.map ?? {};
  const results: { id: string; homeowner: string; status: string; price: number; result: string }[] = [];
  let internal = 0;
  for (const p0 of take) {
    // Full detail (cached per project after first fetch).
    const p = p0.detailed ? p0 : (await fetchArtemisProject(p0.id)) || p0;
    if (!p.detailed) {
      if (lastArtemisStatus === 404) {
        results.push({ id: p.id, homeowner: p.homeowner.name, status: p.status, price: p.price, result: 'not found in Artemis (deleted or not readable), skipped' });
        doneSet.add(p.id);
      } else {
        results.push({ id: p.id, homeowner: p.homeowner.name, status: p.status, price: p.price, result: 'detail unavailable (rate limit), retry next call' });
      }
      continue;
    }
    if (dry) {
      const isInt = await isInternalProject(p);
      results.push({ id: p.id, homeowner: p.homeowner.name || p.name, status: p.status, price: p.price, result: isInt ? 'would skip (staff)' : `would sync (${p.categories.join('/') || 'no scope'})` });
      continue;
    }
    const r = await syncArtemisProjectData(p, 'backfill', map);
    if (r.internal) internal++;
    results.push({ id: p.id, homeowner: p.homeowner.name || p.name, status: p.status, price: p.price, result: r.internal ? 'skipped (staff)' : `JN: ${r.jn} | GHL: ${r.ghl}` });
    doneSet.add(p.id);
  }
  if (!dry) {
    if (store) await saveSyncMap(map, store.id);
    await saveProgress([...doneSet], progress.id);
  }
  const signedTotal = all.filter((p) => isSigned(p)).length;
  const remaining = Math.max(0, signedTotal - (dry ? progress.done.length : doneSet.size));
  return new Response(
    JSON.stringify({ ok: true, dry, total: all.length, signed: signedTotal, processed: take.length, done: dry ? progress.done.length : doneSet.size, remaining, internalSkipped: internal, results }, null, 1),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
