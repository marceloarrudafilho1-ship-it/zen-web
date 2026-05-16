// SSE client for /api/ai/explain. Streams Claude's deltas back to a callback
// so the caller can render text as it arrives. Returns a promise that resolves
// once the stream ends (or rejects on error).

export async function explainWallet({ wallet, onDelta, signal }) {
  const res = await fetch('/api/ai/explain', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet }),
    signal,
  });

  // Non-stream errors are normal JSON; surface them with the same shape as the
  // other API wrappers in src/api/auth.js.
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch {}
    throw new Error(data?.error || `AI request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let stopReason = null;
  let usage = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE framing: events are separated by blank lines, fields by '\n'.
    // We only emit `data:` lines.
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLine = raw
        .split('\n')
        .filter(l => l.startsWith('data:'))
        .map(l => l.slice(5).trim())
        .join('');
      if (!dataLine) continue;
      let evt;
      try { evt = JSON.parse(dataLine); } catch { continue; }

      if (evt.type === 'delta') onDelta?.(evt.text || '');
      else if (evt.type === 'done') { stopReason = evt.stop_reason; usage = evt.usage; }
      else if (evt.type === 'error') throw new Error(evt.error || 'AI stream error');
    }
  }

  return { stopReason, usage };
}
