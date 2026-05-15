// Tiny ↗ button that opens the address/tx in the chain's block explorer. Uses
// a plain <a target="_blank"> which Electron's setWindowOpenHandler routes to
// the user's default browser via shell.openExternal.

import { explorerUrl, explorerName } from '../lib/explorers.js';
import { External } from './Icons.jsx';

export function ExplorerLink({ chain, kind = 'address', value, size = 11, className = '' }) {
  const url = explorerUrl(chain, kind, value);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Open in ${explorerName(chain)}`}
      className={`inline-flex items-center justify-center w-5 h-5 rounded
        text-zen-muted hover:text-zen-accent hover:bg-zen-accent/10 transition shrink-0 ${className}`}
    >
      <External size={size} />
    </a>
  );
}
