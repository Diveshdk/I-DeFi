// contract utilities + token list
// Targeting Base Mainnet + Uniswap V3
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

export interface Token {
  symbol: string;
  name: string;
  address: string;
  color: string;
  emoji: string;
  decimals: number;
  coingeckoId: string;
  isNative?: boolean; // true for WETH when user pays with native ETH
}

// ── Uniswap V3 on Base Mainnet ─────────────────────────────────────────────
// V3 has all the deep liquidity on Base (WETH/USDC pool alone is $300M+)
// QuoterV2  : read-only contract for price quotes (off-chain simulation)
// SwapRouter02: executes swaps
export const SWAP_ROUTER  = "0x2626664c2603336E57B271c5C0b26F421741e481"; // SwapRouter02
export const QUOTER_V2    = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a"; // QuoterV2 (official Base deployment)

// Legacy V2 aliases (used by liquidity/pools pages if still referenced)
export const ROUTER_ADDRESS  = SWAP_ROUTER;
export const FACTORY_ADDRESS = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD"; // V3 Factory

// ── V3 fee tiers to try (in priority order) ───────────────────────────────
// Base priority: WETH/USDC → 500, stable pairs → 100, WETH/WBTC → 3000
export const FEE_TIERS = [100, 500, 3000, 10000] as const; // 0.01%, 0.05%, 0.3%, 1%
export type FeeTier = typeof FEE_TIERS[number];

/**
 * A dedicated Base-mainnet public client for quoting.
 * Always talks to Base regardless of which chain the user's wallet is on.
 * This is the fix for the "No liquidity" bug — wagmi's usePublicClient()
 * follows the wallet chain, but quotes MUST go to Base where V3 pools live.
 */
export const basePublicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

// ── Real Base Mainnet Token Addresses ────────────────────────────────────────
const BASE_TOKENS = {
  WETH:  "0x4200000000000000000000000000000000000006", // native WETH on Base
  USDC:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // native USDC on Base
  USDT:  "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // Bridged USDT on Base
  WBTC:  "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c", // cbBTC / WBTC on Base
  DAI:   "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // DAI on Base
  cbETH: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", // Coinbase Staked ETH
};

export const TOKEN_LIST: Token[] = [
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: BASE_TOKENS.WETH,
    color: "#627EEA",
    emoji: "⟠",
    decimals: 18,
    coingeckoId: "ethereum",
    isNative: true,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: BASE_TOKENS.USDC,
    color: "#2775CA",
    emoji: "◈",
    decimals: 6,
    coingeckoId: "usd-coin",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: BASE_TOKENS.USDT,
    color: "#26A17B",
    emoji: "₮",
    decimals: 6,
    coingeckoId: "tether",
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    address: BASE_TOKENS.DAI,
    color: "#F5AC37",
    emoji: "◐",
    decimals: 18,
    coingeckoId: "dai",
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    address: BASE_TOKENS.WBTC,
    color: "#F7931A",
    emoji: "₿",
    decimals: 8,
    coingeckoId: "wrapped-bitcoin",
  },
  {
    symbol: "cbETH",
    name: "Coinbase Staked ETH",
    address: BASE_TOKENS.cbETH,
    color: "#0052FF",
    emoji: "🔵",
    decimals: 18,
    coingeckoId: "coinbase-wrapped-staked-eth",
  },
];

// ── Uniswap V3 ABIs ───────────────────────────────────────────────────────────

/** QuoterV2 — off-chain read for price simulation */
export const QUOTER_V2_ABI = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn",           type: "address" },
          { name: "tokenOut",          type: "address" },
          { name: "amountIn",          type: "uint256" },
          { name: "fee",               type: "uint24"  },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut",              type: "uint256" },
      { name: "sqrtPriceX96After",      type: "uint160" },
      { name: "initializedTicksCrossed",type: "uint32"  },
      { name: "gasEstimate",            type: "uint256" },
    ],
  },
] as const;

/** SwapRouter02 — exactInputSingle (single-hop swap) */
export const SWAP_ROUTER_ABI = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn",           type: "address" },
          { name: "tokenOut",          type: "address" },
          { name: "fee",               type: "uint24"  },
          { name: "recipient",         type: "address" },
          { name: "amountIn",          type: "uint256" },
          { name: "amountOutMinimum",  type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  // WETH9 unwrap helper — so ETH comes back as native ETH when tokenOut = WETH
  {
    name: "unwrapWETH9",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "amountMinimum", type: "uint256" },
      { name: "recipient",     type: "address" },
    ],
    outputs: [],
  },
  // refundETH — send back any unspent ETH
  {
    name: "refundETH",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const;

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
] as const;

// Legacy alias (LP pages still reference ROUTER_ABI)
export const ROUTER_ABI = SWAP_ROUTER_ABI;

export const PAIR_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
] as const;

export const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address pair)",
  "function allPairsLength() view returns (uint256)",
  "function allPairs(uint256 index) view returns (address pair)",
] as const;

// ── Quote helper ──────────────────────────────────────────────────────────────

/**
 * Try all three V3 fee tiers and return the best quote (highest amountOut).
 * Returns { amountOut, fee } or null if no pool has liquidity for this pair.
 */
export async function getBestV3Quote(
  publicClient: {
    simulateContract: (args: unknown) => Promise<{ result: unknown }>;
  },
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
): Promise<{ amountOut: bigint; fee: FeeTier } | null> {
  if (amountIn === 0n || tokenIn.toLowerCase() === tokenOut.toLowerCase()) return null;

  const results: { amountOut: bigint; fee: FeeTier }[] = [];

  await Promise.allSettled(
    FEE_TIERS.map(async (fee) => {
      try {
        const res = await (publicClient as {
          simulateContract: (args: {
            address: `0x${string}`;
            abi: typeof QUOTER_V2_ABI;
            functionName: "quoteExactInputSingle";
            args: [{ tokenIn: `0x${string}`; tokenOut: `0x${string}`; amountIn: bigint; fee: number; sqrtPriceLimitX96: bigint }];
          }) => Promise<{ result: [bigint, bigint, number, bigint] }>;
        }).simulateContract({
          address: QUOTER_V2 as `0x${string}`,
          abi: QUOTER_V2_ABI,
          functionName: "quoteExactInputSingle",
          args: [{
            tokenIn:           tokenIn as `0x${string}`,
            tokenOut:          tokenOut as `0x${string}`,
            amountIn,
            fee,
            sqrtPriceLimitX96: 0n,
          }],
        });
        const amountOut = res.result[0];
        if (amountOut > 0n) results.push({ amountOut, fee });
      } catch {
        // pool does not exist or no liquidity — skip
      }
    }),
  );

  if (results.length === 0) return null;
  return results.reduce((best, cur) => cur.amountOut > best.amountOut ? cur : best);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatAmount(value: bigint, decimals = 18, displayDecimals = 4): string {
  if (value === 0n) return "0";
  const str = value.toString().padStart(decimals + 1, "0");
  const int = str.slice(0, str.length - decimals) || "0";
  const frac = str.slice(str.length - decimals).slice(0, displayDecimals);
  const trimmed = frac.replace(/0+$/, "");
  return trimmed ? `${int}.${trimmed}` : int;
}

export function parseAmount(value: string, decimals = 18): bigint {
  if (!value || value === ".") return 0n;
  const [int, frac = ""] = value.split(".");
  const fracPadded = frac.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(int + fracPadded);
}

export function deadline(minutes = 20): number {
  return Math.floor(Date.now() / 1000) + minutes * 60;
}

export function getTokenByAddress(address: string): Token | undefined {
  return TOKEN_LIST.find(t => t.address.toLowerCase() === address.toLowerCase());
}
