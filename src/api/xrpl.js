// XRP Ledger adapter. Public JSON-RPC cluster — no key required for basic
// account history queries. Returns the raw `account_tx` payload; normalisation
// to the unified Transfer shape happens in analyzer.normalizeXrp.
//
// Docs: https://xrpl.org/account_tx.html

const ENDPOINT = 'https://xrplcluster.com/';

// XRPL stores `tx.date` as seconds since the Ripple epoch (2000-01-01 UTC).
// Add this constant to convert to Unix epoch seconds.
export const RIPPLE_EPOCH_OFFSET = 946684800;

export async function fetchXrplTransactions({ address, onProgress, limit = 200 }) {
  onProgress?.('Fetching XRPL account history…');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'account_tx',
      params: [{
        account: address,
        ledger_index_min: -1,
        ledger_index_max: -1,
        limit,
        forward: false, // newest first
      }],
    }),
  });

  if (!res.ok) throw new Error(`XRPL HTTP ${res.status}`);
  const json = await res.json();
  const r = json.result;

  if (r?.status === 'error') {
    if (r.error === 'actNotFound') return [];
    throw new Error(`XRPL: ${r.error_message || r.error}`);
  }

  onProgress?.(`Got ${(r?.transactions || []).length} XRPL transactions`);
  return r?.transactions || [];
}
