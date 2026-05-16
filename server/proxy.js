// Premium-tier wallet-data proxy. Routes that sit behind requireAi so only
// users with ai_enabled=true (signed up with INVITE_CODE_PREMIUM) can hit
// them. Internally the proxy uses the operator's NOWNODES_API_KEY, so
// premium users get on-chain data without configuring any provider keys
// in their own settings.
//
// Currently supported chains: bitcoin, litecoin. Other chains return a
// 501 so the client knows to fall back to its own keys for now.

import { Router } from 'express';
import { requireAi } from './auth.js';
import {
  nowNodesConfigured,
  nowNodesSupports,
  fetchNowNodesUtxoTxs,
} from './nownodes.js';

const router = Router();

// Tells the client which chains the server can serve via NOWNodes. Used by
// the SPA to decide whether to call /api/proxy/... or fall back to a direct
// fetch. Public — knowing the supported chain list isn't sensitive.
router.get('/capabilities', (_req, res) => {
  if (!nowNodesConfigured()) {
    return res.json({ proxy_enabled: false, chains: [] });
  }
  return res.json({
    proxy_enabled: true,
    chains: ['bitcoin', 'litecoin'],
  });
});

// Address tx-history proxy. Premium-gated.
router.get('/wallet/:chain/:address', requireAi, async (req, res) => {
  const { chain, address } = req.params;

  if (!nowNodesConfigured()) {
    return res.status(503).json({
      error: 'Server-side wallet proxy is not configured (NOWNODES_API_KEY missing).',
    });
  }
  if (!nowNodesSupports(chain)) {
    return res.status(501).json({
      error: `Chain '${chain}' is not yet supported through the premium proxy — use your own keys for this chain.`,
    });
  }

  try {
    const transactions = await fetchNowNodesUtxoTxs(chain, address);
    return res.json({ provider: 'nownodes', chain, transactions });
  } catch (err) {
    console.error(`[proxy] ${chain} fetch failed:`, err);
    const msg = err.message || 'Proxy fetch failed';
    const status = msg.includes('Invalid') ? 400 : 502;
    return res.status(status).json({ error: msg });
  }
});

export default router;
