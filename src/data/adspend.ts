// Monthly ad spend by channel, in dollars. THIS IS THE ONE MANUAL INPUT the
// KPI dashboard needs: update it at the start of each month with the actual
// spend from the ad platforms (or leave the planned number if it matched).
// Keys are 'YYYY-MM'. CPL / CPA / ROI on /dashboard divide by these totals.
export const adSpend: Record<string, { google: number; facebook: number; other: number }> = {
  // Planned once Google Ads launches ($2,000 roofing + $1,000 windows):
  // '2026-08': { google: 3000, facebook: 0, other: 0 },
};

export const spendFor = (ym: string): number => {
  const s = adSpend[ym];
  return s ? s.google + s.facebook + s.other : 0;
};
