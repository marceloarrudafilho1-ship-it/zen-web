// web3.bio public profile API — given any identity (ENS, wallet, .lens,
// .farcaster, basename, etc.) returns an array of linked profile records, each
// with its platform, identity, address, social links, avatar, etc.
//
// Docs: https://api.web3.bio/  (no auth required for basic profile queries)

export async function lookupIdentity(handle, apiKey) {
  const trimmed = String(handle || '').trim();
  if (!trimmed) throw new Error('Empty identity');

  const url = `https://api.web3.bio/profile/${encodeURIComponent(trimmed)}`;
  const headers = { 'Accept': 'application/json' };
  if (apiKey) headers['X-API-KEY'] = apiKey;
  const res = await fetch(url, { headers });

  if (res.status === 404) return [];
  if (res.status === 429) throw new Error('Rate limited by web3.bio — try again in a minute');
  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); detail = j?.error || j?.message || ''; } catch {}
    throw new Error(`web3.bio ${res.status}${detail ? ': ' + detail : ''}`);
  }

  const data = await res.json();
  // The API normally returns an array of profile records. Defensive in case a
  // single object slips through.
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}
