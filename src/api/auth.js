// Thin wrapper over the same-origin /api/auth endpoints. Cookies are sent
// automatically (credentials:'include') so the JWT round-trips without us
// needing to touch it from JS.

async function postJson(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }
  return data;
}

export const apiSignup = ({ email, password, inviteCode }) =>
  postJson('/api/auth/signup', { email, password, inviteCode });

export const apiLogin = ({ email, password }) =>
  postJson('/api/auth/login', { email, password });

export const apiLogout = () => postJson('/api/auth/logout', {});

export async function apiWhoAmI() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`whoami: ${res.status}`);
  const data = await res.json();
  return data.user || null;
}
