// Related-address detection. Walks all transfers on a wallet and surfaces
// counterparties that look like personal wallets (not exchange / mixer / bridge
// hot wallets) the investigator might want to open as new tabs.
//
// Heuristic: a counterparty is a "related-address candidate" if
//   - it's not a labeled service (CEX / mixer / bridge / DeFi)
//   - it's not the zero address or a contract creation (no `0x000...`)
//   - the wallet has either ≥3 transfers with it, OR ≥$500 cumulative bidirectional flow
//
// Returns ranked list of { address, txCount, totalUsd, lastSeen, sampleSymbol, lastDirection }.

const NULL_ADDR = '0x0000000000000000000000000000000000000000';

export function detectClusterCandidates(transfers) {
  if (!transfers || transfers.length === 0) return [];

  const groups = new Map();
  for (const t of transfers) {
    const cp = t.counterparty;
    if (!cp || cp === NULL_ADDR || cp === 'native' || cp === 'DEX') continue;
    if (t.counterpartyLabel) continue; // skip exchanges, mixers, bridges, named DeFi

    if (!groups.has(cp)) {
      groups.set(cp, {
        address: cp,
        chain: t.chain,
        txCount: 0,
        totalUsd: 0,
        inCount: 0, outCount: 0, swapCount: 0,
        lastSeen: 0,
        sampleSymbol: t.asset.symbol,
        lastDirection: t.direction,
      });
    }
    const g = groups.get(cp);
    g.txCount += 1;
    g.totalUsd += t.usd || 0;
    if (t.direction === 'in')   g.inCount += 1;
    if (t.direction === 'out')  g.outCount += 1;
    if (t.direction === 'swap') g.swapCount += 1;
    if (t.blockTime > g.lastSeen) {
      g.lastSeen = t.blockTime;
      g.lastDirection = t.direction;
      g.sampleSymbol = t.asset.symbol;
    }
  }

  return [...groups.values()]
    .filter(g => g.txCount >= 3 || g.totalUsd >= 500)
    .sort((a, b) => (b.totalUsd - a.totalUsd) || (b.txCount - a.txCount));
}
