// AI features powered by Claude. Currently exposes one endpoint:
//
//   POST /api/ai/explain   — streams a natural-language analysis of a wallet
//                            back to the client over SSE
//
// Gated by users.ai_enabled (set at signup via INVITE_CODE_PREMIUM, or by
// flipping the DB column directly). Requires ANTHROPIC_API_KEY on the server.

import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { requireAi } from './auth.js';

const router = Router();

// Lazy client — instantiating without a key throws, and we want a graceful
// 503 response instead of a boot-time crash if the env var isn't set.
let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM_PROMPT = `You are an experienced on-chain analyst helping investigators interpret crypto wallet activity. You will receive structured data about a single wallet (address, chain, top counterparties, balance history, known labels, optional trace path). Produce a focused investigation brief.

Format your response as concise Markdown with the following sections, in order:

**Profile** — One paragraph (2-3 sentences) classifying the wallet (active trader / long-term holder / fresh wallet / exchange or service / mixer / hot money / etc.) and stating confidence.

**Counterparty mix** — Bullet list. What do the top inflows and outflows reveal? Note any CEX exposure (likely KYC pivot points), bridges (likely cross-chain laundering), mixers (red flag), DeFi (normal user behavior).

**Patterns & anomalies** — Bullet list. Sudden activity spikes, dormancy followed by movement, round-trip flows, unusual timing, asset concentration, etc.

**Risk flags** — Bullet list of concrete red flags if any (sanctioned addresses, mixer interactions, known drainer contracts, bridges to opaque chains). If none, say so explicitly.

**Next moves** — 2-4 numbered investigative steps. Be specific: trace which counterparty? lookup which identity? check which exchange's KYC? leave at most one open-ended exploratory move.

Rules:
- Stay under 350 words total.
- Don't repeat the wallet's address or pad with disclaimers.
- Don't speculate beyond what the data supports — say "insufficient data" when warranted.
- Use plain dollar amounts ($12.4K, $3.2M) — no LaTeX, no \\(\\), no \\frac.
- When you mention a counterparty, prefer its label (e.g. "Binance 14") over the raw address.`;

// Trim a wallet object to the minimum context Claude needs.
function compactWalletSummary(w) {
  if (!w || typeof w !== 'object') return null;

  const fmtUsd = (n) => (n == null ? null : Math.round(n));
  const date = (ts) => (ts ? new Date(ts * 1000).toISOString().slice(0, 10) : null);

  const compactTx = (t) => ({
    direction: t.direction,
    amount: Number(t.amount?.toFixed?.(4) ?? t.amount),
    symbol: t.symbol || t.asset?.symbol,
    usd: fmtUsd(t.usd),
    counterparty: t.label?.name || t.counterparty,
    counterparty_address: t.counterparty,
    date: date(t.blockTime),
  });

  return {
    address: w.address,
    chain: w.chain,
    transfer_count: w.transferCount ?? w.transfers?.length ?? null,
    peak_usd: fmtUsd(w.peakUsd ?? w.extrema?.high?.usd),
    floor_usd: fmtUsd(w.floorUsd ?? w.extrema?.low?.usd),
    temperature: w.temperature?.label
      ? { label: w.temperature.label, reason: w.temperature.reason }
      : null,
    top_inflows: (w.topIn || []).slice(0, 10).map(compactTx),
    top_outflows: (w.topOut || []).slice(0, 10).map(compactTx),
    top_swaps: (w.topSwap || []).slice(0, 10).map(compactTx),
    cluster_candidates: (w.clusterCandidates || []).slice(0, 5).map((c) => ({
      address: c.address,
      score: c.score,
      reason: c.reason,
    })),
    auto_trace_path: w.autoTrace?.path?.map((h) => ({
      address: h.address,
      label: h.label?.name || null,
      kind: h.label?.kind || null,
      amount: h.amount,
      symbol: h.symbol,
    })) || null,
  };
}

router.post('/explain', requireAi, async (req, res) => {
  const anthropic = getClient();
  if (!anthropic) {
    return res.status(503).json({ error: 'AI is not configured on the server (ANTHROPIC_API_KEY missing).' });
  }

  const summary = compactWalletSummary(req.body?.wallet);
  if (!summary || !summary.address) {
    return res.status(400).json({ error: 'Missing or invalid wallet payload.' });
  }

  // SSE plumbing. Disable proxy buffering so deltas arrive promptly; the
  // compression middleware in server/index.js already skips text/event-stream
  // responses (see filter below).
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const userTurn =
    `Wallet investigation context (JSON):\n\n` +
    '```json\n' +
    JSON.stringify(summary, null, 2) +
    '\n```\n\n' +
    `Analyze the wallet and produce the brief in the format described in your system instructions.`;

  let aborted = false;
  req.on('close', () => {
    aborted = true;
  });

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userTurn }],
    });

    stream.on('text', (delta) => {
      if (aborted) return;
      send({ type: 'delta', text: delta });
    });

    const finalMessage = await stream.finalMessage();
    if (!aborted) {
      send({
        type: 'done',
        stop_reason: finalMessage.stop_reason,
        usage: finalMessage.usage,
      });
      res.end();
    }
  } catch (err) {
    console.error('[ai] explain stream failed:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err?.message || 'AI request failed.' });
    }
    // Headers already streamed — best-effort error event then close.
    try {
      send({ type: 'error', error: err?.message || 'AI request failed.' });
    } catch {}
    res.end();
  }
});

export default router;
