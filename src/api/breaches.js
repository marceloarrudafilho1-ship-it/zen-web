// Breach-data search clients for fund-recovery investigation work.
// Snusbase API: documented at https://docs.snusbase.com/
// LeakPeek API: requires a Pro account; endpoint shape based on their public docs.
//
// CORS NOTE: Both providers return CORS-restricted responses. They will work
// from Electron (no CORS in main-process / packaged app) but will fail from a
// pure browser dev server. If you hit "Failed to fetch" from `npm run dev`,
// that's why — the Electron build (or a small local proxy) will resolve it.

// Snusbase type map — our UI types → Snusbase API types.
// Reference: https://docs.snusbase.com/#data-types
const SNUS_TYPES = {
  email: 'email',
  username: 'username',
  domain: '_domain',
  ip: 'lastip',
  name: 'name',
  hash: 'hash',
  phone: 'phone',
  // 'keyword' has no native Snusbase type; we fall back to a multi-field search.
};

export async function searchSnusbase(type, term, apiKey) {
  if (!apiKey) throw new Error('Snusbase API key not set.');
  if (!term?.trim()) throw new Error('Empty search term.');

  let body;
  if (type === 'keyword') {
    body = {
      terms: [term],
      types: ['email', 'username', 'name', '_domain'],
      wildcard: true,
    };
  } else {
    const t = SNUS_TYPES[type];
    if (!t) throw new Error(`Snusbase: type "${type}" not supported.`);
    body = { terms: [term], types: [t], wildcard: false };
  }

  const res = await fetch('https://api.snusbase.com/data/search', {
    method: 'POST',
    headers: {
      'Auth': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Snusbase HTTP ${res.status}: ${text.slice(0, 200) || res.statusText}`);
  }
  const json = await res.json();
  return normalizeSnusbase(json);
}

// Snusbase response shape: { took, size, results: { db_name: [ { ... } ] } }
function normalizeSnusbase(json) {
  const grouped = [];
  const results = json?.results || {};
  for (const [db, rows] of Object.entries(results)) {
    if (!Array.isArray(rows) || rows.length === 0) continue;
    grouped.push({
      source: db,
      count: rows.length,
      rows: rows.map(r => sanitizeRow(r)),
    });
  }
  return { provider: 'snusbase', took: json?.took, total: grouped.reduce((a, g) => a + g.count, 0), groups: grouped };
}

// LeakPeek search. Endpoint: https://leakpeek.com/api/v2/search (per their docs).
// Auth header: X-API-KEY. Body: { type, value }.
export async function searchLeakpeek(type, term, apiKey) {
  if (!apiKey) throw new Error('LeakPeek API key not set.');
  if (!term?.trim()) throw new Error('Empty search term.');

  const LP_TYPES = {
    email: 'email',
    username: 'username',
    keyword: 'keyword',
    domain: 'domain',
    ip: 'ip',
    name: 'fullname',
    hash: 'hash',
    phone: 'phone',
  };
  const t = LP_TYPES[type];
  if (!t) throw new Error(`LeakPeek: type "${type}" not supported.`);

  const res = await fetch('https://leakpeek.com/api/v2/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: t, value: term }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LeakPeek HTTP ${res.status}: ${text.slice(0, 200) || res.statusText}`);
  }
  const json = await res.json();
  return normalizeLeakpeek(json);
}

function normalizeLeakpeek(json) {
  // LeakPeek shape varies; normalize to the same shape as Snusbase output.
  const groups = [];
  const list = Array.isArray(json) ? json : (json?.results || json?.data || []);
  if (Array.isArray(list)) {
    // Group by `source` / `database` field if present.
    const buckets = new Map();
    for (const row of list) {
      const src = row.source || row.database || row.db || 'leakpeek';
      if (!buckets.has(src)) buckets.set(src, []);
      buckets.get(src).push(sanitizeRow(row));
    }
    for (const [src, rows] of buckets) {
      groups.push({ source: src, count: rows.length, rows });
    }
  }
  return { provider: 'leakpeek', total: groups.reduce((a, g) => a + g.count, 0), groups };
}

// Strip plaintext password fields from results — we don't surface passwords in
// the UI even if the upstream API returns them. Hashes are kept (research use).
function sanitizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const lower = k.toLowerCase();
    if (lower === 'password' || lower === 'pass' || lower === 'plaintext' || lower === 'cleartext') {
      out[k] = '••• (redacted)';
    } else {
      out[k] = v;
    }
  }
  return out;
}
