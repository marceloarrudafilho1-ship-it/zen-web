// Maps (chain, kind, value) → the canonical block-explorer URL. Electron's
// setWindowOpenHandler routes any <a target="_blank"> through shell.openExternal,
// so we don't need an IPC bridge — plain anchor tags pop the user's default
// browser to the right tx / address page.

const BASES = {
  ethereum: 'https://etherscan.io',
  base:     'https://basescan.org',
  arbitrum: 'https://arbiscan.io',
  optimism: 'https://optimistic.etherscan.io',
  polygon:  'https://polygonscan.com',
  bsc:      'https://bscscan.com',
  solana:   'https://solscan.io',
  xrp:      'https://xrpscan.com',
  litecoin: 'https://litecoinspace.org',
  bitcoin:  'https://mempool.space',
};

export function explorerUrl(chain, kind, value) {
  if (!value) return null;
  const base = BASES[chain];
  if (!base) return null;
  if (chain === 'solana') {
    // Solscan distinguishes account vs tx by path segment.
    return kind === 'tx'
      ? `${base}/tx/${value}`
      : `${base}/account/${value}`;
  }
  if (chain === 'xrp') {
    // XRPScan: /account/<addr> for wallets, /tx/<hash> for transactions.
    return kind === 'tx'
      ? `${base}/tx/${value}`
      : `${base}/account/${value}`;
  }
  // EVM family and litecoinspace.org both use /address/ and /tx/.
  return kind === 'tx'
    ? `${base}/tx/${value}`
    : `${base}/address/${value}`;
}

export function explorerName(chain) {
  switch (chain) {
    case 'ethereum': return 'Etherscan';
    case 'base':     return 'Basescan';
    case 'arbitrum': return 'Arbiscan';
    case 'optimism': return 'Optimistic Etherscan';
    case 'polygon':  return 'Polygonscan';
    case 'bsc':      return 'BscScan';
    case 'solana':   return 'Solscan';
    case 'xrp':      return 'XRPSCAN';
    case 'litecoin': return 'LitecoinSpace';
    case 'bitcoin':  return 'mempool.space';
    default:         return 'Explorer';
  }
}
