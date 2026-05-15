// End-to-end analysis pipeline: fetch → normalize → price → derive rankings & balance series.

import { EVM_CHAINS, fetchAllTransactions } from '../api/evm.js';
import { fetchSolanaTransactions } from '../api/solana.js';
import { fetchXrplTransactions } from '../api/xrpl.js';
import { fetchLitecoinTransactions } from '../api/litecoin.js';
import { fetchBitcoinTransactions } from '../api/bitcoin.js';
import { getPriceSeries, getPriceSeriesByContract, priceAt } from '../api/prices.js';
import { normalizeEvm, normalizeSolana, normalizeXrp, normalizeLitecoin, normalizeBitcoin, priceTransfers, topByDirection } from './analyzer.js';
import { buildBalanceSeries, findExtrema } from './balance.js';
import { labelFor } from './labels.js';
import { classifyTemperature } from './temperature.js';
import { detectClusterCandidates } from './clusters.js';
import { resolveBatch, resolveName } from './ens.js';

// Cap concurrent token price fetches so we don't hammer CoinGecko's free tier.
const MAX_TOKENS_TO_PRICE = 25;

export async function analyzeWallet({ chain, address, keys, onProgress }) {
  onProgress?.('Fetching transactions…');
  let transfers;
  let chainConfig;

  if (chain === 'solana') {
    if (!keys.helius) throw new Error('Helius API key required for Solana — set in Settings.');
    const txs = await fetchSolanaTransactions({ address, apiKey: keys.helius, onProgress });
    transfers = normalizeSolana({ txs, address });
    chainConfig = { coingeckoId: 'solana', symbol: 'SOL', name: 'Solana' };
  } else if (chain === 'xrp') {
    const txs = await fetchXrplTransactions({ address, onProgress });
    transfers = normalizeXrp({ txs, address });
    chainConfig = { coingeckoId: 'ripple', symbol: 'XRP', name: 'XRP' };
  } else if (chain === 'litecoin') {
    const txs = await fetchLitecoinTransactions({ address, onProgress });
    transfers = normalizeLitecoin({ txs, address });
    chainConfig = { coingeckoId: 'litecoin', symbol: 'LTC', name: 'Litecoin' };
  } else if (chain === 'bitcoin') {
    const txs = await fetchBitcoinTransactions({ address, onProgress });
    transfers = normalizeBitcoin({ txs, address });
    chainConfig = { coingeckoId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' };
  } else {
    if (!keys.etherscan) throw new Error('Etherscan API key required — set in Settings.');
    const cfg = EVM_CHAINS[chain];
    if (!cfg) throw new Error(`Unknown chain: ${chain}`);
    const raw = await fetchAllTransactions({
      chainId: cfg.id, address, apiKey: keys.etherscan, onProgress,
    });
    transfers = normalizeEvm({ ...raw, chain: cfg });
    chainConfig = cfg;
  }

  // Normalize chain field on every transfer to the user-facing string key
  // ('ethereum', 'base', 'solana', …) so downstream consumers (notes, network
  // graph, cluster suggestions) can reliably match against `wallet.chain`.
  // The EVM normalizer historically stored the numeric Etherscan chain id —
  // overwriting here keeps that internal but exposes a consistent key outward.
  for (const t of transfers) t.chain = chain;

  if (transfers.length === 0) {
    return {
      transfers: [], series: [],
      extrema: { high: null, low: null },
      top: { in: [], out: [], swap: [] },
      chainConfig,
      temperature: classifyTemperature([]),
      clusterCandidates: [],
    };
  }

  onProgress?.(`Got ${transfers.length} transfers — loading price history…`);
  const fromUnix = transfers[0].blockTime - 86400;
  const toUnix = transfers[transfers.length - 1].blockTime + 86400;

  // 1. Fetch native token price by coingeckoId.
  const idSeriesMap = new Map();
  if (chainConfig.coingeckoId) {
    try {
      const s = await getPriceSeries(chainConfig.coingeckoId, fromUnix, toUnix, keys.coingecko);
      idSeriesMap.set(chainConfig.coingeckoId, s);
    } catch (err) {
      console.warn('Native price fetch failed:', err.message);
    }
  }

  // 2. Identify ERC-20 tokens worth pricing — rank by transfer count, take top N.
  const tokenStats = new Map();
  for (const t of transfers) {
    if (!t.asset.contract) continue;
    const key = t.asset.contract;
    if (!tokenStats.has(key)) {
      tokenStats.set(key, { contract: key, platform: t.asset.platform, isStable: t.asset.isStable, count: 0, sample: t });
    }
    tokenStats.get(key).count += 1;
  }
  const tokens = [...tokenStats.values()].sort((a, b) => b.count - a.count);

  // 3. Fetch contract prices (skip stablecoins — those are pinned to $1).
  const contractSeriesMap = new Map();
  let priced = 0, missed = 0;
  const toFetch = tokens.filter(t => !t.isStable).slice(0, MAX_TOKENS_TO_PRICE);
  for (let i = 0; i < toFetch.length; i++) {
    const tok = toFetch[i];
    onProgress?.(`Pricing token ${i + 1}/${toFetch.length}: ${tok.sample.asset.symbol}`);
    try {
      const s = await getPriceSeriesByContract(tok.platform, tok.contract, fromUnix, toUnix, keys.coingecko);
      if (s.length > 0) { contractSeriesMap.set(tok.contract, s); priced++; }
      else missed++;
    } catch (err) {
      console.warn(`Price fetch failed for ${tok.sample.asset.symbol} (${tok.contract}):`, err.message);
      missed++;
      if (err.message?.includes('rate limit')) {
        // Stop early on rate limit — partial pricing is better than no pricing.
        onProgress?.(`Rate limited — stopped after ${i} tokens. Add a CoinGecko Pro key for more.`);
        break;
      }
    }
    await sleep(keys.coingecko ? 50 : 1500); // free tier: ~30 req/min
  }

  // 4. Unified price lookup.
  const priceLookup = (asset, ts) => {
    if (asset.isStable) return 1;
    if (asset.coingeckoId) {
      const s = idSeriesMap.get(asset.coingeckoId);
      if (s) return priceAt(s, ts);
    }
    if (asset.contract) {
      const s = contractSeriesMap.get(asset.contract);
      if (s) return priceAt(s, ts);
    }
    return 0;
  };

  onProgress?.('Computing rankings & balance timeline…');
  priceTransfers(transfers, priceLookup);

  // Tag every transfer's counterparty with a known-address label (if any). Done at
  // the pipeline level so downstream components don't each re-scan the registry.
  for (const t of transfers) {
    const lbl = labelFor(t.counterparty, t.chain);
    if (lbl) t.counterpartyLabel = lbl;
  }

  const series = buildBalanceSeries(transfers, priceLookup);
  const extrema = findExtrema(series);

  const top = {
    in: topByDirection(transfers, 'in', 5),
    out: topByDirection(transfers, 'out', 5),
    swap: topByDirection(transfers, 'swap', 5),
  };

  const temperature = classifyTemperature(transfers);
  const clusterCandidates = detectClusterCandidates(transfers);

  // ENS / SNS reverse-resolution for the wallet itself + every top-N
  // counterparty plus cluster candidates. Runs in the background so the rest
  // of the result returns immediately; UI subscribes via getCachedName.
  // We don't await this — names trickle into the cache and components that
  // call getCachedName re-render on the resolveTick signal below.
  resolveName(chain, address).then(() => notifyNameTick());
  const namesToWarm = new Set();
  for (const t of top.in)   if (t.counterparty) namesToWarm.add(t.counterparty);
  for (const t of top.out)  if (t.counterparty) namesToWarm.add(t.counterparty);
  for (const t of top.swap) if (t.counterparty) namesToWarm.add(t.counterparty);
  for (const c of clusterCandidates) namesToWarm.add(c.address);
  resolveBatch(chain, [...namesToWarm], { concurrency: 6 }).then(() => notifyNameTick());

  const summary = `${transfers.length.toLocaleString()} transfers · priced ${priced + (tokens.length - toFetch.length === 0 ? 0 : tokens.filter(t => t.isStable).length)} tokens · ${missed} unindexed`;
  onProgress?.(summary);

  return { transfers, series, extrema, top, chainConfig, temperature, clusterCandidates };
}

// Tiny pub-sub so components that call `getCachedName` can re-render when a
// new name lands in the cache. Components subscribe via subscribeNameTick.
const nameSubs = new Set();
let nameTick = 0;
function notifyNameTick() {
  nameTick += 1;
  for (const cb of nameSubs) {
    try { cb(nameTick); } catch (e) { console.warn(e); }
  }
}
export function subscribeNameTick(cb) {
  nameSubs.add(cb);
  return () => nameSubs.delete(cb);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Multi-hop tracing: given a counterparty address and a direction, fetch either
// its outflows ("where did the money go after that?") or its inflows ("where
// did the money originally come from?"). Skips price lookups (too slow for
// interactive use); top-N is by amount within asset.
export async function traceCounterpartyFlow({ chain, address, direction = 'out', keys, limit = 5, onProgress }) {
  if (!address || address === 'native' || address === 'DEX') {
    throw new Error('Counterparty has no on-chain address to trace');
  }
  if (direction !== 'in' && direction !== 'out') {
    throw new Error(`Invalid trace direction: ${direction}`);
  }

  let transfers = [];
  if (chain === 'solana') {
    if (!keys.helius) throw new Error('Helius API key required for Solana');
    const txs = await fetchSolanaTransactions({
      address, apiKey: keys.helius, onProgress, maxTxs: 200,
    });
    transfers = normalizeSolana({ txs, address });
  } else if (chain === 'xrp') {
    const txs = await fetchXrplTransactions({ address, onProgress, limit: 200 });
    transfers = normalizeXrp({ txs, address });
  } else if (chain === 'litecoin') {
    const txs = await fetchLitecoinTransactions({ address, onProgress, maxPages: 4 });
    transfers = normalizeLitecoin({ txs, address });
  } else if (chain === 'bitcoin') {
    const txs = await fetchBitcoinTransactions({ address, onProgress, maxPages: 4 });
    transfers = normalizeBitcoin({ txs, address });
  } else {
    if (!keys.etherscan) throw new Error('Etherscan API key required');
    const cfg = EVM_CHAINS[chain];
    if (!cfg) throw new Error(`Unknown chain: ${chain}`);
    const raw = await fetchAllTransactions({
      chainId: cfg.id, address, apiKey: keys.etherscan, onProgress,
    });
    transfers = normalizeEvm({ ...raw, chain: cfg });
  }

  // Same chain-key normalization as analyzeWallet — see comment there.
  for (const t of transfers) t.chain = chain;

  // Tag known counterparties so the hop nodes also show labels.
  for (const t of transfers) {
    const lbl = labelFor(t.counterparty, t.chain);
    if (lbl) t.counterpartyLabel = lbl;
  }

  // For 'out' trace, group by recipient. For 'in' trace, group by source. The
  // counterparty field on each transfer already points to the OTHER party
  // relative to `address`, so the same grouping logic works for both.
  const filtered = transfers.filter(t => t.direction === direction);
  const byCp = new Map();
  for (const t of filtered) {
    const k = t.counterparty;
    if (!byCp.has(k)) byCp.set(k, { counterparty: k, total: 0, count: 0, last: t, label: t.counterpartyLabel, direction });
    const g = byCp.get(k);
    g.total += t.amount;
    g.count += 1;
    if (t.blockTime > g.last.blockTime) g.last = t;
  }

  return [...byCp.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

// Back-compat alias — older callers used traceOutflows for OUT-only tracing.
export const traceOutflows = (opts) => traceCounterpartyFlow({ ...opts, direction: 'out' });
