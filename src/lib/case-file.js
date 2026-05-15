// .zen case file — full snapshot of an open investigation. Excludes API keys
// (those live in localStorage and are user/machine-specific) but includes
// everything else the investigator built up: tabs, fetched results, traced
// hops, address notes, dismissed-cluster choices, and the current view mode.
//
// Format v1 shape:
//
//   {
//     version: 1,
//     exportedAt: ISO date,
//     appVersion: "0.1",
//     activeId: walletId | null,
//     wallets: [
//       { id, chain, address, status, statusMsg, result, hops, error }
//     ],
//     filter: { ...EMPTY_FILTER },
//     showAll: bool,
//     graphMode: 'wallet' | 'network',
//     notes: { 'chain:addr': 'note text', ... },  // snapshot at export time
//   }
//
// Importing replaces the in-memory wallet/filter state and MERGES notes into
// localStorage (case-file notes override existing keys on collision).

import { EMPTY_FILTER } from '../components/TransferFilters.jsx';

export const CASE_FILE_VERSION = 1;
export const CASE_FILE_EXT = '.zen';
export const CASE_FILE_MIME = 'application/json';

export function serializeCase({ wallets, activeId, filter, showAll, graphMode, notes }) {
  return {
    version: CASE_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: '0.1',
    activeId: activeId || null,
    // Strip transient UI / unbounded refs while preserving the heavy result data.
    wallets: (wallets || []).map(w => ({
      id: w.id,
      chain: w.chain,
      address: w.address,
      status: w.status,
      statusMsg: w.statusMsg || '',
      error: w.error || null,
      result: w.result || null,
      hops: w.hops || {},
    })),
    filter: filter || EMPTY_FILTER,
    showAll: !!showAll,
    graphMode: graphMode || 'wallet',
    notes: notes || {},
  };
}

export function validateCase(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Not a Zen case file');
  if (obj.version !== CASE_FILE_VERSION) {
    throw new Error(`Unsupported case file version: ${obj.version} (expected ${CASE_FILE_VERSION})`);
  }
  if (!Array.isArray(obj.wallets)) throw new Error('Case file is missing the wallets list');
  return obj;
}

// Trigger a browser download via blob URL — works in Electron's sandboxed
// renderer because we never touch the filesystem directly. The user picks the
// save location through the browser's save dialog.
export function downloadCase(caseObj, suggestedName) {
  const filename = suggestedName || defaultFilename(caseObj);
  const json = JSON.stringify(caseObj, null, 2);
  const blob = new Blob([json], { type: CASE_FILE_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

function defaultFilename(caseObj) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const count = caseObj.wallets?.length || 0;
  return `zen-case-${dateStr}-${count}wallet${count === 1 ? '' : 's'}${CASE_FILE_EXT}`;
}

// Reads a File (from <input type="file">) and parses + validates as a case.
export async function readCaseFile(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('File is not valid JSON');
  }
  return validateCase(parsed);
}
