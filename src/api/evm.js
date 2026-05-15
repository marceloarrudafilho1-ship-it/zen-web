// EVM chain adapter — works with any Etherscan-family v2 API.
// Etherscan v2 unified API: a single key covers Ethereum, Base, Arbitrum, Optimism, Polygon, etc.
// Docs: https://docs.etherscan.io/etherscan-v2

const V2_BASE = 'https://api.etherscan.io/v2/api';

export const EVM_CHAINS = {
  ethereum: { id: 1, name: 'Ethereum', symbol: 'ETH', coingeckoId: 'ethereum', platform: 'ethereum' },
  base: { id: 8453, name: 'Base', symbol: 'ETH', coingeckoId: 'ethereum', platform: 'base' },
  arbitrum: { id: 42161, name: 'Arbitrum', symbol: 'ETH', coingeckoId: 'ethereum', platform: 'arbitrum-one' },
  optimism: { id: 10, name: 'Optimism', symbol: 'ETH', coingeckoId: 'ethereum', platform: 'optimistic-ethereum' },
  polygon: { id: 137, name: 'Polygon', symbol: 'POL', coingeckoId: 'matic-network', platform: 'polygon-pos' },
  bsc: { id: 56, name: 'BNB Chain', symbol: 'BNB', coingeckoId: 'binancecoin', platform: 'binance-smart-chain' },
};

// Stablecoin contracts (lowercase) — hardcoded to $1 to skip rate-limited price lookups.
export const STABLECOINS = new Set([
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC ethereum
  '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT ethereum
  '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI ethereum
  '0xdc035d45d973e3ec169d2276ddab16f1e407384f', // USDS
  '0x4c9edd5852cd905f086c759e8383e09bff1e68b3', // USDe
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC base
  '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2', // USDT base
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb', // DAI base
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC arbitrum
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', // USDT arbitrum
  '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // USDC optimism
  '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', // USDT optimism
  '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // USDC polygon
  '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', // USDT polygon
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC bsc
  '0x55d398326f99059ff775485246999027b3197955', // USDT bsc
]);

// Known DEX router addresses (lowercase). Heuristic — not used as the *only* swap signal:
// pipeline.js also detects swaps by hash-grouping (any tx where the wallet sends one asset
// and receives another in the same hash is treated as a swap, regardless of router).
export const DEX_ROUTERS = new Set([
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2
  '0xe592427a0aece92de3edee1f18e0157c05861564', // Uniswap V3
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45', // Uniswap V3 (newer)
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad', // Universal Router V1
  '0x66a9893cc07d91d95644aedd05d03f95e1dba8af', // Universal Router V2 / V4
  '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f', // Sushiswap
  '0x1111111254eeb25477b68fb85ed929f73a960582', // 1inch v5
  '0x111111125421ca6dc452d289314280a0f8842a65', // 1inch v6
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x v3
  '0x0000000000001ff3684f28c67538d4d072c22734', // 0x v4
  '0xdef171fe48cf0115b1d80b88dc8eab59176fee57', // Paraswap v5
  '0x6131b5fae19ea4f9d964eac0408e4408b66337b5', // Kyber Meta
  '0xcf5540fffcdc3d510b18bfca6d2b9987b0772559', // Odos
  '0x9008d19f58aabd9ed0d60971565aa8510560ab41', // CowSwap
  '0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae', // LiFi diamond
  '0x6a000f20005980200259b80c5102003040001068', // Bebop
]);

export function looksLikeSwapInput(input) {
  if (!input || input === '0x') return false;
  // Heuristic: most swap function selectors share these prefixes
  const sel = input.slice(0, 10).toLowerCase();
  const swapSelectors = new Set([
    '0x38ed1739', // swapExactTokensForTokens
    '0x7ff36ab5', // swapExactETHForTokens
    '0x18cbafe5', // swapExactTokensForETH
    '0x8803dbee', // swapTokensForExactTokens
    '0xfb3bdb41', // swapETHForExactTokens
    '0x5c11d795', // swapExactTokensForTokensSupportingFee
    '0xb6f9de95', // swapExactETHForTokensSupportingFee
    '0x791ac947', // swapExactTokensForETHSupportingFee
    '0x414bf389', // exactInputSingle (V3)
    '0xc04b8d59', // exactInput (V3)
    '0x04e45aaf', // exactInputSingle (Universal)
    '0x3593564c', // execute (Universal Router)
  ]);
  return swapSelectors.has(sel);
}

async function call(params, apiKey) {
  const url = new URL(V2_BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('apikey', apiKey);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Etherscan HTTP ${res.status}`);
  const json = await res.json();
  if (json.status === '0' && json.message !== 'No transactions found') {
    if (json.result && typeof json.result === 'string' && json.result.includes('rate limit')) {
      throw new Error('Etherscan rate limit hit — slow down or upgrade your key tier.');
    }
    if (json.message === 'NOTOK') throw new Error(`Etherscan error: ${json.result}`);
  }
  return Array.isArray(json.result) ? json.result : [];
}

export async function fetchAllTransactions({ chainId, address, apiKey, onProgress }) {
  const lower = address.toLowerCase();
  const [normal, internal, erc20] = await Promise.all([
    fetchPaged({ action: 'txlist', chainid: chainId, address, apiKey, onProgress, label: 'normal' }),
    fetchPaged({ action: 'txlistinternal', chainid: chainId, address, apiKey, onProgress, label: 'internal' }),
    fetchPaged({ action: 'tokentx', chainid: chainId, address, apiKey, onProgress, label: 'erc20' }),
  ]);
  return { normal, internal, erc20, address: lower };
}

async function fetchPaged({ action, chainid, address, apiKey, onProgress, label }) {
  const PAGE_SIZE = 1000;
  const all = [];
  let page = 1;
  while (true) {
    const batch = await call({
      module: 'account',
      action,
      chainid,
      address,
      startblock: '0',
      endblock: '99999999',
      page: String(page),
      offset: String(PAGE_SIZE),
      sort: 'asc',
    }, apiKey);
    all.push(...batch);
    onProgress?.(`Fetched ${all.length} ${label} txs`);
    if (batch.length < PAGE_SIZE) break;
    page += 1;
    if (page > 20) break; // safety cap: 20k tx
  }
  return all;
}
