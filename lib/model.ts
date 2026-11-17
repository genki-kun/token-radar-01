// The token radar's model (radar-2): one snapshot of the protocol universe in, one ranked board out.
//
// THE VALUE MODEL. The starter's flat 0.25 x TVL multiple is replaced by a multiple the snapshot
// itself teaches. Every protocol that already records a token is a peer: its market cap divided by
// its TVL is what the market actually paid for a dollar of TVL in a protocol like it. The model
// learns one multiple per category from those peers and applies it to the pre-token protocols:
//
//   ratio_i    = clamp(mcap_usd / tvl_usd, 0.02, 5)          for each tokenized peer with both
//   multiple_c = clamp( (n_c x median_c + 6 x median_all) / (n_c + 6), 0.05, 2.5 )
//   base       = tvl_usd x multiple_c
//   momentum   = 1 + clamp(change_7d, -50, 60) / 100 x 0.35   (unreported change counts as 0)
//   maturity   = 0.78 + 0.32 x min(age_days, 1460) / 1460     (age unknown: the pre-token median)
//   breadth    = 1 + 0.025 x min(chains - 1, 8)
//   implied    = max(1, round(base x momentum x maturity x breadth))
//
// The shrinkage (the +6 x median_all term) is the honest part: a category with one wild peer (a
// prediction market at 400 x TVL) must not price its pre-token cousins at that multiple, so small
// samples are pulled toward the whole market's median (about 0.22 x on this snapshot) and every
// multiple is clamped to a stated band. No protocol name is ever special-cased: one function
// scores every row, and the dashboard shows each row's own arithmetic.
//
// THE BOARD. Every protocol that records no token (gecko_id and symbol both null) is ranked: all
// 342 on this snapshot, the 40 watchlist protocols among them. Protocols whose token already
// trades are never ranked; they are the peer set the multiples are learned from and are shown
// apart, at the market's own values. Rows the house watchlist leaves out for its own reasons
// (an exchange, a versioned name, a wrapped-product category) carry a caution that says why.
//
// LAUNCH BASE RATE. Beside the implied value the model reports, per category, the share of its
// protocols that already record a token (shrunk the same way). It is a base rate from the
// snapshot, not a prediction; the dashboard's priority sort multiplies the two so a reader can
// weigh a huge hypothetical against how often its category launches at all.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  ratio_floor: number;
  ratio_cap: number;
  shrink_k: number;
  multiple_floor: number;
  multiple_cap: number;
  momentum_weight: number;
  momentum_floor: number;
  momentum_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  breadth_per_chain: number;
  breadth_max_extra: number;
  base_rate_shrink: number;
}

export const MODEL: ModelConstants = {
  ratio_floor: 0.02,
  ratio_cap: 5,
  shrink_k: 6,
  multiple_floor: 0.05,
  multiple_cap: 2.5,
  momentum_weight: 0.35,
  momentum_floor: -50,
  momentum_cap: 60,
  maturity_floor: 0.78,
  maturity_range: 0.32,
  maturity_days: 1460,
  breadth_per_chain: 0.025,
  breadth_max_extra: 8,
  base_rate_shrink: 2,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** What the model learned about one category from the snapshot. */
export interface CategoryStats {
  category: string;
  protocols: number;
  pre_token: number;
  tokenized: number;
  peers: number;
  median_ratio: number | null;
  multiple: number;
  tokenized_share: number;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The money shape of one farm plan, for the dashboard's summary chips. */
export interface FarmSummary {
  capital_usd: number;
  setup_cost_usd: number;
  weekly_cost_usd: number;
  weeks: number;
  total_cost_usd: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  on_watchlist: boolean;
  caution: string | null;
  age_days: number | null;
  implied_value_usd: number;
  priority_usd: number;
  launch_base_rate: number;
  model: {
    category_multiple: number;
    category_peers: number;
    category_median_ratio: number | null;
    base_usd: number;
    momentum_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
  };
  farm: FarmSummary;
  farm_steps: string[];
}

/** The dashboard's view of one board row: the board row's figures, its breakdown and its plan. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  on_watchlist: boolean;
  caution: string | null;
  implied_value_usd: number;
  priority_usd: number;
  launch_base_rate: number;
  model: BoardRow['model'];
  farm: FarmSummary;
  farm_steps: FarmStep[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  symbol: string | null;
}

/** Everything the dashboard needs: the board, the live set, the category evidence and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  global_median_ratio: number;
  peer_count: number;
  imputed_age_days: number;
  protocols_size: number;
  pre_token_size: number;
  tokenized_size: number;
  watchlist_size: number;
  board_size: number;
  categories: CategoryStats[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The median of a non-empty list, or null. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all: the snapshot's own test, both identifiers null. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

const categoryOf = (p: SnapshotProtocol): string => p.category ?? 'Uncategorized';

/**
 * What the snapshot teaches, per category: the peer multiple (winsorized ratios, median, shrunk
 * toward the global median by sample size) and the launch base rate (tokenized share, shrunk
 * toward the global share). Computed once per snapshot, used for every row alike.
 */
export function categoryStats(snapshot: Snapshot, model: ModelConstants = MODEL): { stats: Map<string, CategoryStats>; globalMedian: number; peerCount: number } {
  const peers = snapshot.protocols.filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const globalMedian = median(peers.map((p) => clamp(p.mcap_usd! / p.tvl_usd, model.ratio_floor, model.ratio_cap))) ?? 0.25;
  const globalShare = snapshot.protocols.length === 0 ? 0 : snapshot.protocols.filter((p) => !isPreToken(p)).length / snapshot.protocols.length;
  const groups = new Map<string, SnapshotProtocol[]>();
  for (const p of snapshot.protocols) {
    const key = categoryOf(p);
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }
  const stats = new Map<string, CategoryStats>();
  for (const [category, list] of groups) {
    const catPeers = list.filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
    const med = median(catPeers.map((p) => clamp(p.mcap_usd! / p.tvl_usd, model.ratio_floor, model.ratio_cap)));
    const n = catPeers.length;
    const multiple = clamp((n * (med ?? globalMedian) + model.shrink_k * globalMedian) / (n + model.shrink_k), model.multiple_floor, model.multiple_cap);
    const tokenized = list.filter((p) => !isPreToken(p)).length;
    const share = (tokenized + model.base_rate_shrink * globalShare) / (list.length + model.base_rate_shrink);
    stats.set(category, {
      category,
      protocols: list.length,
      pre_token: list.length - tokenized,
      tokenized,
      peers: n,
      median_ratio: med === null ? null : round4(med),
      multiple: round4(multiple),
      tokenized_share: round4(share),
    });
  }
  return { stats, globalMedian, peerCount: peers.length };
}

/** The age the model imputes where DefiLlama reports none: the median known age of the pre-token set. */
export function imputedAge(snapshot: Snapshot): number {
  const ages = snapshot.protocols.filter(isPreToken).map((p) => ageDays(snapshot.as_of, p.listed_at)).filter((a): a is number => a !== null);
  return Math.round(median(ages) ?? 365);
}

/** One protocol scored: every factor the dashboard shows, and the implied value they multiply to. */
export interface Scored {
  implied: number;
  priority: number;
  baseRate: number;
  age: number | null;
  breakdown: BoardRow['model'];
}

export function score(p: SnapshotProtocol, snapshot: Snapshot, stats: CategoryStats, imputed: number, model: ModelConstants = MODEL): Scored {
  const age = ageDays(snapshot.as_of, p.listed_at);
  const multiple = stats.multiple;
  const base = p.tvl_usd * multiple;
  const growthPct = clamp(finite(p.change_7d, 0), model.momentum_floor, model.momentum_cap);
  const momentumMult = 1 + (growthPct / 100) * model.momentum_weight;
  const ageForModel = age ?? imputed;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const breadthMult = 1 + model.breadth_per_chain * Math.min(Math.max(p.chains.length - 1, 0), model.breadth_max_extra);
  const implied = Math.max(1, Math.round(base * momentumMult * maturityMult * breadthMult));
  return {
    implied,
    priority: Math.max(1, Math.round(implied * stats.tokenized_share)),
    baseRate: stats.tokenized_share,
    age,
    breakdown: {
      category_multiple: multiple,
      category_peers: stats.peers,
      category_median_ratio: stats.median_ratio,
      base_usd: Math.round(base),
      momentum_multiplier: round4(momentumMult),
      maturity_multiplier: round4(maturityMult),
      breadth_multiplier: round4(breadthMult),
    },
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories the house watchlist treats as a wrapped, staked or bridged product of another token. */
const WRAPPED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/**
 * Why the house watchlist leaves a ranked protocol out, in plain words, or null when the only
 * reason is size. The board ranks it anyway: the watchlist is a floor, not a ceiling, and a
 * caution the reader can see beats a row silently missing.
 */
/** Exchange names the watchlist rule treats as a house product, not a standalone launch. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

export function cautionFor(p: SnapshotProtocol): string | null {
  if (p.category === 'CEX') return 'An exchange: the house watchlist leaves CEX out. Ranked here for completeness; an exchange token is a different bet from a protocol launch.';
  if (EXCHANGE_PREFIX.test(p.name)) return 'The name begins with an exchange\'s: the house watchlist treats it as that exchange\'s own product rather than a standalone protocol launch.';
  if (VERSIONED.test(p.name)) return 'The name ends in a version marker: this may be one pool of a parent protocol whose launch, if any, belongs to the parent.';
  if (p.category !== null && WRAPPED_CATEGORIES.has(p.category)) return `${p.category}: the house watchlist treats this category as a wrapped or bridged product of a token that already trades.`;
  return null;
}

// ------------------------------------------------------------------ farm plans
//
// A plan is derived from the protocol's own record: its category picks the playbook, its primary
// chain picks the gas tier, its TVL picks the capital tier, its age picks the hold, and its own
// seven-day figure writes the risk note. Two protocols in one category still differ in chain,
// capital, volume target, hold and figures, so no two plans on the board are the same text.

/** A small deterministic hash of a slug, so phrasing varies by protocol and never by run. */
function slugHash(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type GasTier = 'high' | 'mid' | 'low';
const HIGH_GAS = new Set(['ethereum']);
const LOW_GAS = new Set(['base', 'arbitrum', 'optimism', 'zksync era', 'zksync', 'linea', 'scroll', 'mantle', 'blast', 'mode', 'taiko', 'solana', 'starknet', 'sui', 'aptos', 'near', 'tron', 'polygon zkevm', 'manta', 'zora', 'sonic', 'berachain', 'hyperliquid', 'abstract', 'soneium', 'ink', 'unichain', 'world chain', 'bob', 'fraxtal', 'x layer', 'sei', 'eclipse', 'movement', 'fuel', 'celestia', 'dydx', 'metis', 'boba', 'aurora', 'opbnb', 'bsc', 'bnb chain', 'polygon', 'avalanche', 'gnosis', 'celo', 'moonbeam', 'moonriver', 'cronos', 'fantom', 'harmony', 'oasis']);

function gasTier(chain: string): GasTier {
  const c = chain.toLowerCase();
  if (HIGH_GAS.has(c)) return 'high';
  if (LOW_GAS.has(c)) return 'low';
  return 'mid';
}

/** One on-chain action's gas on a chain of this tier, in dollars. */
const GAS_USD: Record<GasTier, number> = { high: 7, mid: 0.6, low: 0.15 };

/** The capital and monthly volume a plan commits, from the protocol's own TVL. */
function tierFor(tvl: number): { capital: number; volume: number } {
  if (tvl >= 5_000_000_000) return { capital: 1000, volume: 10000 };
  if (tvl >= 1_000_000_000) return { capital: 500, volume: 5000 };
  if (tvl >= 250_000_000) return { capital: 250, volume: 2500 };
  if (tvl >= 50_000_000) return { capital: 150, volume: 1000 };
  return { capital: 75, volume: 500 };
}

/** How many weeks to hold and repeat, from the protocol's age: younger records need a longer history. */
function weeksFor(age: number | null): number {
  if (age === null) return 8;
  if (age < 180) return 10;
  if (age < 540) return 8;
  return 6;
}

const usd = (n: number): string => `$${n.toLocaleString('en-US')}`;

/** The category playbook: the core position, how to deepen it, and the weekly routine. */
interface Playbook {
  core: (name: string, chain: string, capital: number, volume: number) => string;
  deepen: (name: string, chain: string, capital: number) => string;
  cadence: (name: string, volume: number) => string;
  weeklyActions: number;
}

function playbookFor(category: string | null): Playbook {
  const c = (category ?? '').toLowerCase();
  if (c.includes('cex')) return {
    core: (name, _ch, capital) => `Register on ${name}, complete its KYC, deposit ${usd(capital)} of USDC and place limit orders only: a first spot trade of about ${usd(Math.round(capital / 2))} into a major pair and back.`,
    deepen: (name, _ch, capital) => `Keep at least ${usd(Math.round(capital / 2))} of balance resting on ${name} between sessions and turn on its earn or staking product for idle funds if it offers one.`,
    cadence: (name, volume) => `Trade about ${usd(Math.round(volume / 4))} a week in small limit orders on ${name} until the month's volume reaches roughly ${usd(volume)}; never market-buy to chase volume.`,
    weeklyActions: 3,
  };
  if (c.includes('bridge') || c.includes('cross chain')) return {
    core: (name, chain, capital) => `Bridge ${usd(capital)} of USDC from Ethereum to ${chain} through ${name}, then make one real transaction on the far side (a swap or a deposit) so the trip is not a round trip in the same hour.`,
    deepen: (name, _ch, capital) => `Bridge a second ${usd(Math.round(capital / 2))} along a different route ${name} serves, and leave both balances parked in a lending market or stable pool on their own chains for at least a week.`,
    cadence: (name, volume) => `Route about ${usd(Math.round(volume / 4))} a week through ${name}, rotating destination chains, until the month's routed volume reaches roughly ${usd(volume)}.`,
    weeklyActions: 2,
  };
  if (c.includes('liquid staking') || c.includes('staking pool') || c.includes('restak') || c.includes('anchor btc') || c === 'staking') return {
    core: (name, chain, capital) => `Stake ${usd(capital)} of the underlying asset through ${name} on ${chain} and keep the receipt token in the same wallet; do not sell the receipt, it is the record of the position.`,
    deepen: (name) => `Deposit about half the receipt token into a money market or liquidity pool that ${name} lists as a partner, keeping the other half liquid so the position can be topped up.`,
    cadence: (name) => `Claim and restake the rewards on ${name} once a week, and add one small top-up stake a month so the position's history is not a single day.`,
    weeklyActions: 1,
  };
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return {
    core: (name, chain, capital) => `Supply ${usd(capital)} of USDC (or the chain's main stablecoin) to ${name} on ${chain} as collateral and leave it supplied; a supply position is the activity a launch snapshot can see.`,
    deepen: (name, _ch, capital) => `Borrow no more than ${usd(Math.round(capital * 0.35))} against the supply, re-supply the borrowed amount once, and keep the health factor above 2.0 at all times; unwind the loop before any volatile week.`,
    cadence: (name) => `Make one small extra supply or repay on ${name} each week and check the health factor twice a week; consistency across weeks counts for more than one large deposit.`,
    weeklyActions: 2,
  };
  if (c.includes('dex')) return {
    core: (name, chain, capital, volume) => `Swap about ${usd(Math.round(volume / 4))} through ${name} on ${chain} in three or four trades, then provide ${usd(capital)} to its deepest stable or blue-chip pool and keep the LP position open.`,
    deepen: (name) => `Split the liquidity: keep two thirds in the deepest pool and one third in a second pair, so the wallet shows both trading and providing history on ${name}.`,
    cadence: (name, volume) => `Trade about ${usd(Math.round(volume / 4))} a week on ${name} in a few swaps and rebalance the LP once a week, reaching roughly ${usd(volume)} of monthly volume.`,
    weeklyActions: 4,
  };
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('option') || c.includes('synthetic') || c.includes('interest rate')) return {
    core: (name, chain, capital) => `Deposit ${usd(capital)} of USDC as margin on ${name} (${chain}) and open one small delta-neutral pair: long and short the same asset in equal size, so the account farms activity, not price risk.`,
    deepen: (name, _ch, capital) => `Keep total open interest under ${usd(capital)} and every position's liquidation price at least 40% away; close and reopen one leg weekly rather than adding leverage.`,
    cadence: (name, volume) => `Place two or three small trades a week on ${name} toward roughly ${usd(volume)} of monthly volume, and never hold an unhedged position overnight.`,
    weeklyActions: 3,
  };
  if (c.includes('prediction')) return {
    core: (name, _ch, capital) => `Fund ${usd(capital)} on ${name} and take positions in three to five liquid markets, no more than a tenth of the fund in any one market.`,
    deepen: (name) => `Where ${name} offers liquidity rewards, rest small two-sided quotes in one active market instead of only buying outcomes.`,
    cadence: (name) => `Enter or adjust at least one market a week on ${name} and settle finished positions promptly, so the account shows a full season of participation.`,
    weeklyActions: 2,
  };
  if (c.includes('rwa')) return {
    core: (name, chain, capital) => `Complete ${name}'s onboarding on ${chain} (some issuers ask for KYC or an allowlist) and subscribe ${usd(capital)} to its flagship tokenized asset; hold the position, redemptions are slow by design.`,
    deepen: (name, _ch, capital) => `If a secondary pool exists for the asset, provide about ${usd(Math.round(capital / 3))} of liquidity there; if not, add a second smaller subscription after the first settles.`,
    cadence: (name) => `Check the position and any distribution on ${name} once a week; this category rewards holding through reporting dates, not frequent trading.`,
    weeklyActions: 1,
  };
  if (c.includes('chain')) return {
    core: (name, chain, capital) => `Bridge ${usd(capital)} of value onto ${chain} and hold it there; make three native transactions in its own apps (a DEX swap, a lending deposit, a domain or NFT mint if one is cheap).`,
    deepen: (name, chain) => `Open one position in the chain's flagship lending market or DEX and keep it for the season, so the wallet is a resident of ${chain}, not a tourist.`,
    cadence: () => `Transact on the chain at least three times a week in different apps; spread the activity across days, since bursts in one hour read as scripted.`,
    weeklyActions: 3,
  };
  if (c.includes('insurance')) return {
    core: (name, chain, capital) => `Buy ${usd(capital)} of cover from ${name} on ${chain} for a position you actually hold elsewhere, and keep the policy to term; if it offers underwriting, stake a smaller amount into its capital pool instead.`,
    deepen: (name) => `Renew or extend the cover once before it lapses, so the wallet shows a continuing relationship with ${name} rather than a single purchase.`,
    cadence: (name) => `Review the cover and the pool's capacity on ${name} weekly; this is a slow category and a weekly check is the whole routine.`,
    weeklyActions: 1,
  };
  if (c.includes('stable') || c.includes('algo')) return {
    core: (name, chain, capital) => `Mint ${usd(capital)} of ${name}'s stable asset on ${chain} from its accepted collateral (or wrap the underlying, for a wrapper) and hold the minted asset in the farming wallet.`,
    deepen: (name, _ch, capital) => `Provide about half the minted asset to its main liquidity pool paired with USDC, keeping the rest liquid for a partial redemption later.`,
    cadence: (name) => `Mint or redeem a small amount on ${name} each week and rebalance the pool, so the history shows two-way use rather than a single mint.`,
    weeklyActions: 2,
  };
  if (c.includes('payment') || c.includes('card')) return {
    core: (name, _ch, capital) => `Sign up for ${name}, complete its KYC, load ${usd(capital)} and route real spending or transfers through it; this category counts genuine usage, not deposits that sit still.`,
    deepen: (name, _ch, capital) => `Move one recurring payment or a regular transfer onto ${name} and keep a balance of about ${usd(Math.round(capital / 2))} resting between uses.`,
    cadence: (name) => `Use ${name} at least twice a week for ordinary payments through the season; frequency of real use is the signal here.`,
    weeklyActions: 2,
  };
  if (c.includes('privacy')) return {
    core: (name, chain, capital) => `Deposit a small amount, about ${usd(Math.round(capital / 2))}, into ${name} on ${chain} and make one shielded transfer to your own second wallet, following the app's own flow and your local rules.`,
    deepen: (name) => `Repeat with a second small deposit after a week rather than one large one, and keep amounts modest: privacy tools draw scrutiny at size.`,
    cadence: (name) => `Make one shielded transaction a week on ${name}; steady, small and documented in your farm log.`,
    weeklyActions: 1,
  };
  if (c.includes('index')) return {
    core: (name, chain, capital) => `Buy ${usd(capital)} of ${name}'s flagship index product on ${chain} and hold it; the position is the activity, there is nothing to churn.`,
    deepen: (name, _ch, capital) => `Add a second index or a smaller ${usd(Math.round(capital / 3))} top-up after the first month so the holding period spans more than one rebalance.`,
    cadence: (name) => `Check the index composition on ${name} monthly and top up small amounts rather than trading in and out.`,
    weeklyActions: 1,
  };
  if (c.includes('otc')) return {
    core: (name, _ch, capital) => `Complete one small trade of about ${usd(Math.round(capital / 2))} through ${name}'s marketplace with a counterparty it verifies, and keep the trade record.`,
    deepen: (name) => `List one standing offer on ${name} at a fair price and leave it open; a filled listing is stronger history than a cancelled one.`,
    cadence: (name) => `Check offers on ${name} weekly and complete at most one small trade a week; this is a thin market and patience is the plan.`,
    weeklyActions: 1,
  };
  // Vaults, curators, allocators, yield, basis, farms and everything else: a deposit playbook.
  return {
    core: (name, chain, capital) => `Deposit ${usd(capital)} of USDC (or the vault's stated asset) into ${name}'s flagship vault or strategy on ${chain} and keep the shares; pick the vault with the most TVL, not the highest advertised yield.`,
    deepen: (name, _ch, capital) => `Open a second, smaller position of about ${usd(Math.round(capital / 3))} in a different ${name} vault or strategy, so the wallet is diversified inside the protocol as well as across protocols.`,
    cadence: (name) => `Harvest or compound on ${name} once a week and top up by a small amount monthly; a position that only ever shrinks reads as abandoned.`,
    weeklyActions: 1,
  };
}

/** The risk note a protocol's own figures write: its seven-day move and its age, in words. */
function riskNote(p: SnapshotProtocol, age: number | null): string {
  const change = p.change_7d;
  const ageText = age === null ? 'DefiLlama reports no listing date for it, so its age is unverified' : age < 120 ? `it has only been tracked for ${age} days, so its record is short` : age > 1095 ? `it has run ${Math.floor(age / 365)}+ years with no token, so a launch is a choice it keeps not making` : `it has been tracked for ${age} days`;
  if (change === null) return `The snapshot reports no seven-day TVL change for ${p.name}; ${ageText}. Size the position at the small tier until two weekly checks agree.`;
  if (change >= 25) return `${p.name}'s TVL rose ${change.toFixed(1)}% in seven days: momentum this strong often precedes a points season, so start this week, but do not chase size after a vertical move; ${ageText}.`;
  if (change >= 5) return `${p.name}'s TVL rose ${change.toFixed(1)}% in seven days and ${ageText}: a healthy tape for starting the standard position now.`;
  if (change <= -25) return `${p.name}'s TVL fell ${Math.abs(change).toFixed(1)}% in seven days and ${ageText}: start at half size, re-check in two weeks, and be ready to walk away if the outflow continues.`;
  if (change <= -8) return `${p.name}'s TVL fell ${Math.abs(change).toFixed(1)}% in seven days and ${ageText}: use the small tier and let the weekly routine, not new capital, build the history.`;
  return `${p.name}'s TVL moved ${change >= 0 ? '+' : ''}${change.toFixed(1)}% in seven days and ${ageText}: a steady tape, so the standard position and cadence apply.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time, derived from the
 * protocol's own record. The summary counts fees and gas only; the capital stays the farmer's.
 */
export function farmPlan(p: SnapshotProtocol, age: number | null): { steps: FarmStep[]; summary: FarmSummary } {
  const chain = p.chains.length > 0 ? p.chains[0]! : 'its main chain';
  const tier = gasTier(chain);
  const gas = GAS_USD[tier];
  const { capital, volume } = tierFor(p.tvl_usd);
  const weeks = weeksFor(age);
  const book = playbookFor(p.category);
  const isCex = (p.category ?? '').toLowerCase().includes('cex');
  const setupCost = isCex ? Math.round(volume * 0.001) + 2 : Math.round(gas * 3 * 10) / 10 + 1;
  const weeklyCost = isCex ? Math.round((volume / 4) * 0.001 * 10) / 10 : Math.round(gas * book.weeklyActions * 10) / 10;
  const h = slugHash(p.slug);
  const walletLine = [
    'Use one fresh wallet for this protocol alone and keep its seed phrase offline; one wallet per protocol keeps every position auditable.',
    "Start from a fresh wallet that holds only this farm's funds, and write its address in the farm log before the first transaction.",
    'Create a dedicated wallet for this position and fund it from your main wallet in one transfer, so the farm\'s history stands alone.',
  ][h % 3]!;
  const steps: FarmStep[] = [
    {
      text: `${walletLine} Fund it with about ${usd(Math.max(10, Math.round(gas * 12)))} of ${chain}'s gas asset${p.chains.length > 1 ? ` (the position can later rotate to ${p.chains[1]})` : ''}.`,
      cost: `about $${setupCost.toFixed(2)} in first-transaction gas and fees`,
      time: '10 minutes',
    },
    {
      text: book.core(p.name, chain, capital, volume),
      cost: `${usd(capital)} of capital, about $${(gas * 2).toFixed(2)} of gas`,
      time: '20 minutes to set up',
    },
    {
      text: book.deepen(p.name, chain, capital),
      cost: `no new capital beyond the core position; about $${(gas * 2).toFixed(2)} of gas`,
      time: '15 minutes',
    },
    {
      text: book.cadence(p.name, volume),
      cost: `about $${weeklyCost.toFixed(2)} a week in gas and fees`,
      time: '10 minutes a week',
    },
    {
      text: riskNote(p, age),
      cost: 'no cost to read the tape before sizing up',
      time: '5 minutes a week',
    },
    p.chains.length >= 3
      ? {
          text: `From week three, repeat the core position on a second chain ${p.name} serves (${p.chains[1]} or ${p.chains[2]}), at half size: multi-chain history is harder to fake and the breadth factor already credits ${p.name} for its ${p.chains.length} chains.`,
          cost: `${usd(Math.round(capital / 2))} more capital and about $${(gas * 3).toFixed(2)} of gas`,
          time: '25 minutes, once',
        }
      : {
          text: `Keep the setup clean: review token approvals on the wallet monthly, revoke anything ${p.name} no longer needs, and never sign a claim or airdrop message from a link you were sent rather than found.`,
          cost: 'nothing; a revocation is one small gas fee if ever needed',
          time: '5 minutes a month',
        },
    {
      text: `Hold the position for the full ${weeks} weeks, checking ${p.name}'s own points or rewards page weekly. If a launch or snapshot is announced, claim only from the link the protocol itself publishes, and log every transaction with its date so the position can be unwound or repeated.`,
      cost: `the ${usd(capital)} stays in the position; claiming, if it comes, is one transaction`,
      time: `${weeks} weeks, then 30 minutes to unwind`,
    },
  ];
  const summary: FarmSummary = {
    capital_usd: capital,
    setup_cost_usd: Math.round(setupCost * 100) / 100,
    weekly_cost_usd: Math.round(weeklyCost * 100) / 100,
    weeks,
    total_cost_usd: Math.round((setupCost + weeklyCost * weeks) * 100) / 100,
  };
  return { steps, summary };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The protocols the board ranks, strongest first, with ranks 1..n: every pre-token protocol. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const { stats } = categoryStats(snapshot, model);
  const imputed = imputedAge(snapshot);
  const watch = new Set(snapshot.watchlist);
  const scored = snapshot.protocols
    .filter(isPreToken)
    .map((p) => {
      const s = score(p, snapshot, stats.get(categoryOf(p))!, imputed, model);
      const plan = farmPlan(p, s.age);
      return { p, s, plan };
    });
  scored.sort((a, b) => b.s.implied - a.s.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map(({ p, s, plan }, i) => ({
    rank: i + 1,
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    mcap_usd: p.mcap_usd,
    listed_at: p.listed_at,
    gecko_id: p.gecko_id,
    symbol: p.symbol,
    token_status: 'pre-token',
    on_watchlist: watch.has(p.slug),
    caution: cautionFor(p),
    age_days: s.age,
    implied_value_usd: s.implied,
    priority_usd: s.priority,
    launch_base_rate: s.baseRate,
    model: s.breakdown,
    farm: plan.summary,
    farm_steps: plan.steps.map(stepText),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Live token view: the peer set. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p))
    .sort((a, b) => (b.mcap_usd ?? -1) - (a.mcap_usd ?? -1) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      symbol: p.symbol,
    }));
}

/** A board row's form for data.js: the same figures and plan, the steps still structured. */
export function radarRow(row: BoardRow, snapshot: Snapshot): RadarRow {
  const p = snapshot.protocols.find((x) => x.slug === row.slug)!;
  const plan = farmPlan(p, row.age_days);
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    on_watchlist: row.on_watchlist,
    caution: row.caution,
    implied_value_usd: row.implied_value_usd,
    priority_usd: row.priority_usd,
    launch_base_rate: row.launch_base_rate,
    model: row.model,
    farm: row.farm,
    farm_steps: plan.steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const { stats, globalMedian, peerCount } = categoryStats(snapshot, model);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    global_median_ratio: round4(globalMedian),
    peer_count: peerCount,
    imputed_age_days: imputedAge(snapshot),
    protocols_size: snapshot.protocols.length,
    pre_token_size: board.length,
    tokenized_size: live.length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    categories: [...stats.values()].sort((a, b) => b.protocols - a.protocols || (a.category < b.category ? -1 : 1)),
    rows: board.map((r) => radarRow(r, snapshot)),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, values and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  if (slugs.size !== board.length) return 'the board carries a slug twice';
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
