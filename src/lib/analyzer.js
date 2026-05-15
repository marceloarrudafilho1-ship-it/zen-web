// Normalizes raw chain payloads into a unified Transfer model, then derives
// top-N IN / OUT / SWAP rankings.

import { DEX_ROUTERS, STABLECOINS, looksLikeSwapInput } from '../api/evm.js';
import { RIPPLE_EPOCH_OFFSET } from '../api/xrpl.js';

// Unified shape:
// {
//   id, hash, blockTime (unix s), direction ('in' | 'out' | 'swap'),
//   counterparty, asset { symbol, address, decimals, coingeckoId?, platform?, contract? },
//   amount (number, human units),
//   usd (number | null), kind, chain, raw
// }

export function normalizeEvm({ normal, internal, erc20, address, chain }) {
  const me = address.toLowerCase();
  const native = chain.symbol;
  const out = [];

  for (const tx of normal) {
    const value = Number(tx.value) / 1e18;
    if (value === 0) continue; // pure contract calls handled via erc20/internal traces
    const from = tx.from?.toLowerCase();
    const to = tx.to?.toLowerCase();
    if (from !== me && to !== me) continue;
    out.push({
      id: `evm:${tx.hash}:n`,
      hash: tx.hash,
      blockTime: Number(tx.timeStamp),
      direction: from === me ? 'out' : 'in',
      counterparty: from === me ? to : from,
      asset: { symbol: native, address: 'native', decimals: 18, coingeckoId: chain.coingeckoId },
      amount: value,
      usd: null,
      kind: 'native',
      chain: chain.id,
      raw: tx,
      _routerHit: DEX_ROUTERS.has(to) || DEX_ROUTERS.has(from) || looksLikeSwapInput(tx.input),
    });
  }

  for (const tx of internal) {
    const value = Number(tx.value) / 1e18;
    if (value === 0) continue;
    const from = tx.from?.toLowerCase();
    const to = tx.to?.toLowerCase();
    if (from !== me && to !== me) continue;
    out.push({
      id: `evm:${tx.hash}:i:${tx.traceId || ''}`,
      hash: tx.hash,
      blockTime: Number(tx.timeStamp),
      direction: from === me ? 'out' : 'in',
      counterparty: from === me ? to : from,
      asset: { symbol: native, address: 'native', decimals: 18, coingeckoId: chain.coingeckoId },
      amount: value,
      usd: null,
      kind: 'internal',
      chain: chain.id,
      raw: tx,
    });
  }

  for (const tx of erc20) {
    const decimals = Number(tx.tokenDecimal || 18);
    const value = Number(tx.value) / Math.pow(10, decimals);
    if (value === 0) continue;
    const from = tx.from?.toLowerCase();
    const to = tx.to?.toLowerCase();
    if (from !== me && to !== me) continue;
    const contract = tx.contractAddress?.toLowerCase();
    out.push({
      id: `evm:${tx.hash}:t:${contract}:${from}:${to}:${tx.value}`,
      hash: tx.hash,
      blockTime: Number(tx.timeStamp),
      direction: from === me ? 'out' : 'in',
      counterparty: from === me ? to : from,
      asset: {
        symbol: tx.tokenSymbol || 'TOKEN',
        address: contract,
        decimals,
        platform: chain.platform,
        contract,
        isStable: STABLECOINS.has(contract),
      },
      amount: value,
      usd: null,
      kind: 'erc20',
      chain: chain.id,
      raw: tx,
    });
  }

  return classifySwapsByHash(out.sort((a, b) => a.blockTime - b.blockTime), me);
}

// Hash-grouping swap detector. If within a single tx hash the wallet has both
// outgoing and incoming asset legs (and they involve different assets), reclassify
// the legs as 'swap'. This catches every DEX/aggregator without a router list.
function classifySwapsByHash(transfers, me) {
  const byHash = new Map();
  for (const t of transfers) {
    if (!byHash.has(t.hash)) byHash.set(t.hash, []);
    byHash.get(t.hash).push(t);
  }
  for (const legs of byHash.values()) {
    if (legs.length < 2) continue;
    const ins = legs.filter(l => l.direction === 'in');
    const outs = legs.filter(l => l.direction === 'out');
    if (ins.length === 0 || outs.length === 0) continue;
    const distinctAssets = new Set(legs.map(l => `${l.asset.address}`));
    if (distinctAssets.size < 2) continue;
    // Reclassify every leg in this hash as swap.
    for (const l of legs) {
      l.direction = 'swap';
      l.kind = l.kind === 'erc20' ? 'swap_erc20' : (l.kind === 'native' ? 'swap_native' : 'swap_' + l.kind);
    }
  }
  return transfers;
}

export function normalizeSolana({ txs, address }) {
  const out = [];
  for (const tx of txs) {
    const ts = tx.timestamp;
    if (tx.type === 'SWAP' && tx.events?.swap) {
      const sw = tx.events.swap;
      const tokenIn = sw.tokenInputs?.[0] || sw.nativeInput;
      const tokenOut = sw.tokenOutputs?.[0] || sw.nativeOutput;
      const inAmt = tokenIn ? Number(tokenIn.rawTokenAmount?.tokenAmount || tokenIn.amount || 0) /
        Math.pow(10, tokenIn.rawTokenAmount?.decimals ?? 9) : 0;
      out.push({
        id: `sol:${tx.signature}:swap`,
        hash: tx.signature,
        blockTime: ts,
        direction: 'swap',
        counterparty: tx.source || 'DEX',
        asset: {
          symbol: tokenIn?.mint ? short(tokenIn.mint) : 'SOL',
          address: tokenIn?.mint || 'native',
          decimals: tokenIn?.rawTokenAmount?.decimals ?? 9,
          coingeckoId: tokenIn ? null : 'solana',
        },
        amount: inAmt,
        usd: null,
        kind: 'sol_swap',
        chain: 'solana',
        meta: { tokenOut: tokenOut?.mint, outAmount: tokenOut?.amount },
        raw: tx,
      });
      continue;
    }
    for (const t of tx.nativeTransfers || []) {
      if (t.fromUserAccount !== address && t.toUserAccount !== address) continue;
      out.push({
        id: `sol:${tx.signature}:n:${t.fromUserAccount}:${t.toUserAccount}:${t.amount}`,
        hash: tx.signature,
        blockTime: ts,
        direction: t.fromUserAccount === address ? 'out' : 'in',
        counterparty: t.fromUserAccount === address ? t.toUserAccount : t.fromUserAccount,
        asset: { symbol: 'SOL', address: 'native', decimals: 9, coingeckoId: 'solana' },
        amount: Number(t.amount) / 1e9,
        usd: null,
        kind: 'native',
        chain: 'solana',
        raw: tx,
      });
    }
    for (const t of tx.tokenTransfers || []) {
      if (t.fromUserAccount !== address && t.toUserAccount !== address) continue;
      out.push({
        id: `sol:${tx.signature}:t:${t.mint}:${t.fromUserAccount}:${t.toUserAccount}`,
        hash: tx.signature,
        blockTime: ts,
        direction: t.fromUserAccount === address ? 'out' : 'in',
        counterparty: t.fromUserAccount === address ? t.toUserAccount : t.fromUserAccount,
        asset: { symbol: short(t.mint), address: t.mint, decimals: t.tokenStandard === 'NonFungible' ? 0 : 9 },
        amount: Number(t.tokenAmount || 0),
        usd: null,
        kind: 'spl',
        chain: 'solana',
        raw: tx,
      });
    }
  }
  return out.sort((a, b) => a.blockTime - b.blockTime);
}

function short(addr) {
  if (!addr) return '?';
  return addr.slice(0, 4) + '…' + addr.slice(-4);
}

// XRP Ledger — focus on Payment transactions in XRP (drops). Issued-currency
// IOU payments (where tx.Amount is an object, not a string) are skipped because
// they require pricing info we don't pull.
export function normalizeXrp({ txs, address }) {
  const out = [];
  for (const wrap of txs) {
    // account_tx wraps each tx; older nodes return it under `tx` or `tx_json`.
    const tx = wrap.tx || wrap.tx_json || wrap;
    if (!tx || tx.TransactionType !== 'Payment') continue;
    if (typeof tx.Amount !== 'string') continue; // IOU/issued-currency: skip

    const sender = tx.Account;
    const recipient = tx.Destination;
    if (sender !== address && recipient !== address) continue;

    const xrp = Number(tx.Amount) / 1e6; // drops → XRP
    if (!Number.isFinite(xrp) || xrp <= 0) continue;

    const direction = sender === address ? 'out' : 'in';
    const counterparty = sender === address ? recipient : sender;
    const blockTime = Number(tx.date || 0) + RIPPLE_EPOCH_OFFSET;
    const hash = tx.hash || wrap.hash;

    out.push({
      id: `xrp:${hash}`,
      hash,
      blockTime,
      direction,
      counterparty,
      asset: { symbol: 'XRP', address: 'native', decimals: 6, coingeckoId: 'ripple' },
      amount: xrp,
      usd: null,
      kind: 'native',
      chain: 'xrp',
      raw: wrap,
    });
  }
  return out.sort((a, b) => a.blockTime - b.blockTime);
}

// UTXO (Bitcoin / Litecoin) — A "Transfer" here is the *net change* the wallet
// experienced in a single transaction. Counterparty heuristic: the largest
// non-self input (for inbound) or non-self output (for outbound) — usually the
// merchant / exchange address, occasionally a change address. Good enough for
// top-N visualisation; cluster work would need richer input-set analysis.
//
// Bitcoin and Litecoin share the mempool.space-style response shape, so this
// one function powers both — caller picks the chain ID prefix and asset.
export function normalizeUtxo({ txs, address, chain, symbol, coingeckoId, idPrefix }) {
  const out = [];
  for (const tx of txs) {
    let inFromUs = 0;   // sats we contributed via inputs
    let outToUs = 0;    // sats we received via outputs
    const otherInputs = new Map();   // addr → total sats sent by that input
    const otherOutputs = new Map();  // addr → total sats received by that output

    for (const vin of tx.vin || []) {
      const a = vin.prevout?.scriptpubkey_address;
      const v = vin.prevout?.value || 0;
      if (!a) continue;
      if (a === address) inFromUs += v;
      else otherInputs.set(a, (otherInputs.get(a) || 0) + v);
    }
    for (const vout of tx.vout || []) {
      const a = vout.scriptpubkey_address;
      const v = vout.value || 0;
      if (!a) continue;
      if (a === address) outToUs += v;
      else otherOutputs.set(a, (otherOutputs.get(a) || 0) + v);
    }

    const netSats = outToUs - inFromUs;
    if (netSats === 0) continue;

    const direction = netSats > 0 ? 'in' : 'out';
    const counterparty = largestKey(direction === 'in' ? otherInputs : otherOutputs) || 'unknown';

    const blockTime = tx.status?.block_time || 0;
    const amount = Math.abs(netSats) / 1e8;

    out.push({
      id: `${idPrefix}:${tx.txid}`,
      hash: tx.txid,
      blockTime,
      direction,
      counterparty,
      asset: { symbol, address: 'native', decimals: 8, coingeckoId },
      amount,
      usd: null,
      kind: 'native',
      chain,
      raw: tx,
    });
  }
  return out.sort((a, b) => a.blockTime - b.blockTime);
}

// Thin wrappers preserving the older call sites and making intent obvious.
export const normalizeLitecoin = ({ txs, address }) =>
  normalizeUtxo({ txs, address, chain: 'litecoin', symbol: 'LTC', coingeckoId: 'litecoin', idPrefix: 'ltc' });

export const normalizeBitcoin = ({ txs, address }) =>
  normalizeUtxo({ txs, address, chain: 'bitcoin', symbol: 'BTC', coingeckoId: 'bitcoin', idPrefix: 'btc' });

function largestKey(map) {
  let best = null, bestVal = -Infinity;
  for (const [k, v] of map) if (v > bestVal) { best = k; bestVal = v; }
  return best;
}

export function priceTransfers(transfers, priceLookup) {
  for (const t of transfers) {
    const px = priceLookup(t.asset, t.blockTime);
    t.usd = px == null ? null : t.amount * px;
  }
  return transfers;
}

// Top-N by USD when we have it; falls back to amount-rank if NOTHING in this
// direction got priced (so the user still sees their biggest activity).
export function topByDirection(transfers, direction, n = 5) {
  const subset = transfers.filter(t => t.direction === direction);
  const priced = subset.filter(t => (t.usd ?? 0) > 0);
  if (priced.length > 0) {
    return priced.sort((a, b) => (b.usd || 0) - (a.usd || 0)).slice(0, n);
  }
  // Amount-only fallback: rank within each asset, then take the top across assets
  return subset
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}
