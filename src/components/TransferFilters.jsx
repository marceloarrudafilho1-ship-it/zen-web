// Pill-based transfer filter. Replaces the old text input with toggleable
// chips grouped by category — investigators tick the filters they want and
// every active pill ANDs together. Empty group = no constraint on that axis.
//
// Filter shape:
//   {
//     directions: Set('in' | 'out' | 'swap'),
//     types:      Set('exchange' | 'mixer' | 'bridge' | 'defi' | 'service' | 'unlabeled'),
//     amounts:    Set('xl' | 'l' | 's' | 'unpriced'),
//     timeWindow: '7d' | '30d' | '90d' | 'all',
//     hasNote:    boolean,
//   }
//
// Sets are stored as arrays in state (so plain JSON works) and checked via
// `.includes`. Performance is fine — at most 6 entries per array.

import { kindMeta } from '../lib/labels.js';
import { getNote } from '../lib/notes.js';

export const EMPTY_FILTER = {
  directions: [],
  types: [],
  amounts: [],
  timeWindow: 'all',
  hasNote: false,
};

const DAY = 86400;

export function isFilterActive(f) {
  if (!f) return false;
  return (
    (f.directions?.length || 0) > 0 ||
    (f.types?.length || 0) > 0 ||
    (f.amounts?.length || 0) > 0 ||
    (f.timeWindow && f.timeWindow !== 'all') ||
    !!f.hasNote
  );
}

export function applyFilter(transfers, filter) {
  if (!isFilterActive(filter)) return null;

  const dirSet  = new Set(filter.directions || []);
  const typeSet = new Set(filter.types || []);
  const amtSet  = new Set(filter.amounts || []);
  const cutoff  = filter.timeWindow && filter.timeWindow !== 'all'
    ? Math.floor(Date.now() / 1000) - DAYS[filter.timeWindow] * DAY
    : null;

  return transfers.filter(t => {
    if (dirSet.size > 0 && !dirSet.has(t.direction)) return false;
    if (typeSet.size > 0) {
      const k = t.counterpartyLabel?.kind || 'unlabeled';
      if (!typeSet.has(k)) return false;
    }
    if (amtSet.size > 0) {
      const band = bandFor(t.usd);
      if (!amtSet.has(band)) return false;
    }
    if (cutoff != null && t.blockTime < cutoff) return false;
    if (filter.hasNote) {
      const n = getNote(t.counterparty, t.chain);
      if (!n) return false;
    }
    return true;
  });
}

const DAYS = { '7d': 7, '30d': 30, '90d': 90 };

function bandFor(usd) {
  if (usd == null || usd <= 0) return 'unpriced';
  if (usd > 10000) return 'xl';
  if (usd >= 1000) return 'l';
  return 's';
}

const DIRECTION_OPTS = [
  { id: 'in',   label: 'In',   color: '#4ade80' },
  { id: 'out',  label: 'Out',  color: '#f87171' },
  // Swap uses the theme's secondary accent (resolved via CSS var at paint time).
  { id: 'swap', label: 'Swap', color: 'rgb(var(--zen-accent2-rgb))' },
];

const TYPE_OPTS = [
  { id: 'exchange',  label: 'Exchange'  },
  { id: 'mixer',     label: 'Mixer'     },
  { id: 'bridge',    label: 'Bridge'    },
  { id: 'defi',      label: 'DeFi'      },
  { id: 'service',   label: 'Service'   },
  { id: 'unlabeled', label: 'Unlabeled' },
];

const AMOUNT_OPTS = [
  { id: 'xl',       label: '> $10K' },
  { id: 'l',        label: '$1K – $10K' },
  { id: 's',        label: '< $1K' },
  { id: 'unpriced', label: 'Unpriced' },
];

const TIME_OPTS = [
  { id: '7d',  label: '7d'  },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'all', label: 'All' },
];

export function TransferFilters({
  value, onChange, totalTransfers, matchCount,
  showAll = false, onChangeShowAll,
}) {
  const active = isFilterActive(value);

  const toggleArr = (key, id) => {
    const cur = value[key] || [];
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
    onChange({ ...value, [key]: next });
  };
  const setVal = (key, v) => onChange({ ...value, [key]: v });

  return (
    <div className={`card px-3 py-2.5 transition ${active ? 'ring-1 ring-zen-accent/40' : ''}`}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <Group label="Direction">
          {DIRECTION_OPTS.map(opt => (
            <Pill key={opt.id}
              active={value.directions?.includes(opt.id)}
              color={opt.color}
              onClick={() => toggleArr('directions', opt.id)}>
              {opt.label}
            </Pill>
          ))}
        </Group>

        <Group label="Type">
          {TYPE_OPTS.map(opt => {
            const meta = opt.id === 'unlabeled' ? null : kindMeta(opt.id);
            return (
              <Pill key={opt.id}
                active={value.types?.includes(opt.id)}
                color={meta?.color}
                onClick={() => toggleArr('types', opt.id)}>
                {opt.label}
              </Pill>
            );
          })}
        </Group>

        <Group label="Amount">
          {AMOUNT_OPTS.map(opt => (
            <Pill key={opt.id}
              active={value.amounts?.includes(opt.id)}
              onClick={() => toggleArr('amounts', opt.id)}>
              {opt.label}
            </Pill>
          ))}
        </Group>

        <Group label="Time">
          {TIME_OPTS.map(opt => (
            <Pill key={opt.id}
              active={value.timeWindow === opt.id}
              onClick={() => setVal('timeWindow', opt.id)}>
              {opt.label}
            </Pill>
          ))}
        </Group>

        <Group label="Notes">
          <Pill
            active={!!value.hasNote}
            onClick={() => setVal('hasNote', !value.hasNote)}>
            Tagged only
          </Pill>
        </Group>

        {onChangeShowAll && (
          <Group label="Show">
            <Pill active={!showAll} onClick={() => onChangeShowAll(false)}>Top 5</Pill>
            <Pill active={showAll}  onClick={() => onChangeShowAll(true)}>All</Pill>
          </Group>
        )}

        <div className="ml-auto flex items-center gap-2 self-center">
          {active && (
            <>
              <span className="text-[11px] text-zen-muted mono">
                {matchCount} / {totalTransfers}
              </span>
              <button onClick={() => onChange(EMPTY_FILTER)}
                className="text-[11px] px-2 py-1 rounded text-zen-muted hover:text-zen-text hover:bg-zen-panel transition">
                Clear
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[9px] uppercase tracking-wider text-zen-muted mr-1 select-none">
        {label}
      </span>
      {children}
    </div>
  );
}

function Pill({ active, color, onClick, children }) {
  // Use an inline style for the accent color when provided so each direction
  // pill (in/out/swap) reads in its own semantic color, and label-kind pills
  // get the same hue used elsewhere in the UI. color-mix lets us alpha-blend
  // either hex strings or theme-tied `rgb(var(--…))` values without bespoke parsing.
  const tint = color || 'rgb(var(--zen-accent-rgb))';
  return (
    <button
      onClick={onClick}
      className={`text-[11px] px-2 py-0.5 rounded-md transition border
        ${active
          ? 'text-zen-text font-medium'
          : 'text-zen-muted hover:text-zen-text border-zen-border bg-zen-panel/40 hover:bg-zen-panel'}`}
      style={active
        ? {
            background: `color-mix(in srgb, ${tint} 15%, transparent)`,
            borderColor: `color-mix(in srgb, ${tint} 53%, transparent)`,
            color: '#e7e7ea',
          }
        : undefined}
    >
      {children}
    </button>
  );
}
