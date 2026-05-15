// Bitcoin adapter. Uses mempool.space's public address-tx API — no key
// required. Same UTXO response shape as litecoinspace.org so we re-use the
// same normalizer (analyzer.normalizeUtxo) for both.
//
// Docs: https://mempool.space/docs/api/rest

const BASE = 'https://mempool.space/api';
const PAGE_SIZE = 25; // mempool.space returns 25 confirmed txs per page

export async function fetchBitcoinTransactions({ address, onProgress, maxPages = 8 }) {
  const all = [];
  let lastTxid = null;

  for (let page = 0; page < maxPages; page++) {
    onProgress?.(`Fetching Bitcoin transactions (page ${page + 1})…`);
    const url = lastTxid
      ? `${BASE}/address/${address}/txs/chain/${lastTxid}`
      : `${BASE}/address/${address}/txs`;

    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (res.status === 404) break;
    if (res.status === 400) throw new Error('Invalid Bitcoin address');
    if (!res.ok) throw new Error(`Bitcoin HTTP ${res.status}`);

    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    lastTxid = batch[batch.length - 1].txid;
  }

  onProgress?.(`Got ${all.length} Bitcoin transactions`);
  return all;
}
