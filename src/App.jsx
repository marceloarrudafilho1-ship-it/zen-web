import { useEffect, useMemo, useRef, useState } from 'react';
import { WalletInput } from './components/WalletInput.jsx';
import { WalletTabs } from './components/WalletTabs.jsx';
import { TopTransactions } from './components/TopTransactions.jsx';
import { BalanceChart } from './components/BalanceChart.jsx';
import { FlowPanel } from './components/FlowPanel.jsx';
import { SettingsModal } from './components/SettingsModal.jsx';
import { InfoSearch } from './components/InfoSearch.jsx';
import { ClusterSuggestions } from './components/ClusterSuggestions.jsx';
import { TransferFilters, EMPTY_FILTER, isFilterActive, applyFilter } from './components/TransferFilters.jsx';
import { Logo, Settings, Wallet, Info, Save, FolderOpen } from './components/Icons.jsx';
import { analyzeWallet, traceCounterpartyFlow } from './lib/pipeline.js';
import { subscribeNotes, getAllNotes, mergeNotes } from './lib/notes.js';
import { serializeCase, downloadCase, readCaseFile } from './lib/case-file.js';
import { useAuth } from './components/auth/AuthGate.jsx';
import { apiSaveKeys } from './api/auth.js';

const KEY_DEFAULTS = { etherscan: '', helius: '', coingecko: '', snusbase: '', leakpeek: '', web3bio: '' };

export default function App() {
  const { user, logout } = useAuth();
  // Keys live server-side under users.api_keys. We hydrate from the user
  // object returned by /api/auth/me, then mirror locally for instant edits;
  // persistKeys posts changes back so the next login (or another device) gets
  // the same set.
  const [keys, setKeys] = useState(() => ({ ...KEY_DEFAULTS, ...(user?.apiKeys || {}) }));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wallets, setWallets] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [selection, setSelection] = useState(null); // { kind: 'tx'|'wallet'|'extremum', id, tx?, point?, extremum? }
  const [showInputForNew, setShowInputForNew] = useState(false);
  const [view, setView] = useState('wallets'); // 'wallets' | 'info'
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [showAll, setShowAll] = useState(false);
  const [graphMode, setGraphMode] = useState('wallet'); // 'wallet' | 'network'
  const [notesTick, setNotesTick] = useState(0);

  useEffect(() => subscribeNotes(() => setNotesTick(t => t + 1)), []);

  // Network mode is only meaningful with 2+ ready wallets. If the user closes a
  // tab and we drop below that, fall back to per-wallet view so they aren't left
  // staring at a single isolated node with the toggle hidden.
  useEffect(() => {
    const ready = wallets.filter(w => w.status === 'done').length;
    if (ready < 2 && graphMode === 'network') setGraphMode('wallet');
  }, [wallets, graphMode]);

  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;
  const importInputRef = useRef(null);
  const [caseMessage, setCaseMessage] = useState(null);

  // Auto-dismiss the transient "Case saved / loaded" toast.
  useEffect(() => {
    if (!caseMessage) return;
    const t = setTimeout(() => setCaseMessage(null), 4000);
    return () => clearTimeout(t);
  }, [caseMessage]);

  const exportCase = () => {
    const snapshot = serializeCase({
      wallets, activeId, filter, showAll, graphMode,
      notes: getAllNotes(),
    });
    downloadCase(snapshot);
    setCaseMessage({ kind: 'ok', text: `Saved ${wallets.length} wallet${wallets.length === 1 ? '' : 's'} to .zen file` });
  };

  const triggerImport = () => importInputRef.current?.click();

  const importCase = async (file) => {
    try {
      const parsed = await readCaseFile(file);
      // Reset selection & transient view state; restore everything else.
      setWallets(parsed.wallets || []);
      setActiveId(parsed.activeId || (parsed.wallets?.[0]?.id ?? null));
      setSelection(null);
      setShowInputForNew(false);
      setFilter(parsed.filter || EMPTY_FILTER);
      setShowAll(!!parsed.showAll);
      setGraphMode(parsed.graphMode || 'wallet');
      const noteCount = mergeNotes(parsed.notes || {});
      setCaseMessage({
        kind: 'ok',
        text: `Loaded ${(parsed.wallets || []).length} wallet${(parsed.wallets || []).length === 1 ? '' : 's'}${noteCount ? ` and ${noteCount} note${noteCount === 1 ? '' : 's'}` : ''}`,
      });
    } catch (err) {
      console.error(err);
      setCaseMessage({ kind: 'err', text: `Couldn't open case: ${err.message || err}` });
    }
  };

  useEffect(() => {
    if (!keys.etherscan && !keys.helius) setSettingsOpen(true);
  }, []);

  // Optimistic: update local state immediately, then PUT to /api/auth/keys.
  // Caller stays sync — fire-and-forget the network round-trip and log if
  // it fails so the user sees their typing while the save propagates.
  const persistKeys = (next) => {
    setKeys(next);
    apiSaveKeys(next).catch(err => {
      console.error('Failed to save API keys to server:', err);
      setCaseMessage({ kind: 'err', text: `Couldn't save keys: ${err.message || err}` });
    });
  };

  const updateWallet = (id, patch) => {
    setWallets(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w));
  };

  const addAndAnalyze = async ({ chain, address }) => {
    const norm = address.trim();
    const existing = walletsRef.current.find(
      w => w.chain === chain && w.address.toLowerCase() === norm.toLowerCase()
    );
    if (existing) { setActiveId(existing.id); setShowInputForNew(false); return; }

    const id = `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const wallet = { id, chain, address: norm, status: 'loading', statusMsg: 'Queued…', result: null, error: null };
    setWallets(prev => [...prev, wallet]);
    setActiveId(id);
    setSelection(null);
    setShowInputForNew(false);

    try {
      const result = await analyzeWallet({
        chain, address: norm, keys,
        onProgress: (msg) => updateWallet(id, { statusMsg: msg }),
      });
      updateWallet(id, {
        status: 'done',
        statusMsg: `${result.transfers.length.toLocaleString()} transfers analyzed`,
        result,
      });
    } catch (err) {
      console.error(err);
      updateWallet(id, { status: 'error', error: err.message || String(err), statusMsg: '' });
    }
  };

  // Trace one hop further in either direction. Hops are keyed by
  // `${direction}:${counterparty}` so an investigator can trace BOTH the
  // inflows and outflows of the same counterparty independently — useful for
  // side-by-side "where did it come from" / "where did it go" views.
  const traceHop = async (walletId, counterparty, chain, direction = 'out') => {
    const w = walletsRef.current.find(x => x.id === walletId);
    if (!w) return;
    const key = `${direction}:${counterparty}`;
    const existing = w.hops?.[key];
    if (existing && existing.status !== 'error') return; // already in flight or done
    const seedHops = { ...(w.hops || {}), [key]: { status: 'loading', direction } };
    updateWallet(walletId, { hops: seedHops });
    try {
      const flows = await traceCounterpartyFlow({ chain, address: counterparty, direction, keys, limit: 5 });
      setWallets(prev => prev.map(x => x.id === walletId
        ? { ...x, hops: { ...(x.hops || {}), [key]: { status: 'done', direction, flows } } }
        : x));
    } catch (err) {
      console.error(err);
      setWallets(prev => prev.map(x => x.id === walletId
        ? { ...x, hops: { ...(x.hops || {}), [key]: { status: 'error', direction, error: err.message || String(err) } } }
        : x));
    }
  };

  // Auto-follow-the-money: chains traceCounterpartyFlow hops until a labelled
  // terminal address (exchange / mixer / bridge) is found or maxHops is reached.
  const autoTrace = async (walletId, startAddress, chain, maxHops = 5) => {
    const w = walletsRef.current.find(x => x.id === walletId);
    if (!w) return;
    if (w.autoTrace?.status === 'loading') return;

    const patch = (p) =>
      setWallets(prev => prev.map(x => x.id === walletId
        ? { ...x, autoTrace: { ...(x.autoTrace || {}), startAddress, ...p } }
        : x));

    patch({ status: 'loading', progress: 'Starting trace…', path: [], terminationReason: null, error: null });

    const path = [];
    let current = startAddress;

    for (let hop = 1; hop <= maxHops; hop++) {
      patch({ progress: `Tracing hop ${hop} of ${maxHops}…` });
      let flows;
      try {
        flows = await traceCounterpartyFlow({ chain, address: current, direction: 'out', keys, limit: 5 });
      } catch (err) {
        console.error(err);
        patch({ status: 'error', error: err.message || String(err), path });
        return;
      }
      if (!flows || flows.length === 0) {
        patch({ status: 'done', terminationReason: 'no-outflow', path });
        return;
      }
      const top = flows[0];
      path.push({ address: top.counterparty, label: top.label || null, amount: top.total, symbol: top.last?.asset?.symbol || '', count: top.count });
      const k = top.label?.kind;
      if (k === 'exchange' || k === 'mixer' || k === 'bridge') {
        patch({ status: 'done', terminationReason: 'labeled', path });
        return;
      }
      current = top.counterparty;
    }
    patch({ status: 'done', terminationReason: 'depth', path });
  };

  const closeWallet = (id) => {
    setWallets(prev => {
      const idx = prev.findIndex(w => w.id === id);
      const next = prev.filter(w => w.id !== id);
      if (id === activeId) {
        const fallback = next[Math.max(0, idx - 1)] || next[0] || null;
        setActiveId(fallback?.id || null);
        setSelection(null);
      }
      return next;
    });
  };

  // Map a clicked transfer (from any list) to the same node id used in the flow graph.
  const selectTx = (tx, walletData) => {
    const top = walletData.result.top;
    const findIn = (arr, dir) => {
      const i = arr.findIndex(t => t.id === tx.id);
      return i >= 0 ? `${dir}-${i}` : null;
    };
    const id = findIn(top.in, 'in') || findIn(top.out, 'out') || findIn(top.swap, 'swap');
    if (!id) return;
    setSelection({ kind: 'tx', id, tx });
  };

  const active = wallets.find(w => w.id === activeId) || null;
  const showHero = wallets.length === 0 && !showInputForNew;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zen-border/60 bg-zen-panel/40 backdrop-blur-md sticky top-0 z-40">
        {/* Three equal-flex columns: left logo, dead-center nav, right buttons.
            The center column ignores side widths so Wallets/Info sit at the
            exact horizontal middle of the viewport. */}
        <div className="w-full px-8 py-4 flex items-center gap-6">
          <div className="flex-1 flex justify-start">
            <button onClick={() => setSelection(null)} className="flex items-center gap-3 group shrink-0">
              <Logo size={28} />
              <div className="text-xl font-semibold tracking-tight group-hover:text-zen-accent transition">zen</div>
            </button>
          </div>

          <nav className="flex items-center gap-1 bg-[#0d0d10]/60 border border-zen-border rounded-lg p-1 shrink-0">
            <NavTab Icon={Wallet} label="Wallets" active={view === 'wallets'} onClick={() => setView('wallets')} />
            <NavTab Icon={Info}   label="Info"    active={view === 'info'}    onClick={() => setView('info')} />
          </nav>

          <div className="flex-1 flex items-center gap-2 justify-end">
            <button className="btn" onClick={triggerImport} title="Load investigation from a .zen case file">
              <FolderOpen size={14} /> Open
            </button>
            <button className="btn" onClick={exportCase}
              disabled={wallets.length === 0}
              title={wallets.length === 0 ? 'Nothing to save yet' : 'Save the current investigation as a .zen case file'}>
              <Save size={14} /> Save case
            </button>
            <button className="btn" onClick={() => setSettingsOpen(true)}>
              <Settings size={14} /> Settings
            </button>
            <div className="hidden md:flex items-center gap-2 pl-2 ml-1 border-l border-zen-border/60">
              <span className="text-xs text-zen-muted mono truncate max-w-[160px]" title={user?.username}>
                {user?.username}
              </span>
              <button className="btn !py-1 text-xs" onClick={logout} title="Log out">
                Log out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-8 py-8">
        {view === 'info' ? (
          <InfoSearch keys={keys} />
        ) : showHero ? (
          <Hero onAnalyze={addAndAnalyze} busy={false} />
        ) : (
          <div className="space-y-5">
            <WalletTabs
              wallets={wallets}
              activeId={activeId}
              onSelect={(id) => { setActiveId(id); setSelection(null); }}
              onClose={closeWallet}
              onAdd={() => setShowInputForNew(true)}
            />

            {showInputForNew && (
              <div className="card p-4 fade-in">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="text-sm font-medium">Add another wallet</div>
                  <button className="btn !py-1 text-xs" onClick={() => setShowInputForNew(false)}>Cancel</button>
                </div>
                <WalletInput onAnalyze={addAndAnalyze} busy={false} variant="compact" />
              </div>
            )}

            {active?.result && (
              <ClusterSuggestions
                wallet={active}
                openTabs={wallets}
                onOpen={(c) => addAndAnalyze({ chain: c.chain, address: c.address })}
              />
            )}

            {active && (
              <SplitLayout
                wallet={active}
                wallets={wallets}
                selection={selection}
                filter={filter}
                onChangeFilter={setFilter}
                showAll={showAll}
                onChangeShowAll={setShowAll}
                notesTick={notesTick}
                graphMode={graphMode}
                onChangeGraphMode={setGraphMode}
                onSelectTx={(tx) => selectTx(tx, active)}
                onSelectExtremum={(point) =>
                  setSelection({ kind: 'wallet', id: 'wallet', extremum: point === active.result?.extrema.high ? 'Highest' : 'Lowest' })
                }
                onSelectNode={setSelection}
                onTraceHop={(cp, direction) => traceHop(active.id, cp, active.chain, direction)}
                onAutoTrace={(cp) => autoTrace(active.id, cp, active.chain)}
                onOpenAddress={({ chain, address }) => addAndAnalyze({ chain, address })}
                onSwitchWallet={(id) => { setActiveId(id); setSelection(null); setGraphMode('wallet'); }}
              />
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-zen-border/60 mt-auto">
        <div className="w-full px-8 py-4 flex items-center justify-end text-xs text-zen-muted">
          <div className="mono">v0.1 · {wallets.length} {wallets.length === 1 ? 'wallet' : 'wallets'}</div>
        </div>
      </footer>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} keys={keys} onSave={persistKeys} />

      {/* Hidden picker — driven by the "Open" button. Allows .zen and .json
          because some users may rename the file before sending it. */}
      <input
        ref={importInputRef}
        type="file"
        accept=".zen,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importCase(file);
          e.target.value = ''; // allow re-picking the same file later
        }}
      />

      {caseMessage && (
        <div className={`fixed bottom-6 right-6 z-[60] card px-4 py-2.5 text-sm fade-in ring-1
          ${caseMessage.kind === 'err' ? 'border-zen-red/40 ring-zen-red/30 text-zen-red' : 'ring-zen-accent/30 text-zen-text'}`}>
          {caseMessage.text}
        </div>
      )}
    </div>
  );
}

function SplitLayout({
  wallet, wallets, selection,
  filter, onChangeFilter, showAll, onChangeShowAll, notesTick,
  graphMode, onChangeGraphMode,
  onSelectTx, onSelectExtremum, onSelectNode, onTraceHop,
  onAutoTrace, onOpenAddress, onSwitchWallet,
}) {
  const { status, statusMsg, error, result } = wallet;

  // Three list modes for the three TopTransactions cards:
  //   1. filter active     → cards show matches across ALL transfers (cap 500)
  //   2. showAll active    → cards show every transfer in that direction (cap 500)
  //   3. neither           → cards show the precomputed top-5 (default)
  // notesTick forces recompute when notes change so filter matches by note stay
  // fresh.
  const filterActive = isFilterActive(filter);

  const filteredItems = useMemo(() => {
    if (!result) return null;
    const matches = applyFilter(result.transfers, filter);
    if (!matches) return null;
    const byDir = (dir) => matches
      .filter(t => t.direction === dir)
      .sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0) || (b.amount - a.amount))
      .slice(0, 500);
    return { in: byDir('in'), out: byDir('out'), swap: byDir('swap'), total: matches.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, filter, notesTick]);

  const allItems = useMemo(() => {
    if (!result || !showAll || filterActive) return null;
    const byDir = (dir) => result.transfers
      .filter(t => t.direction === dir)
      .sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0) || (b.amount - a.amount))
      .slice(0, 500);
    return { in: byDir('in'), out: byDir('out'), swap: byDir('swap') };
  }, [result, showAll, filterActive]);

  const items = filterActive && filteredItems
    ? filteredItems
    : showAll && allItems
      ? allItems
      : result?.top;

  return (
    <div className="grid grid-cols-12 gap-5 items-start fade-in">
      {/* Left column — analytics; same fixed viewport height as the right column */}
      <div className="col-span-12 lg:col-span-6 flex flex-col gap-5 min-w-0 h-[640px] lg:h-[calc(100vh-7rem)]">
        {(status === 'loading' || statusMsg) && (
          <div className="flex items-center gap-2 text-sm text-zen-muted mono shrink-0">
            {status === 'loading' && <span className="inline-block w-2 h-2 rounded-full bg-zen-accent animate-pulse" />}
            {statusMsg}
          </div>
        )}

        {error && <div className="card border-zen-red/40 p-4 text-sm text-zen-red shrink-0">{error}</div>}

        {result && (
          <>
            <div className="flex-1 min-h-0">
              <BalanceChart
                series={result.series}
                extrema={result.extrema}
                onSelectExtremum={onSelectExtremum}
              />
            </div>

            <TransferFilters
              value={filter}
              onChange={onChangeFilter}
              showAll={showAll}
              onChangeShowAll={onChangeShowAll}
              totalTransfers={result.transfers.length}
              matchCount={filteredItems?.total || 0}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
              <TopTransactions
                direction="in"
                items={items?.in || []}
                selectedId={selection?.id}
                onSelect={onSelectTx}
                filtered={filterActive}
                allMode={!filterActive && showAll}
              />
              <TopTransactions
                direction="out"
                items={items?.out || []}
                selectedId={selection?.id}
                onSelect={onSelectTx}
                filtered={filterActive}
                allMode={!filterActive && showAll}
              />
              <TopTransactions
                direction="swap"
                items={items?.swap || []}
                selectedId={selection?.id}
                onSelect={onSelectTx}
                filtered={filterActive}
                allMode={!filterActive && showAll}
              />
            </div>
          </>
        )}
      </div>

      {/* Right column — flow chart pinned to viewport, matching left-column width */}
      <div className="col-span-12 lg:col-span-6">
        <div className="lg:sticky lg:top-24 h-[640px] lg:h-[calc(100vh-7rem)] flex flex-col">
          <FlowPanel
            wallet={wallet}
            wallets={wallets}
            selection={selection}
            onSelect={onSelectNode}
            onTraceHop={onTraceHop}
            onAutoTrace={onAutoTrace}
            onOpenAddress={onOpenAddress}
            graphMode={graphMode}
            onChangeGraphMode={onChangeGraphMode}
            onSwitchWallet={onSwitchWallet}
          />
        </div>
      </div>
    </div>
  );
}

function Hero({ onAnalyze, busy }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] fade-in">
      <h1 className="text-5xl font-semibold tracking-tight text-center mb-10">
        Inspect any wallet,
        <span className="block text-zen-accent">
          quietly and privately.
        </span>
      </h1>

      <WalletInput onAnalyze={onAnalyze} busy={busy} variant="hero" />
    </div>
  );
}

function NavTab({ Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition
        ${active
          ? 'bg-zen-panel text-zen-text shadow-[0_0_0_1px_rgb(var(--zen-accent-rgb)/0.4)]'
          : 'text-zen-muted hover:text-zen-text hover:bg-zen-panel/50'}`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

