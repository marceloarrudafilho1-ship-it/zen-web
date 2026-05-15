// Litecoin adapter. Uses litecoinspace.org's mempool.space-compatible API —
// public, no key required. Returns Bitcoin-style UTXO transaction objects;
// normalisation into the unified Transfer shape happens in
// analyzer.normalizeLitecoin (net change per tx is computed there).
//
// Docs (forked from mempool.space): https://mempool.space/docs/api/rest

const BASE = 'https://litecoinspace.org/api';
const PAGE_SIZE = 25; // mempool.space pages 25 confirmed txs at a time

export async function fetchLitecoinTransactions({ address, onProgress, maxPages = 8 }) {
  const all = [];
  let lastTxid = null;

  for (let page = 0; page < maxPages; page++) {
    onProgress?.(`Fetching Litecoin transactions (page ${page + 1})…`);
    const url = lastTxid
      ? `${BASE}/address/${address}/txs/chain/${lastTxid}`
      : `${BASE}/address/${address}/txs`;

    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (res.status === 404) break;
    if (res.status === 400) {
      // Some endpoints return 400 for invalid-looking address; surface as user-friendly error
      throw new Error('Invalid Litecoin address');
    }
    if (!res.ok) throw new Error(`Litecoin HTTP ${res.status}`);

    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    lastTxid = batch[batch.length - 1].txid;
  }

  onProgress?.(`Got ${all.length} Litecoin transactions`);
  return all;
}
