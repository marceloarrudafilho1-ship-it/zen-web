export const fmtUsd = (n) => {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
};

export const fmtAmount = (n, decimals = 4) => {
  if (n == null || isNaN(n)) return '—';
  if (n === 0) return '0';
  if (n < 0.0001) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
};

export const shortAddr = (addr) => {
  if (!addr) return '—';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
};

export const fmtDate = (unixSec) => {
  const d = new Date(unixSec * 1000);
  return d.toISOString().slice(0, 16).replace('T', ' ');
};
