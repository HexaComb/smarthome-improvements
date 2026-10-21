// Automatic Monday owner report, posted to Discord. Triggered by the Vercel
// cron in vercel.json (Authorization: Bearer CRON_SECRET when that env var is
// set) or manually with ?key=<DASH_KEY>. Summarizes: calls + form leads this
// week vs last week, revenue won, and the work log entries for both weeks.
import type { APIRoute } from 'astro';
import { updatesBetween } from '../../data/updates';
import { fetchOpportunities, fetchCalls, fetchWorkLog, fetchJnJobs, fetchJnRevenue, buildWeekly, money } from '../../lib/kpi';
import { stuckJobs } from '../../lib/jn';
import { site } from '../../data/site';

export const prerender = false;

const env = (k: string): string =>
  (typeof process !== 'undefined' && process.env && process.env[k]) || '';

export const GET: APIRoute = async ({ request, url }) => {
  const cronSecret = env('CRON_SECRET');
  const auth = request.headers.get('authorization') || '';
  const ua = request.headers.get('user-agent') || '';
  // With CRON_SECRET set, require it. Without it, accept Vercel's cron agent
  // (worst case an unauthenticated hit posts a report to our own Discord).
  const cronOk = cronSecret
    ? auth === `Bearer ${cronSecret}`
    : ua.startsWith('vercel-cron');
  const dashKey = env('DASH_KEY').trim();
  const parsedKey = (url.searchParams.get('key') || '').trim();
  const rawKey = (url.search.match(/[?&]key=([^&]*)/)?.[1] || '').trim();
  const keyOk = dashKey.length > 0 && (parsedKey === dashKey || rawKey === dashKey || decodeURIComponent(rawKey) === dashKey);
  if (!cronOk && !keyOk) return new Response('Unauthorized', { status: 401 });

  const webhook = env('DISCORD_WEBHOOK');
  if (!webhook) return new Response(JSON.stringify({ ok: false, error: 'DISCORD_WEBHOOK unset' }), { status: 200 });

  const now = new Date();
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - 28);
  const [opps, calls, workLogRes, jnJobs, jnRev] = await Promise.all([
    fetchOpportunities(),
    fetchCalls(since, now),
    fetchWorkLog(),
    fetchJnJobs(),
    fetchJnRevenue(),
  ]);
  const workLog = workLogRes?.entries ?? [];
  const weekly = buildWeekly(opps, calls, 3, now);
  // Report on the two COMPLETED weeks when run on a Monday: weekly[-1] is the
  // week that just started, so use [-2] (last week) vs [-3] (the week before).
  const last = weekly[weekly.length - 2];
  const prior = weekly[weekly.length - 3];

  const rev = (w?: (typeof weekly)[0]) =>
    !opps || !w ? 0 : opps.filter((o) => o.status === 'won' && o.updatedAt >= w.start && o.updatedAt < w.end).reduce((s, o) => s + o.value, 0);

  const line = (label: string, a: number | null, b: number | null, moneyFmt = false) => {
    const f = (v: number | null) => (v == null ? 'n/a' : moneyFmt ? money(v) : String(v));
    const d = a != null && b != null ? a - b : null;
    const arrow = d == null ? '' : d > 0 ? ` (up ${moneyFmt ? money(d) : d})` : d < 0 ? ` (down ${moneyFmt ? money(Math.abs(d)) : Math.abs(d)})` : ' (flat)';
    return `**${label}:** ${f(a)} vs ${f(b)} prior${arrow}`;
  };

  // JobNimbus production summary for the completed week.
  let jnBlock = '';
  if (jnJobs && last) {
    const inWeek = (d: Date) => d >= last.start && d < last.end;
    const signedItems = (jnRev?.items ?? []).filter((i) => i.kind === 'signed' && inWeek(i.when));
    const signedTotal = signedItems.reduce((s, i) => s + i.total, 0);
    const completedWk = jnJobs.filter((j) => j.stage === 'done' && inWeek(j.updated)).length;
    const stuck = stuckJobs(jnJobs, 14).length;
    jnBlock = [
      '',
      '**Production (JobNimbus):**',
      `• Signed estimates: ${signedItems.length}${signedTotal ? ` (${money(signedTotal)})` : ''}`,
      `• Jobs completed: ${completedWk}`,
      `• In production: ${jnJobs.filter((j) => j.stage === 'production').length} | Pipeline: ${jnJobs.filter((j) => j.stage === 'pipeline').length}`,
      stuck ? `• ⚠ ${stuck} production job${stuck > 1 ? 's' : ''} untouched 14+ days` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const ups = last ? updatesBetween(last.start, last.end, workLog) : [];
  const upsText = ups.length
    ? ups.map((u) => `• ${u.text}`).join('\n').slice(0, 900)
    : '• Nothing logged in the work log this week.';

  const dashUrl = `${site.url}/dashboard/${env('DASH_KEY') ? '?key=' + env('DASH_KEY') : ''}`;

  const body = {
    username: 'Weekly Owner Report',
    embeds: [
      {
        title: `Weekly report · week of ${last?.label ?? ''}`,
        color: 0x255188,
        description: [
          line('Calls', last?.calls ?? null, prior?.calls ?? null),
          line('Form leads', last?.leads ?? null, prior?.leads ?? null),
          line('Revenue won', rev(last), rev(prior), true),
          jnBlock,
          '',
          '**Work shipped last week:**',
          upsText,
          '',
          `Full dashboard: ${dashUrl}`,
          calls === null ? '_CallRail not connected yet; call counts missing._' : '',
        ]
          .filter(Boolean)
          .join('\n'),
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return new Response(JSON.stringify({ ok: res.ok, status: res.status }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false }), { status: 200 });
  }
};
