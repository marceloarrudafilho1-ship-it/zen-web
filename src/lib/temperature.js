// Hot vs cold wallet classifier. Heuristic based on activity cadence and recency:
//
//   hot   — frequent activity, used recently (online wallet, exchange-like, trading bot)
//   warm  — moderate activity (typical retail wallet)
//   cold  — long-dormant, rare withdrawals, or vault-style hoarder (hardware/multisig)
//
// We don't try to detect smart-contract wallets vs EOAs — investigators don't need that
// distinction; what they want to know is "is this address actively moving funds right now,
// or is it sitting on stuff." That's what this estimates.

const DAY = 86400;
const NOW = () => Math.floor(Date.now() / 1000);

export function classifyTemperature(transfers) {
  if (!transfers || transfers.length === 0) {
    return { temp: 'unknown', label: 'No activity', reason: 'No transfers analyzed', txPerWeek: 0, daysSinceLast: null };
  }

  const first = transfers[0].blockTime;
  const last = transfers[transfers.length - 1].blockTime;
  const spanDays = Math.max(1, (last - first) / DAY);
  const daysSinceLast = Math.max(0, (NOW() - last) / DAY);
  const txPerWeek = (transfers.length / spanDays) * 7;

  // Recent burst window: how many transfers in the last 30 days?
  const recentCutoff = NOW() - 30 * DAY;
  const recent = transfers.filter(t => t.blockTime >= recentCutoff).length;

  // Cold: dormant for 90+ days, or extremely sparse outflows over a long span.
  // This is the classic vault pattern — funds in, funds sit, occasional movement.
  if (daysSinceLast > 90) {
    return {
      temp: 'cold',
      label: 'Cold',
      reason: `Dormant — last activity ${formatDays(daysSinceLast)} ago`,
      txPerWeek, daysSinceLast,
    };
  }
  if (txPerWeek < 1 && spanDays > 90) {
    return {
      temp: 'cold',
      label: 'Cold',
      reason: `Vault-like — ${txPerWeek.toFixed(2)} tx/week over ${spanDays.toFixed(0)} days`,
      txPerWeek, daysSinceLast,
    };
  }

  // Hot: high cadence (5+ tx/week sustained, or 30+ tx in the last 30 days)
  // and recently active. Typical of exchange hot wallets, MEV bots, day-traders.
  if ((txPerWeek >= 5 || recent >= 30) && daysSinceLast < 14) {
    return {
      temp: 'hot',
      label: 'Hot',
      reason: `Actively used — ${recent} tx in last 30 days`,
      txPerWeek, daysSinceLast,
    };
  }

  return {
    temp: 'warm',
    label: 'Active',
    reason: `${txPerWeek.toFixed(1)} tx/week · last activity ${formatDays(daysSinceLast)} ago`,
    txPerWeek, daysSinceLast,
  };
}

function formatDays(d) {
  if (d < 1) return 'today';
  if (d < 2) return 'yesterday';
  if (d < 30) return `${Math.round(d)} days`;
  if (d < 365) return `${Math.round(d / 30)} mo`;
  return `${(d / 365).toFixed(1)} yr`;
}

export const TEMP_STYLE = {
  hot:     { color: '#fb923c', bg: 'bg-orange-500/15', text: 'text-orange-400', ring: 'ring-orange-500/30', dot: '#fb923c' },
  warm:    { color: '#fbbf24', bg: 'bg-amber-500/15',  text: 'text-amber-400',  ring: 'ring-amber-500/30',  dot: '#fbbf24' },
  cold:    { color: '#60a5fa', bg: 'bg-sky-500/15',    text: 'text-sky-400',    ring: 'ring-sky-500/30',    dot: '#60a5fa' },
  unknown: { color: '#94a3b8', bg: 'bg-slate-500/15',  text: 'text-slate-400',  ring: 'ring-slate-500/30',  dot: '#94a3b8' },
};
