/**
 * Market configuration and constants for Fairlane DEX
 */

export interface MarketConfig {
  readonly symbol: string
  readonly baseMint: string
  readonly quoteMint: string
  readonly tickSize: string
  readonly cadenceSec: number
  readonly feeBps: number
  readonly minNotional: string
}

// Devnet token addresses (SPL tokens)
export const DEVNET_TOKENS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // Devnet USDC
  ETH: "2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk",  // Devnet Wrapped ETH
} as const

// Default market configurations
export const DEFAULT_MARKETS: MarketConfig[] = [
  {
    symbol: "SOL-USDC",
    baseMint: DEVNET_TOKENS.SOL,
    quoteMint: DEVNET_TOKENS.USDC,
    tickSize: "0.01",
    cadenceSec: 1,
    feeBps: 10, // 0.1%
    minNotional: "1.00",
  },
  {
    symbol: "ETH-USDC",
    baseMint: DEVNET_TOKENS.ETH,
    quoteMint: DEVNET_TOKENS.USDC,
    tickSize: "0.01",
    cadenceSec: 1,
    feeBps: 10,
    minNotional: "1.00",
  },
]

// Batch execution config
export const BATCH_CONFIG = {
  PRE_PUBLISH_LEAD_MS: 500,      // Lock batch 500ms before slot
  AOT_LOOKAHEAD_SLOTS: 10,       // Reserve next 10 slots
  MAX_ORDERS_PER_BATCH: 1000,    // Safety limit
  ORDER_TTL_SEC: 60,             // Orders expire after 60s if not filled
} as const

// Raiku config
export const RAIKU_CONFIG = {
  MOCK_MODE: process.env.RAIKU_MOCK === "true",
  API_KEY: process.env.RAIKU_API_KEY || "",
  ENV: process.env.RAIKU_ENV || "dev",
  SLOT_TIME_MS: 400,             // Solana slot time (~400ms)
} as const

// Solana config
export const SOLANA_CONFIG = {
  RPC_URL: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  COMMITMENT: "confirmed" as const,
  CLUSTER: "devnet" as const,
} as const

// Program ID (set after deployment)
export const FAIRLANE_PROGRAM_ID = process.env.ANCHOR_PROGRAM_ID || ""

