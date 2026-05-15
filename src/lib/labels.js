// Counterparty labels — turns hex blobs into "Binance" / "Tornado Cash" / "Stargate".
// Addresses are stored lowercase. Most CEXes reuse the same hot-wallet address across
// EVM chains, so a single chain-agnostic map covers the common cases. Solana addresses
// are case-sensitive base58 — kept in their canonical case in the SOLANA map.

const KIND = {
  exchange: { label: 'Exchange', color: '#fbbf24', short: 'CEX' },
  mixer:    { label: 'Mixer',    color: '#ef4444', short: 'MIX' },
  bridge:   { label: 'Bridge',   color: '#60a5fa', short: 'BRIDGE' },
  defi:     { label: 'DeFi',     color: '#a78bfa', short: 'DEFI' },
  service:  { label: 'Service',  color: '#94a3b8', short: 'SVC' },
};

export function kindMeta(kind) {
  return KIND[kind] || KIND.service;
}

// Curated set of well-known addresses. Sources: Etherscan public name-tags,
// Chainalysis sanctions disclosures, project documentation. Not exhaustive —
// stolen-funds tracing usually hits a major CEX/mixer in the first few hops.
const EVM = {
  // ── Centralized exchanges (hot wallets) ─────────────────────────────────
  '0x28c6c06298d514db089934071355e5743bf21d60': { name: 'Binance 14',       kind: 'exchange' },
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': { name: 'Binance 15',       kind: 'exchange' },
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': { name: 'Binance 16',       kind: 'exchange' },
  '0x56eddb7aa87536c09ccc2793473599fd21a8b17f': { name: 'Binance 17',       kind: 'exchange' },
  '0x9696f59e4d72e237be84ffd425dcad154bf96976': { name: 'Binance 18',       kind: 'exchange' },
  '0x4d9ff50ef4da947364bb9650892b2554e7be5e2b': { name: 'Binance 19',       kind: 'exchange' },
  '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8': { name: 'Binance 7',        kind: 'exchange' },
  '0xf977814e90da44bfa03b6295a0616a897441acec': { name: 'Binance 8',        kind: 'exchange' },
  '0x5a52e96bacdabb82fd05763e25335261b270efcb': { name: 'Binance 20',       kind: 'exchange' },
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': { name: 'Coinbase 1',       kind: 'exchange' },
  '0x503828976d22510aad0201ac7ec88293211d23da': { name: 'Coinbase 2',       kind: 'exchange' },
  '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740': { name: 'Coinbase 3',       kind: 'exchange' },
  '0x3cd751e6b0078be393132286c442345e5dc49699': { name: 'Coinbase 4',       kind: 'exchange' },
  '0xb5d85cbf7cb3ee0d56b3bb207d5fc4b82f43f511': { name: 'Coinbase 5',       kind: 'exchange' },
  '0xeb2629a2734e272bcc07bda959863f316f4bd4cf': { name: 'Coinbase 6',       kind: 'exchange' },
  '0xa090e606e30bd747d4e6245a1517ebe430f0057e': { name: 'Coinbase 7',       kind: 'exchange' },
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': { name: 'Coinbase 10',      kind: 'exchange' },
  '0x77696bb39917c91a0c3908d577d5e322095425ca': { name: 'Coinbase Prime',   kind: 'exchange' },
  '0x2faf487a4414fe77e2327f0bf4ae2a264a776ad2': { name: 'FTX',              kind: 'exchange' },
  '0xc098b2a3aa256d2140208c3de6543aaef5cd3a94': { name: 'FTX 2',            kind: 'exchange' },
  '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0': { name: 'Kraken 4',         kind: 'exchange' },
  '0xfa52274dd61e1643d2205169732f29114bc240b3': { name: 'Kraken 5',         kind: 'exchange' },
  '0xa83b11093c858c86321fbc4c20fe82cdbd58e09e': { name: 'Kraken 6',         kind: 'exchange' },
  '0xae2d4617c862309a3d75a0ffb358c7a5009c673f': { name: 'Kraken 10',        kind: 'exchange' },
  '0x6262998ced04146fa42253a5c0af90ca02dfd2a3': { name: 'Crypto.com',       kind: 'exchange' },
  '0x46340b20830761efd32832a74d7169b29feb9758': { name: 'Crypto.com 2',     kind: 'exchange' },
  '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b': { name: 'OKX',              kind: 'exchange' },
  '0x868dab0b8e21ec0a48b726a1ccf25f5a39ee2659': { name: 'OKX 2',            kind: 'exchange' },
  '0x236f9f97e0e62388479bf9e5ba4889e46b0273c3': { name: 'OKX 3',            kind: 'exchange' },
  '0xa7efae728d2936e78bda97dc267687568dd593f3': { name: 'OKX 4',            kind: 'exchange' },
  '0x2c2d8a078b33bf7782a16acce2c5ba6653a90d5f': { name: 'OKX 5',            kind: 'exchange' },
  '0xf89d7b9c864f589bbf53a82105107622b35eaa40': { name: 'Bybit',            kind: 'exchange' },
  '0xee5b5b923ffce93a870b3104b7ca09c3db80047a': { name: 'Bybit 2',          kind: 'exchange' },
  '0xf16e9b0d03470827a95cdfd0cb8a8a3b46969b91': { name: 'KuCoin 4',         kind: 'exchange' },
  '0xd6216fc19db775df9774a6e33526131da7d19a2c': { name: 'KuCoin 6',         kind: 'exchange' },
  '0x88bd4d3e2997371bceefe8d9386c6b5b4de60346': { name: 'KuCoin 7',         kind: 'exchange' },
  '0xab5c66752a9e8167967685f1450532fb96d5d24f': { name: 'Huobi',            kind: 'exchange' },
  '0x6748f50f686bfbca6fe8ad62b22228b87f31ff2b': { name: 'Huobi 26',         kind: 'exchange' },
  '0x1062a747393198f70f71ec65a582423dba7e5ab3': { name: 'HTX',              kind: 'exchange' },
  '0x1c4b70a3968436b9a0a9cf5205c787eb81bb558c': { name: 'Gate.io',          kind: 'exchange' },
  '0xc882b111a75c0c657fc507c04fbfcd2cc984f071': { name: 'Gate.io 2',        kind: 'exchange' },
  '0x9642b23ed1e01df1092b92641051881a322f5d4e': { name: 'Bitstamp',         kind: 'exchange' },
  '0x000000a991c429ee2c5b3a9e36cca6c4d24aa3fa': { name: 'MEXC',             kind: 'exchange' },
  '0x4982085c9e2f89f2ecb8131eca71afad896e89cb': { name: 'MEXC 2',           kind: 'exchange' },
  '0x77134cbc06cb00b66f4c7e623d5fdbf6777635ec': { name: 'Bitfinex',         kind: 'exchange' },
  '0x4f6742badb049791cd9a37ea913f2bac38d01279': { name: 'Bitfinex 11',      kind: 'exchange' },
  '0x59abf3837fa962d6853b4cc0a19513aa031fd32b': { name: 'Robinhood',        kind: 'exchange' },

  // ── Mixers / privacy pools ──────────────────────────────────────────────
  '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936': { name: 'Tornado Cash 0.1 ETH',  kind: 'mixer' },
  '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf': { name: 'Tornado Cash 1 ETH',    kind: 'mixer' },
  '0xa160cdab225685da1d56aa342ad8841c3b53f291': { name: 'Tornado Cash 100 ETH',  kind: 'mixer' },
  '0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3': { name: 'Tornado Cash 10 ETH',   kind: 'mixer' },
  '0x8589427373d6d84e98730d7795d8f6f8731fda16': { name: 'Tornado Cash router',   kind: 'mixer' },
  '0xfd8610d20aa15b7b2e3be39b396a1bc3516c7144': { name: 'Tornado Cash USDT',     kind: 'mixer' },
  '0xd96f2b1c14db8458374d9aca76e26c3d18364307': { name: 'Tornado Cash USDC',     kind: 'mixer' },
  '0xff8553f9e6f8a7d4f4f3a6bc5f0ea14624f9d9b9': { name: 'Tornado Cash DAI',      kind: 'mixer' },
  '0x722122df12d4e14e13ac3b6895a86e84145b6967': { name: 'Tornado Cash proxy',    kind: 'mixer' },
  '0xfc846f4a473e4d18d75ce06ab57bd8da6acdd935': { name: 'Railgun',               kind: 'mixer' },
  '0xfa7b9770ca4cb04296cac84f37736d4041251e88': { name: 'Railgun relay',         kind: 'mixer' },
  '0xf2e246bb76df876cef8b38ae84130f4f55de395b': { name: 'eXch (sanctioned)',     kind: 'mixer' },

  // ── Bridges ─────────────────────────────────────────────────────────────
  '0x8731d54e9d02c286767d56ac03e8037c07e01e98': { name: 'Stargate router',       kind: 'bridge' },
  '0x150f94b44927f078737562f0fcf3c95c01cc2376': { name: 'Stargate router v2',    kind: 'bridge' },
  '0x3ee18b2214aff97000d974cf647e7c347e8fa585': { name: 'Wormhole',              kind: 'bridge' },
  '0x98f3c9e6e3face36baad05fe09d375ef1464288b': { name: 'Wormhole core',         kind: 'bridge' },
  '0xc02fe7317d4eb8a1d98034e0d0f4d5f4f50fdaf6': { name: 'Across',                kind: 'bridge' },
  '0x5c7bcd6e7de5423a257d81b442095a1a6ced35c5': { name: 'Across spokepool',      kind: 'bridge' },
  '0xa6a147946facac9e0b99824870b36088764f969f': { name: 'Maker bridge',          kind: 'bridge' },
  '0x66a9893cc07d91d95644aedd05d03f95e1dba8af': { name: 'LayerZero exec',        kind: 'bridge' },
  '0x66a71dcef29a0ffbdbe3c6a460a3b5bc225cd675': { name: 'LayerZero relayer',     kind: 'bridge' },
  '0x6f4e8eba4d337f874ab57478acc2cb5bacdc19c9': { name: 'Synapse bridge',        kind: 'bridge' },
  '0x2796317b0ff8538f253012862c06787adfb8ceb6': { name: 'Synapse 2',             kind: 'bridge' },
  '0xb8901acb165ed027e32754e0ffe830802919727f': { name: 'Hop bridge ETH',        kind: 'bridge' },
  '0xb98454270065a31d71bf635f6f7ee6a518dfb849': { name: 'Hop bridge WBTC',       kind: 'bridge' },
  '0x3d4cc8a61c7528fd86c55cfe061a78dcba48edd1': { name: 'Hop bridge DAI',        kind: 'bridge' },
  '0x6b175474e89094c44da98b954eedeac495271d0f': { name: 'DAI Token',             kind: 'defi' },
  '0xd17b3c9784510e33cd5b87b490e79253bcd81e2e': { name: 'cBridge',               kind: 'bridge' },
  '0x5427fefa711eff984124bfbb1ab6fbf5e3da1820': { name: 'Celer cBridge v2',      kind: 'bridge' },
  '0x6c3ea9036406852006290770bedfcaba0e23a0e8': { name: 'PayPal USD',            kind: 'service' },
  '0x533a7b414cd1236815a5e09f1e97fc7d5c313739': { name: 'Multichain',            kind: 'bridge' },
  '0x88dcdc47d2f83a99cf0000fdf667a468bb958a78': { name: 'Multichain 2',          kind: 'bridge' },
  '0xa7e5d5a720f06526557c513402f2e6b5fa20b008': { name: 'Orbiter Finance',      kind: 'bridge' },
  '0x80c67432656d59144ceff962e8faf8926599bcf8': { name: 'Orbiter Finance 2',    kind: 'bridge' },
  '0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf': { name: 'Polygon PoS bridge',   kind: 'bridge' },
  '0xa0c68c638235ee32657e8f720a23cec1bfc77c77': { name: 'Polygon PoS bridge 2', kind: 'bridge' },
  '0x99c9fc46f92e8a1c0dec1b1747d010903e884be1': { name: 'Optimism gateway',     kind: 'bridge' },
  '0xcee7148028ff1b08163343794e85883174a61393': { name: 'Optimism gateway 2',   kind: 'bridge' },
  '0x4dbd4fc535ac27206064b68ffcf827b0a60bab3f': { name: 'Arbitrum bridge',      kind: 'bridge' },
  '0xa3a7b6f88361f48403514059f1f16c8e78d60eec': { name: 'Arbitrum gateway',     kind: 'bridge' },
  '0x32400084c286cf3e17e7b677ea9583e60a000324': { name: 'zkSync Era bridge',    kind: 'bridge' },
  '0x3154cf16ccdb4c6d922629664174b904d80f2c35': { name: 'Base bridge',          kind: 'bridge' },
  '0x49048044d57e1c92a77f79988d21fa8faf74e97e': { name: 'Base portal',          kind: 'bridge' },

  // ── Major DeFi (helps reduce noise — these aren't suspicious) ──────────
  '0xc36442b4a4522e871399cd717abdd847ab11fe88': { name: 'Uniswap V3 NFT',       kind: 'defi' },
  '0x000000000022d473030f116ddee9f6b43ac78ba3': { name: 'Permit2',              kind: 'defi' },
  '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9': { name: 'Aave V2 LendingPool',  kind: 'defi' },
  '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2': { name: 'Aave V3 Pool',         kind: 'defi' },
  '0xc3d688b66703497daa19211eedff47f25384cdc3': { name: 'Compound V3 USDC',     kind: 'defi' },
  '0x00000000219ab540356cbb839cbe05303d7705fa': { name: 'ETH 2 Deposit',        kind: 'service' },
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': { name: 'Lido stETH',           kind: 'defi' },
  '0xbe9895146f7af43049ca1c1ae358b0541ea49704': { name: 'Coinbase cbETH',       kind: 'defi' },
};

// Solana addresses (base58, case-sensitive). Far smaller curated list.
const SOLANA = {
  '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9': { name: 'Binance',          kind: 'exchange' },
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': { name: 'Binance 2',        kind: 'exchange' },
  '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S': { name: 'Coinbase',         kind: 'exchange' },
  'H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS': { name: 'Coinbase 2',       kind: 'exchange' },
  'FxteHmLwG9nk1eL4pjNve3Eub2goGkkz6g6TbvdmW46a': { name: 'Kraken',           kind: 'exchange' },
  'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE': { name: 'OKX',              kind: 'exchange' },
  '8fLrRCBsBgmsxYEN2zM1WXoBwpNPmTk2cNxaohBypbg2': { name: 'OKX 2',            kind: 'exchange' },
  'HVh6wHNBAsG3pq1Bj5oCzRjoWKVogEDHwUHkRz3ekFgt': { name: 'KuCoin',           kind: 'exchange' },
  '6QJzieMYfp7yr3EdrePaQoG3Ghxs2wM98xSLRu8Xh56U': { name: 'Bybit',            kind: 'exchange' },
  '3yFwqXBfZY4jBVUafQ1YEXw189y2dN3V5KQq9uzBWy7E': { name: 'Wormhole',         kind: 'bridge' },
  'wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb': { name: 'Wormhole token',    kind: 'bridge' },
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': { name: 'Jupiter',           kind: 'defi' },
};

export function labelFor(address, chain) {
  if (!address) return null;
  if (chain === 'solana') {
    return SOLANA[address] || null;
  }
  const key = String(address).toLowerCase();
  return EVM[key] || null;
}

// Returns true if this counterparty is a flagged risk surface (mixer / sanctioned).
export function isSuspicious(address, chain) {
  const l = labelFor(address, chain);
  return l?.kind === 'mixer';
}
