// Inline ENS/SNS name display. If the address has a resolved name cached,
// shows it as a small accent-tinted chip. Subscribes to the resolve tick so
// freshly-resolved names appear without needing the user to re-click.

import { useEffect, useState } from 'react';
import { getCachedName } from '../lib/ens.js';
import { subscribeNameTick } from '../lib/pipeline.js';

export function useEnsName(chain, address) {
  const [name, setName] = useState(() => getCachedName(chain, address));
  useEffect(() => {
    setName(getCachedName(chain, address));
    return subscribeNameTick(() => setName(getCachedName(chain, address)));
  }, [chain, address]);
  return name;
}

export function EnsChip({ chain, address }) {
  const name = useEnsName(chain, address);
  if (!name) return null;
  return (
    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded
      bg-zen-accent2/15 text-zen-accent2 ring-1 ring-zen-accent2/40 mono truncate max-w-[160px]"
      title={name}>
      {name}
    </span>
  );
}
