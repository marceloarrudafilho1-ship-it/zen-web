// CoinGecko historical price client with in-memory caching.
// Uses the /coins/{id}/market_chart/range endpoint for daily-granularity price data.
// Free tier is rate-limited (~10-30 calls/min) so we cache aggressively.

const CG_BASE = 'https://api.coingecko.com/api/v3';
const CG_PRO_BASE = 'https://pro-api.coingecko.com/api/v3';

const cache = new Map(); // key: coingeckoId -> [[ts(ms), priceUSD], ...]

function getBase(apiKey) {
  return apiKey ? CG_PRO_BASE : CG_BASE;
}

export async function getPriceSeries(coingeckoId, fromUnix, toUnix, apiKey) {
  const cacheKey = `id:${coingeckoId}:${fromUnix}:${toUnix}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const url = new URL(`${getBase(apiKey)}/coins/${coingeckoId}/market_chart/range`);
  url.searchParams.set('vs_currency', 'usd');
  url.searchParams.set('from', String(fromUnix));
  url.searchParams.set('to', String(toUnix));
  if (apiKey) url.searchParams.set('x_cg_pro_api_key', apiKey);

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 429) throw new Error('CoinGecko rate limit — try again in a minute.');
    throw new Error(`CoinGecko HTTP ${res.status}`);
  }
  const json = await res.json();
  const prices = json.prices || [];
  cache.set(cacheKey, prices);
  return prices;
}

// Lookup ERC-20 historical price by contract address. Returns [] if CoinGecko
// doesn't index this token (which is normal for long-tail tokens).
export async function getPriceSeriesByContract(platform, contract, fromUnix, toUnix, apiKey) {
  const cacheKey = `c:${platform}:${contract}:${fromUnix}:${toUnix}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const url = new URL(`${getBase(apiKey)}/coins/${platform}/contract/${contract}/market_chart/range`);
  url.searchParams.set('vs_currency', 'usd');
  url.searchParams.set('from', String(fromUnix));
  url.searchParams.set('to', String(toUnix));
  if (apiKey) url.searchParams.set('x_cg_pro_api_key', apiKey);

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) {
      cache.set(cacheKey, []); // negative-cache so we don't retry
      return [];
    }
    if (res.status === 429) throw new Error('CoinGecko rate limit — try again in a minute.');
    throw new Error(`CoinGecko HTTP ${res.status}`);
  }
  const json = await res.json();
  const prices = json.prices || [];
  cache.set(cacheKey, prices);
  return prices;
}

export function priceAt(series, unixSeconds) {
  if (!series || series.length === 0) return 0;
  const ms = unixSeconds * 1000;
  // Binary search nearest sample
  let lo = 0, hi = series.length - 1;
  if (ms <= series[0][0]) return series[0][1];
  if (ms >= series[hi][0]) return series[hi][1];
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (series[mid][0] < ms) lo = mid; else hi = mid;
  }
  // Pick nearer of the two bracketing samples
  return Math.abs(series[lo][0] - ms) < Math.abs(series[hi][0] - ms)
    ? series[lo][1]
    : series[hi][1];
}

export function clearPriceCache() {
  cache.clear();
}
