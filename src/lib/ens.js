// ENS (Ethereum) + SNS (Solana) reverse-resolution. Both use free public
// endpoints — no API key required — and results are cached in-memory plus
// localStorage so repeated lookups across sessions are instant.
//
// EVM resolution returns a primary ENS name (e.g. "vitalik.eth"). It applies
// across every EVM chain in this app because ENS names live on mainnet but
// the address is the same everywhere. Solana lookups go through Bonfida's
// SNS proxy.
//
// Errors and "no name" results are negative-cached so we don't slam the
// services with retries during a single analysis pass.

const STORAGE_KEY = 'zen.ens.v1';
const NEGATIVE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

const cache = loadCache();        // { 'ethereum:0x...': { name: 'vitalik.eth', t: 1234 } }
const inflight = new Map();       // dedupe concurrent requests

function loadCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistCache() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)); } catch {}
}

function key(chain, address) {
  if (!address) return null;
  const family = chain === 'solana' ? 'solana' : 'evm';
  const a = chain === 'solana' ? address : String(address).toLowerCase();
  return `${family}:${a}`;
}

export function getCachedName(chain, address) {
  const k = key(chain, address);
  if (!k) return null;
  const entry = cache[k];
  if (!entry) return null;
  if (entry.name) return entry.name;
  // Negative entry — refuse to return null too eagerly so a UI re-render after
  // a successful lookup picks up the new value.
  if (Date.now() - entry.t > NEGATIVE_TTL_MS) return null;
  return null;
}

export async function resolveName(chain, address) {
  const k = key(chain, address);
  if (!k) return null;
  const cached = cache[k];
  if (cached) {
    if (cached.name) return cached.name;
    if (Date.now() - cached.t < NEGATIVE_TTL_MS) return null;
  }
  if (inflight.has(k)) return inflight.get(k);

  const p = (async () => {
    try {
      const name = chain === 'solana'
        ? await resolveSns(address)
        : await resolveEns(address);
      cache[k] = { name: name || null, t: Date.now() };
      persistCache();
      return name || null;
    } catch (err) {
      console.warn(`name lookup failed for ${chain}:${address}`, err);
      cache[k] = { name: null, t: Date.now() };
      persistCache();
      return null;
    } finally {
      inflight.delete(k);
    }
  })();
  inflight.set(k, p);
  return p;
}

// ensideas.com — small free reverse-resolver. Returns { address, name, avatar }.
async function resolveEns(address) {
  const res = await fetch(`https://api.ensideas.com/ens/resolve/${address}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json?.name || null;
}

// Bonfida public SNS proxy.
async function resolveSns(address) {
  const res = await fetch(`https://sns-sdk-proxy.bonfida.workers.dev/reverse/${address}`);
  if (!res.ok) return null;
  const json = await res.json();
  // Response shape: { s: 'ok', result: 'name.sol' } or { s: 'error', ... }
  if (json?.s !== 'ok' || !json.result) return null;
  // Ensure trailing .sol for clarity
  const name = String(json.result);
  return name.endsWith('.sol') ? name : `${name}.sol`;
}

// Resolve in batches — used by the pipeline after analysis to pre-warm names
// for the top counterparties. Limits concurrency so we don't fan out 50
// parallel requests on a fresh wallet.
export async function resolveBatch(chain, addresses, { concurrency = 4 } = {}) {
  const uniq = [...new Set(addresses.filter(Boolean))];
  const results = {};
  let i = 0;
  async function worker() {
    while (i < uniq.length) {
      const idx = i++;
      const addr = uniq[idx];
      results[addr] = await resolveName(chain, addr);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, uniq.length) }, worker));
  return results;
}
