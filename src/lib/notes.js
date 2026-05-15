// Address notes — investigator's scratch pad. Keyed per chain so the same
// address on different chains can hold different annotations. Persisted in
// localStorage and broadcast via a tiny pub-sub so any view that displays
// the address re-renders when a note changes.

const STORAGE_KEY = 'zen.notes.v1';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

let cache = load();
const subs = new Set();

function emit() {
  for (const cb of subs) {
    try { cb(); } catch (e) { console.warn('note listener threw', e); }
  }
}

function key(address, chain) {
  if (!address) return null;
  // EVM addresses are case-insensitive; Solana base58 is case-sensitive.
  const a = chain === 'solana' ? String(address) : String(address).toLowerCase();
  return `${chain || 'evm'}:${a}`;
}

export function getNote(address, chain) {
  const k = key(address, chain);
  if (!k) return '';
  return cache[k] || '';
}

export function setNote(address, chain, text) {
  const k = key(address, chain);
  if (!k) return;
  const trimmed = (text || '').trim();
  if (trimmed) cache[k] = trimmed;
  else delete cache[k];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('failed to persist note', e);
  }
  emit();
}

// Subscribe to any note change. Returns an unsubscribe fn.
export function subscribeNotes(cb) {
  subs.add(cb);
  return () => subs.delete(cb);
}

// Used by the case-file exporter to snapshot the full note table at save time.
export function getAllNotes() {
  return { ...cache };
}

// Used by the case-file importer. Imported notes override matching keys —
// caller decides whether to merge or wipe-and-replace. Returns the count of
// keys that changed.
export function mergeNotes(incoming, { replace = false } = {}) {
  if (!incoming || typeof incoming !== 'object') return 0;
  let changed = 0;
  if (replace) {
    for (const k of Object.keys(cache)) delete cache[k];
  }
  for (const [k, v] of Object.entries(incoming)) {
    if (typeof v !== 'string' || !v.trim()) continue;
    if (cache[k] !== v) { cache[k] = v; changed += 1; }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('failed to persist merged notes', e);
  }
  emit();
  return changed;
}

// Convenience for components: bumps a counter on every note change so that
// memoized derived values (graph builds, list orders) can recompute.
export function notesVersion() {
  return version;
}

let version = 0;
subscribeNotes(() => { version += 1; });
