/**
 * ENS profile and user preference types.
 * Stored per ENS identity and used for personalized feed.
 */

export const TRADING_STYLES = [
  "long_term_investor",
  "swing_trader",
  "day_trader",
  "defi_yield_farmer",
  "nft_trader",
  "ai_automation",
] as const;
export type TradingStyle = (typeof TRADING_STYLES)[number];

export const RISK_LEVELS = ["conservative", "moderate", "aggressive", "high_risk"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const MARKET_SECTORS = [
  "defi",
  "layer1",
  "layer2",
  "ai_tokens",
  "gaming_gamefi",
  "real_world_assets",
  "meme_coins",
  "nfts",
  "infrastructure",
  "privacy_coins",
] as const;
export type MarketSector = (typeof MARKET_SECTORS)[number];

export const ECOSYSTEMS = [
  "ethereum",
  "solana",
  "base",
  "arbitrum",
  "polygon",
  "cosmos",
  "avalanche",
  "optimism",
  "sui",
  "aptos",
] as const;
export type Ecosystem = (typeof ECOSYSTEMS)[number];

export const PORTFOLIO_SIZE_RANGES = [
  "under_1k",
  "1k_10k",
  "10k_100k",
  "100k_plus",
] as const;
export type PortfolioSizeRange = (typeof PORTFOLIO_SIZE_RANGES)[number];

export const SIGNAL_TYPES = [
  "technical_analysis",
  "onchain_analytics",
  "whale_activity",
  "narrative_trends",
  "ai_sentiment",
  "macro_news",
  "airdrop_opportunities",
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export const NOTIFICATION_PREFS = [
  "realtime_alerts",
  "daily_summary",
  "weekly_insights",
  "major_signals_only",
] as const;
export type NotificationPref = (typeof NOTIFICATION_PREFS)[number];

export interface EnsPreferences {
  trading_style: TradingStyle;
  risk_level: RiskLevel;
  sectors: MarketSector[];
  ecosystems: Ecosystem[];
  portfolio_size?: PortfolioSizeRange;
  signals: SignalType[];
  notifications: NotificationPref[];
}

export interface EnsProfile {
  ens_name: string;
  wallet_address: string;
  preferences: EnsPreferences;
  watchlist?: string[]; // token symbols or coingecko ids
  created_at: string; // ISO
  updated_at: string;
}

export const TRADING_STYLE_LABELS: Record<TradingStyle, string> = {
  long_term_investor: "Long-term investor",
  swing_trader: "Swing trader",
  day_trader: "Day trader",
  defi_yield_farmer: "DeFi yield farmer",
  nft_trader: "NFT trader",
  ai_automation: "AI-driven automation",
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  conservative: "Conservative",
  moderate: "Moderate",
  aggressive: "Aggressive",
  high_risk: "Degenerate / High risk",
};

export const SECTOR_LABELS: Record<MarketSector, string> = {
  defi: "DeFi",
  layer1: "Layer 1s",
  layer2: "Layer 2s",
  ai_tokens: "AI tokens",
  gaming_gamefi: "Gaming / GameFi",
  real_world_assets: "Real World Assets",
  meme_coins: "Meme coins",
  nfts: "NFTs",
  infrastructure: "Infrastructure",
  privacy_coins: "Privacy coins",
};

export const ECOSYSTEM_LABELS: Record<Ecosystem, string> = {
  ethereum: "Ethereum",
  solana: "Solana",
  base: "Base",
  arbitrum: "Arbitrum",
  polygon: "Polygon",
  cosmos: "Cosmos",
  avalanche: "Avalanche",
  optimism: "Optimism",
  sui: "Sui",
  aptos: "Aptos",
};

export const PORTFOLIO_SIZE_LABELS: Record<PortfolioSizeRange, string> = {
  under_1k: "<$1k",
  "1k_10k": "$1k – $10k",
  "10k_100k": "$10k – $100k",
  "100k_plus": "$100k+",
};

export const SIGNAL_LABELS: Record<SignalType, string> = {
  technical_analysis: "Technical analysis",
  onchain_analytics: "On-chain analytics",
  whale_activity: "Whale activity",
  narrative_trends: "Narrative trends",
  ai_sentiment: "AI sentiment analysis",
  macro_news: "Macro news",
  airdrop_opportunities: "Airdrop opportunities",
};

export const NOTIFICATION_LABELS: Record<NotificationPref, string> = {
  realtime_alerts: "Real-time alerts",
  daily_summary: "Daily summaries",
  weekly_insights: "Weekly insights",
  major_signals_only: "Only major signals",
};

export const DEFAULT_PREFERENCES: EnsPreferences = {
  trading_style: "swing_trader",
  risk_level: "moderate",
  sectors: ["defi", "layer2"],
  ecosystems: ["ethereum", "base"],
  signals: ["onchain_analytics", "narrative_trends"],
  notifications: ["daily_summary"],
};
