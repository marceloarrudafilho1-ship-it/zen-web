// NOWNodes server-side adapter — fetches on-chain data using the operator's
// NOWNODES_API_KEY so premium users (ai_enabled=true) don't have to supply
// their own provider keys. Currently covers Bitcoin and Litecoin via NOWNodes'
// Blockbook indexed-address API; the response is transformed to the same
// mempool.space-style shape the existing normalizeUtxo() function expects, so
// no client-side code changes are needed beyond the network swap.

const KEY = process.env.NOWNODES_API_KEY;

// Blockbook host segment per chain. Append `.nownodes.io` to form the host.
const BLOCKBOOK_HOSTS = {
  bitcoin:  'btcbook',
  litecoin: 'ltcbook',
};

const PAGE_SIZE = 100; // Blockbook default; tops out at 1000 but 100 is gentle on quota.

export function nowNodesConfigured() {
  return !!KEY;
}

export function nowNodesSupports(chain) {
  return chain in BLOCKBOOK_HOSTS && !!KEY;
}

// Fetches the address's transaction history from NOWNodes Blockbook, paging
// through results until the requested maximum is reached or the wallet has no
// more transactions. Returns each tx already transformed to mempool.space
// shape so the existing UTXO normalizer can consume it directly.
export async function fetchNowNodesUtxoTxs(chain, address, { maxPages = 4 } = {}) {
  if (!KEY) throw new Error('NOWNODES_API_KEY not configured');
  const host = BLOCKBOOK_HOSTS[chain];
  if (!host) throw new Error(`NOWNodes Blockbook does not support chain: ${chain}`);

  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `https://${host}.nownodes.io/api/v2/address/${address}`
      + `?details=txs&page=${page}&pageSize=${PAGE_SIZE}`;
    const res = await fetch(url, { headers: { 'api-key': KEY } });

    if (res.status === 400) throw new Error(`Invalid ${chain} address`);
    if (res.status === 404) break;
    if (!res.ok) throw new Error(`NOWNodes ${chain} HTTP ${res.status}`);

    const data = await res.json();
    const batch = data.transactions || [];
    if (batch.length === 0) break;

    for (const btx of batch) out.push(blockbookToMempoolShape(btx));

    if (batch.length < PAGE_SIZE) break;
  }

  return out;
}

// Blockbook tx → mempool.space tx. Field-by-field translation so the existing
// analyzer code doesn't need to know it came from NOWNodes.
//
//   Blockbook                     mempool.space
//   ──────────                    ─────────────
//   vin[].addresses[0]            vin[].prevout.scriptpubkey_address
//   vin[].value                   vin[].prevout.value           (sats, as number)
//   vout[].addresses[0]           vout[].scriptpubkey_address
//   vout[].value                  vout[].value                  (sats, as number)
//   blockTime                     status.block_time
//   confirmations > 0             status.confirmed              (boolean)
function blockbookToMempoolShape(btx) {
  return {
    txid: btx.txid,
    vin: (btx.vin || []).map(v => ({
      prevout: {
        scriptpubkey_address: v.addresses?.[0],
        value: Number(v.value || 0),
      },
    })),
    vout: (btx.vout || []).map(v => ({
      scriptpubkey_address: v.addresses?.[0],
      value: Number(v.value || 0),
    })),
    status: {
      confirmed: !!(btx.confirmations && btx.confirmations > 0),
      block_time: btx.blockTime || 0,
    },
  };
}
