// Dashboard work-log quick-add. Lets anyone with the dashboard key record a
// one-line entry ("Set up LSA account", "Called Anlin rep") so the weekly and
// monthly reports capture work done outside the codebase. Stored in a GHL
// custom value, merged with the git-generated and curated entries.
import type { APIRoute } from 'astro';
import { fetchWorkLog, saveWorkLog, keyOk } from '../../lib/kpi';

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  if (!keyOk(url)) return new Response('Unauthorized', { status: 401 });
  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const text = (fd.get('text') || '').toString().trim().slice(0, 300);
  let date = (fd.get('date') || '').toString().trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = new Date().toISOString().slice(0, 10);
  if (!text) return new Response('Empty entry', { status: 400 });

  const cur = await fetchWorkLog();
  if (!cur) return new Response('GHL not connected', { status: 502 });
  const entries = [{ date, text }, ...cur.entries.filter((e) => !(e.date === date && e.text === text))];
  const ok = await saveWorkLog(entries, cur.id);
  if (!ok) return new Response('Save failed', { status: 502 });

  const k = url.searchParams.get('key') || '';
  return new Response(null, {
    status: 303,
    headers: { Location: `/dashboard/?key=${encodeURIComponent(k)}#worklog` },
  });
};
