import { fmtUsd, fmtAmount, shortAddr, fmtDate } from '../lib/format.js';
import { ArrowDown, ArrowUp, Swap } from './Icons.jsx';
import { kindMeta } from '../lib/labels.js';
import { AddressNoteChip } from './AddressNote.jsx';
import { ExplorerLink } from './ExplorerLink.jsx';
import { EnsChip } from './EnsName.jsx';

const LABELS = {
  in:   { title: 'Inflows',  accent: 'text-zen-green',  ring: 'ring-zen-green/20',  bg: 'bg-zen-green/10',  Icon: ArrowDown, sub: 'biggest deposits',   prefix: 'from ' },
  out:  { title: 'Outflows', accent: 'text-zen-red',    ring: 'ring-zen-red/20',    bg: 'bg-zen-red/10',    Icon: ArrowUp,   sub: 'biggest sends',      prefix: 'to ' },
  swap: { title: 'Swaps',    accent: 'text-zen-accent', ring: 'ring-zen-accent/20', bg: 'bg-zen-accent/10', Icon: Swap,      sub: 'biggest DEX trades', prefix: 'via ' },
};

export function TopTransactions({ direction, items, onSelect, selectedId, filtered = false, allMode = false }) {
  const cfg = LABELS[direction];
  const { Icon } = cfg;

  const subtitle = filtered ? 'matching filter' : allMode ? 'every transfer' : cfg.sub;
  const countChipText = filtered
    ? `${items.length} match${items.length === 1 ? '' : 'es'}`
    : allMode
      ? `All ${items.length}`
      : `Top ${items.length || 5}`;
  const countChipAccent = filtered || allMode;

  return (
    <div className="card p-4 fade-in flex flex-col h-full min-h-0">
      <div className="flex items-start justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bg} ${cfg.accent} ring-1 ${cfg.ring}`}>
            <Icon size={14} />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">{cfg.title}</h2>
            <p className="text-[11px] text-zen-muted">{subtitle}</p>
          </div>
        </div>
        <span className={`chip text-[10px] ${countChipAccent ? 'text-zen-accent ring-1 ring-zen-accent/40' : 'text-zen-muted'}`}>
          {countChipText}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="text-xs text-zen-muted py-8 text-center border border-dashed border-zen-border rounded-lg">
          None found
        </div>
      ) : (
        <ul className="divide-y divide-zen-border/60 overflow-y-auto flex-1 min-h-0 -mx-1 px-1">
          {items.map((t, i) => {
            const nodeId = `${direction}-${i}`;
            const isSelected = selectedId === nodeId;
            return (
              <li key={t.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(t)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(t); }
                  }}
                  className={`w-full text-left py-2.5 px-2 rounded-lg transition group cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-zen-accent/50
                    ${isSelected ? 'bg-zen-accent/10 ring-1 ring-inset ring-zen-accent/50' : 'hover:bg-[#16161b]/60'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-zen-muted text-[10px] w-4 mono">{String(i + 1).padStart(2, '0')}</span>
                      <div className="min-w-0">
                        <div className="font-medium truncate text-sm">
                          {fmtAmount(t.amount)} <span className="text-zen-muted">{t.asset.symbol}</span>
                        </div>
                        <div className="text-[10px] text-zen-muted truncate flex items-center gap-1.5">
                          <span>{cfg.prefix}</span>
                          {t.counterpartyLabel ? (
                            <>
                              <span className="text-zen-text font-medium">{t.counterpartyLabel.name}</span>
                              <CounterpartyKindBadge kind={t.counterpartyLabel.kind} />
                            </>
                          ) : (
                            <span className="mono">{shortAddr(t.counterparty)}</span>
                          )}
                          <EnsChip chain={t.chain} address={t.counterparty} />
                          <AddressNoteChip address={t.counterparty} chain={t.chain} compact />
                          <ExplorerLink chain={t.chain} kind="address" value={t.counterparty} />
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-semibold text-xs ${cfg.accent} group-hover:underline`}>
                        {t.usd != null && t.usd > 0 ? fmtUsd(t.usd) : '—'}
                      </div>
                      <div className="text-[9px] text-zen-muted mono">
                        {t.usd != null && t.usd > 0 ? fmtDate(t.blockTime).slice(0, 10) : 'unpriced'}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CounterpartyKindBadge({ kind }) {
  const meta = kindMeta(kind);
  return (
    <span
      className="text-[8px] uppercase tracking-wider px-1 py-px rounded mono"
      style={{
        background: `${meta.color}1f`,
        color: meta.color,
        border: `1px solid ${meta.color}55`,
      }}
    >
      {meta.short}
    </span>
  );
}
