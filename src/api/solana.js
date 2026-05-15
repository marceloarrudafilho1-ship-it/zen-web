// Solana adapter via Helius enhanced transactions API.
// Helius parses transactions into a typed format (TRANSFER, SWAP, etc.) so we can
// reuse the same downstream analyzer shape.

const HELIUS_BASE = 'https://api.helius.xyz/v0';

export async function fetchSolanaTransactions({ address, apiKey, onProgress, maxTxs = 5000 }) {
  const all = [];
  let before;
  while (true) {
    const url = new URL(`${HELIUS_BASE}/addresses/${address}/transactions`);
    url.searchParams.set('api-key', apiKey);
    url.searchParams.set('limit', '100');
    if (before) url.searchParams.set('before', before);
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Helius HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    onProgress?.(`Fetched ${all.length} Solana txs`);
    before = batch[batch.length - 1].signature;
    if (batch.length < 100) break;
    if (all.length >= maxTxs) break;
  }
  return all;
}
