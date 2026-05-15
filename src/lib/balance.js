// Replays normalized transfers chronologically, accumulating per-asset balances.
// At each transfer it samples the USD price and computes total wallet USD value.
// Returns a time-series usable by Recharts and the highest/lowest extrema.

export function buildBalanceSeries(transfers, priceLookup) {
  // assetKey -> { asset, amount }
  const holdings = new Map();
  const series = [];

  for (const t of transfers) {
    const key = `${t.chain}:${t.asset.address}`;
    let h = holdings.get(key);
    if (!h) { h = { asset: t.asset, amount: 0 }; holdings.set(key, h); }

    if (t.direction === 'in') h.amount += t.amount;
    else if (t.direction === 'out') h.amount -= t.amount;
    else if (t.direction === 'swap') {
      // Conservative: subtract the swapped-out amount; we don't always have the
      // received amount in a single event, so the offsetting "in" leg arrives
      // later as a separate ERC20 transfer.
      h.amount -= t.amount;
    }
    if (h.amount < 0) h.amount = 0; // numerical floor

    let totalUsd = 0;
    for (const holding of holdings.values()) {
      if (holding.amount <= 0) continue;
      const px = priceLookup(holding.asset, t.blockTime);
      if (px) totalUsd += holding.amount * px;
    }

    series.push({ t: t.blockTime, usd: totalUsd, txId: t.id });
  }

  return series;
}

export function findExtrema(series, { excludeZero = true } = {}) {
  let high = null, low = null;
  for (const point of series) {
    if (excludeZero && point.usd <= 0) continue;
    if (!high || point.usd > high.usd) high = point;
    if (!low || point.usd < low.usd) low = point;
  }
  return { high, low };
}
