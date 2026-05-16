import { useState } from 'react';
import { searchSnusbase, searchLeakpeek } from '../api/breaches.js';
import { lookupIdentity } from '../api/web3bio.js';
import { shortAddr } from '../lib/format.js';
import {
  Search, Mail, User, Tag, Globe, Server, IdCard, Hash, Phone, Spinner, External,
} from './Icons.jsx';
import { useAuth } from './auth/AuthGate.jsx';

const TYPES = [
  { id: 'email',    label: 'Email',      Icon: Mail,   placeholder: 'name@domain.com' },
  { id: 'username', label: 'Username',   Icon: User,   placeholder: 'handle' },
  { id: 'keyword',  label: 'Keyword',    Icon: Tag,    placeholder: 'free-form term (wildcard)' },
  { id: 'domain',   label: 'Domain',     Icon: Globe,  placeholder: 'example.com' },
  { id: 'ip',       label: 'IP Address', Icon: Server, placeholder: '203.0.113.42' },
  { id: 'name',     label: 'Full Name',  Icon: IdCard, placeholder: 'Jane Doe' },
  { id: 'hash',     label: 'Hash',       Icon: Hash,   placeholder: 'md5/sha1/sha256…' },
  { id: 'phone',    label: 'Phone',      Icon: Phone,  placeholder: '+1 555 123 4567' },
];

export function InfoSearch({ keys }) {
  const { user } = useAuth();
  const [type, setType] = useState('email');
  const [term, setTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState({ snusbase: null, leakpeek: null });

  const activeType = TYPES.find(t => t.id === type);
  const hasAnyKey = keys.snusbase || keys.leakpeek;

  const submit = async (e) => {
    e.preventDefault();
    if (!term.trim() || busy) return;
    setBusy(true);
    setResults({ snusbase: null, leakpeek: null });

    const [snus, leak] = await Promise.allSettled([
      keys.snusbase
        ? searchSnusbase(type, term, keys.snusbase)
        : Promise.resolve(null),
      keys.leakpeek
        ? searchLeakpeek(type, term, keys.leakpeek)
        : Promise.resolve(null),
    ]);

    setResults({
      snusbase: snus.status === 'fulfilled' ? snus.value : { provider: 'snusbase', error: snus.reason?.message || String(snus.reason) },
      leakpeek: leak.status === 'fulfilled' ? leak.value : { provider: 'leakpeek', error: leak.reason?.message || String(leak.reason) },
    });
    setBusy(false);
  };

  return (
    <div className="space-y-5 fade-in">
      <UsefulLinks />

      <Web3BioLookup apiKey={keys.web3bio} />

      {user?.aiEnabled && <OsintDogSearch hasKey={!!keys.osintdog} />}

      <div className="card p-5">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-lg font-semibold">Investigation lookup</h2>
        </div>
        <p className="text-xs text-zen-muted mb-4">
          Searches Snusbase and LeakPeek breach indexes in parallel. Use this to correlate identities
          for stolen-fund tracing — match a wallet owner's email/username/IP across leaked datasets so
          recovery channels (exchange KYC, law enforcement) have something to act on.
        </p>

        {/* Type tabs */}
        <div className="flex flex-wrap gap-1.5 mb-4 p-1 bg-[#0d0d10]/60 rounded-lg border border-zen-border">
          {TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition
                ${type === t.id
                  ? 'bg-zen-panel text-zen-text shadow-[0_0_0_1px_rgb(var(--zen-accent-rgb)/0.4)]'
                  : 'text-zen-muted hover:text-zen-text hover:bg-zen-panel/50'}`}
            >
              <t.Icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex gap-2 items-stretch">
          <input
            value={term}
            onChange={e => setTerm(e.target.value)}
            placeholder={activeType.placeholder}
            className="input flex-1 h-10"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !term.trim() || !hasAnyKey}
            // Inverted / minimal: subtle accent-tinted surface with accent text
            // and a thin accent border. Hover deepens the tint; no heavy shadow.
            className="h-10 px-5 rounded-lg font-medium text-sm flex items-center gap-1.5 shrink-0
              bg-zen-accent/10 text-zen-accent ring-1 ring-zen-accent/40
              hover:bg-zen-accent/20 hover:ring-zen-accent/60
              transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? <><Spinner size={14} /> Searching…</> : <><Search size={14} /> Search</>}
          </button>
        </form>

        {!hasAnyKey && (
          <div className="mt-3 text-xs text-zen-red/80 border border-zen-red/30 bg-zen-red/5 rounded-md px-3 py-2">
            No breach API keys configured. Add a Snusbase or LeakPeek key in <span className="font-medium">Settings</span>.
          </div>
        )}

        <div className="mt-3 text-[11px] text-zen-muted leading-relaxed">
          <span className="font-medium text-zen-text">Note:</span> plaintext password fields are
          redacted in results. The <span className="mono">Password</span> search type is intentionally
          omitted — looking up someone else's leaked password has no fund-recovery use and crosses into
          unauthorized-access territory.
        </div>
      </div>

      {(results.snusbase || results.leakpeek) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ResultsCard name="Snusbase" data={results.snusbase} />
          <ResultsCard name="LeakPeek" data={results.leakpeek} />
        </div>
      )}
    </div>
  );
}

function ResultsCard({ name, data }) {
  if (!data) {
    return (
      <div className="card p-4 opacity-60">
        <div className="text-sm font-semibold mb-1">{name}</div>
        <div className="text-xs text-zen-muted">No API key configured.</div>
      </div>
    );
  }
  if (data.error) {
    return (
      <div className="card p-4 border-zen-red/40">
        <div className="text-sm font-semibold mb-1">{name}</div>
        <div className="text-xs text-zen-red mono break-all">{data.error}</div>
        {data.error.includes('Failed to fetch') && (
          <div className="text-[10px] text-zen-muted mt-2">
            Browser CORS likely blocking. Will work from the Electron build.
          </div>
        )}
      </div>
    );
  }
  if (!data.groups || data.groups.length === 0) {
    return (
      <div className="card p-4">
        <div className="flex items-baseline justify-between mb-1">
          <div className="text-sm font-semibold">{name}</div>
          <span className="chip text-zen-muted text-[10px]">0 hits</span>
        </div>
        <div className="text-xs text-zen-muted py-6 text-center">No breach matches.</div>
      </div>
    );
  }
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-sm font-semibold">{name}</div>
        <span className="chip text-zen-muted text-[10px]">
          {data.total} hits · {data.groups.length} {data.groups.length === 1 ? 'source' : 'sources'}
        </span>
      </div>
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {data.groups.map((g, i) => (
          <BreachGroup key={i} group={g} />
        ))}
      </div>
    </div>
  );
}

function BreachGroup({ group }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-zen-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[#0d0d10]/50 hover:bg-[#16161b]/50 transition"
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-zen-accent" />
          <span className="font-medium text-sm">{group.source}</span>
        </div>
        <span className="text-xs text-zen-muted mono">{group.count} {group.count === 1 ? 'row' : 'rows'}</span>
      </button>
      {open && (
        <div className="px-3 py-2 space-y-2 border-t border-zen-border">
          {group.rows.slice(0, 50).map((row, i) => (
            <BreachRow key={i} row={row} />
          ))}
          {group.rows.length > 50 && (
            <div className="text-[10px] text-zen-muted text-center py-1">
              {group.rows.length - 50} more rows hidden
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BreachRow({ row }) {
  const fields = Object.entries(row).filter(([, v]) => v != null && v !== '');
  if (fields.length === 0) return null;
  return (
    <div className="text-xs bg-[#0d0d10]/40 rounded px-2 py-1.5 space-y-0.5">
      {fields.map(([k, v]) => (
        <div key={k} className="flex gap-2 mono">
          <span className="text-zen-muted shrink-0 min-w-[80px]">{k}</span>
          <span className="break-all">{String(v)}</span>
        </div>
      ))}
    </div>
  );
}

// External OSINT tools the investigator may want to cross-reference. Plain
// <a target="_blank"> — Electron's setWindowOpenHandler routes these through
// shell.openExternal so they open in the user's default browser.
const USEFUL_LINKS = [
  { name: 'Cypher Dynamics', url: 'https://cypherdynamics.com', blurb: 'On-chain forensics & threat intel' },
  { name: 'Lol Archiver',    url: 'https://lolarchiver.com/',   blurb: 'League-of-Legends-era handle archive' },
];

function UsefulLinks() {
  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold">Useful tools</h2>
      <p className="text-xs text-zen-muted mt-1 mb-4">Third-party OSINT resources — opens in your browser.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {USEFUL_LINKS.map(link => (
          <a key={link.url}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg
              border border-zen-border bg-[#0d0d10]/60 hover:bg-zen-panel hover:border-zen-accent/40 transition">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{link.name}</div>
              <div className="text-[11px] text-zen-muted truncate">{link.blurb}</div>
            </div>
            <span className="text-zen-muted group-hover:text-zen-accent transition shrink-0">
              <External size={12} />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

// web3.bio cross-platform identity lookup. Given an ENS / wallet / Lens handle
// / Farcaster name, it returns every linked profile (platform, address, social
// links, email, avatar) the network knows about.
function Web3BioLookup({ apiKey }) {
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [profiles, setProfiles] = useState(null);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const v = handle.trim();
    if (!v || busy) return;
    setBusy(true);
    setError(null);
    setProfiles(null);
    try {
      const list = await lookupIdentity(v, apiKey);
      setProfiles(list);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold">Linked identities (web3.bio)</h2>
      <p className="text-xs text-zen-muted mt-1 mb-4">
        Resolve every social account, wallet, and email tied to one identity.
        Accepts ENS (<span className="mono">vitalik.eth</span>), wallet addresses,
        Lens / Farcaster handles, Basenames, and Unstoppable Domains.
      </p>

      <form onSubmit={submit} className="flex gap-2 items-stretch">
        <input
          value={handle}
          onChange={e => setHandle(e.target.value)}
          placeholder="vitalik.eth, 0x…, name.lens, @name.farcaster"
          className="input flex-1 h-10"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !handle.trim()}
          className="h-10 px-5 rounded-lg font-medium text-sm flex items-center gap-1.5 shrink-0
            bg-zen-accent/10 text-zen-accent ring-1 ring-zen-accent/40
            hover:bg-zen-accent/20 hover:ring-zen-accent/60
            transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? <><Spinner size={14} /> Looking up…</> : 'Resolve'}
        </button>
      </form>

      {error && (
        <div className="mt-3 text-xs text-zen-red border border-zen-red/30 bg-zen-red/5 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {profiles && profiles.length === 0 && !error && (
        <div className="mt-4 text-xs text-zen-muted py-6 text-center border border-dashed border-zen-border rounded-lg">
          No linked identities found.
        </div>
      )}

      {profiles && profiles.length > 0 && (
        <div className="mt-4 space-y-3">
          {profiles.map((p, i) => <Web3BioProfile key={`${p.platform}-${p.identity}-${i}`} profile={p} />)}
        </div>
      )}
    </div>
  );
}

const PLATFORM_TINT = {
  ens:                  '#5298ff',
  basenames:            '#0052ff',
  lens:                 '#34d399',
  farcaster:            '#8a63d2',
  sns:                  '#14f195',
  dotbit:               '#fbbf24',
  unstoppabledomains:   '#2962ef',
  ethereum:             '#94a3b8',
  solana:               '#9945ff',
  twitter:              '#e7e7ea',
  github:               '#e7e7ea',
};

function Web3BioProfile({ profile }) {
  const { platform, identity, displayName, address, avatar, description, email, location, links } = profile;
  const tint = PLATFORM_TINT[platform] || '#94a3b8';
  const linkEntries = links ? Object.entries(links).filter(([, v]) => v && v.link) : [];

  return (
    <div className="border border-zen-border rounded-lg overflow-hidden bg-[#0d0d10]/40">
      <div className="flex items-start gap-3 p-3">
        {avatar
          ? <img src={avatar} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 bg-zen-panel" referrerPolicy="no-referrer" />
          : <div className="w-12 h-12 rounded-lg shrink-0 flex items-center justify-center mono text-xs"
              style={{ background: `${tint}22`, color: tint }}>
              {(displayName || identity || '?').slice(0, 2).toUpperCase()}
            </div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{displayName || identity}</span>
            <span className="inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded mono"
              style={{ background: `${tint}1f`, color: tint, border: `1px solid ${tint}55` }}>
              {platform}
            </span>
          </div>
          {identity && identity !== displayName && (
            <div className="text-[11px] text-zen-muted mono truncate">{identity}</div>
          )}
          {address && (
            <div className="text-[11px] text-zen-muted mono truncate" title={address}>
              {shortAddr(address)}
            </div>
          )}
          {location && <div className="text-[11px] text-zen-muted mt-0.5">📍 {location}</div>}
          {description && <div className="text-xs text-zen-text/80 mt-1.5 leading-snug">{description}</div>}
        </div>
      </div>

      {(email || linkEntries.length > 0) && (
        <div className="border-t border-zen-border px-3 py-2 flex flex-wrap items-center gap-2 bg-[#0a0a0b]/40">
          {email && (
            <a href={`mailto:${email}`}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md
                border border-zen-border bg-zen-panel hover:border-zen-accent/40 transition mono">
              ✉ {email}
            </a>
          )}
          {linkEntries.map(([k, v]) => (
            <a key={k}
              href={v.link}
              target="_blank"
              rel="noreferrer"
              title={v.link}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md
                border border-zen-border bg-zen-panel hover:border-zen-accent/40 transition">
              <span className="text-zen-muted uppercase tracking-wider text-[9px]">{k}</span>
              <span className="mono truncate max-w-[140px]">{v.handle || v.link}</span>
              <External size={9} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// OSINT Dog universal search — premium-only. Hits POST /api/osintdog/search
// on our server, which forwards to https://osintdog.com/api/search using
// the user's stored OSINT Dog API key. Covers LeakCheck + HackCheck in
// one round-trip.
// ─────────────────────────────────────────────────────────────────────────

const OSINTDOG_TYPES = [
  { id: 'email',    label: 'Email',    Icon: Mail,   placeholder: 'name@domain.com' },
  { id: 'username', label: 'Username', Icon: User,   placeholder: 'handle' },
  { id: 'phone',    label: 'Phone',    Icon: Phone,  placeholder: '+1 555 123 4567' },
  { id: 'domain',   label: 'Domain',   Icon: Globe,  placeholder: 'example.com' },
  { id: 'ip',       label: 'IP',       Icon: Server, placeholder: '203.0.113.42' },
];

function OsintDogSearch({ hasKey }) {
  const [type, setType] = useState('email');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const active = OSINTDOG_TYPES.find(t => t.id === type);

  const submit = async (e) => {
    e.preventDefault();
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch('/api/osintdog/search', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, value: v }),
      });
      let data = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
      setResults(data?.response ?? data);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="text-lg font-semibold">OSINT Dog universal search</h2>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded mono
          bg-zen-accent/10 text-zen-accent border border-zen-accent/30">
          Premium
        </span>
      </div>
      <p className="text-xs text-zen-muted mb-4">
        Queries LeakCheck and HackCheck through OSINT Dog in one request. Configure your API key in
        <span className="text-zen-text font-medium"> Settings</span>.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4 p-1 bg-[#0d0d10]/60 rounded-lg border border-zen-border">
        {OSINTDOG_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition
              ${type === t.id
                ? 'bg-zen-panel text-zen-text shadow-[0_0_0_1px_rgb(var(--zen-accent-rgb)/0.4)]'
                : 'text-zen-muted hover:text-zen-text hover:bg-zen-panel/50'}`}
          >
            <t.Icon size={12} />
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex gap-2 items-stretch">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={active?.placeholder}
          className="input flex-1 h-10"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !value.trim() || !hasKey}
          className="h-10 px-5 rounded-lg font-medium text-sm flex items-center gap-1.5 shrink-0
            bg-zen-accent/10 text-zen-accent ring-1 ring-zen-accent/40
            hover:bg-zen-accent/20 hover:ring-zen-accent/60
            transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? <><Spinner size={14} /> Searching…</> : 'Search'}
        </button>
      </form>

      {!hasKey && (
        <div className="mt-3 text-xs text-amber-400 border border-amber-500/30 bg-amber-500/5 rounded-md px-3 py-2">
          Add your OSINT Dog API key in Settings to enable this search.
        </div>
      )}

      {error && (
        <div className="mt-3 text-xs text-zen-red border border-zen-red/30 bg-zen-red/5 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {results && <OsintDogResults data={results} />}
    </div>
  );
}

// Renders whatever OSINT Dog returned. The universal endpoint's exact
// response shape isn't documented field-by-field, so we walk through any
// arrays we recognise (`results`, `data`, etc.) and fall back to a raw
// JSON view for anything we don't.
function OsintDogResults({ data }) {
  // Friendly cases first
  if (Array.isArray(data?.results)) {
    return (
      <div className="mt-4 space-y-3">
        {data.results.map((group, i) => (
          <OsintDogGroup key={i} group={group} />
        ))}
      </div>
    );
  }
  if (Array.isArray(data)) {
    return (
      <div className="mt-4 space-y-3">
        {data.map((group, i) => (
          <OsintDogGroup key={i} group={group} />
        ))}
      </div>
    );
  }
  // Fallback: raw JSON, so nothing is hidden from the user
  return (
    <pre className="mt-4 text-[10px] text-zen-muted mono bg-[#0d0d10]/40 rounded p-3
      overflow-auto max-h-[480px] border border-zen-border">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function OsintDogGroup({ group }) {
  const [open, setOpen] = useState(false);
  const label = group?.service || group?.source || group?.name || 'Result';
  const count = group?.entries_count
    ?? (Array.isArray(group?.entries) ? group.entries.length : null)
    ?? (Array.isArray(group?.data) ? group.data.length : null);
  const entries = group?.entries || group?.data || [];

  return (
    <div className="border border-zen-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[#0d0d10]/50 hover:bg-[#16161b]/50 transition"
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-zen-accent" />
          <span className="font-medium text-sm">{label}</span>
        </div>
        {count != null && (
          <span className="text-xs text-zen-muted mono">{count} {count === 1 ? 'row' : 'rows'}</span>
        )}
      </button>
      {open && (
        <div className="px-3 py-2 space-y-2 border-t border-zen-border">
          {Array.isArray(entries) && entries.length > 0
            ? entries.slice(0, 50).map((row, i) => <BreachRow key={i} row={row} />)
            : <pre className="text-[10px] text-zen-muted mono">{JSON.stringify(group, null, 2)}</pre>}
          {Array.isArray(entries) && entries.length > 50 && (
            <div className="text-[10px] text-zen-muted text-center py-1">
              {entries.length - 50} more rows hidden
            </div>
          )}
        </div>
      )}
    </div>
  );
}
