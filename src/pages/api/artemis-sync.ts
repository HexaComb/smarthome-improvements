// Manual Artemis -> JobNimbus/GHL push for one project, bypassing the
// signed-only rule. For the case where the customer signed (e.g. lender
// e-sign / credit approval) but the Artemis project was never moved to
// "Contract Signed". Idempotent like the webhook path (marker match).
//   GET /api/artemis-sync/?key=DASH_KEY&project=<artemis project id>
import type { APIRoute } from 'astro';
import { fetchArtemisProject } from '../../lib/artemis';
import { syncArtemisProjectData, loadSyncMap, saveSyncMap } from '../../lib/artemisSync';

export const prerender = false;

const env = (k: string): string =>
  (typeof process !== 'undefined' && process.env && process.env[k]) || '';

export const GET: APIRoute = async ({ url }) => {
  const dashKey = env('DASH_KEY').trim();
  if (!dashKey || (url.searchParams.get('key') || '').trim() !== dashKey) return new Response('Unauthorized', { status: 401 });
  const id = (url.searchParams.get('project') || '').trim();
  if (!id) return new Response(JSON.stringify({ ok: false, error: 'project id required' }), { status: 200 });
  const project = await fetchArtemisProject(id);
  if (!project) return new Response(JSON.stringify({ ok: false, error: 'project not readable from Artemis' }), { status: 200 });
  const store = await loadSyncMap();
  // "contract-signed" as the event name satisfies the signed gate on purpose.
  const r = await syncArtemisProjectData(project, 'contract-signed (manual push)', store?.map ?? {});
  if (store) await saveSyncMap(store.map, store.id);
  return new Response(JSON.stringify({ ok: true, project: { name: project.homeowner.name, status: project.status, price: project.price, scope: project.categories }, jn: r.jn, ghl: r.ghl, internal: r.internal }, null, 1), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
