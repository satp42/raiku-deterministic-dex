/**
 * Verification Script for Fairlane DEX Seed
 * Verifies that the SOL-USDC market was seeded correctly
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient({
  log: ["query", "error", "warn"],
})

async function main() {
  console.log("🔍 Verifying database seed...")

  // Get all markets
  const markets = await prisma.market.findMany()

  console.log(`📊 Found ${markets.length} markets in database:`)

  markets.forEach((market) => {
    console.log(`  - Symbol: ${market.symbol}`)
    console.log(`    Base Mint: ${market.baseMint}`)
    console.log(`    Quote Mint: ${market.quoteMint}`)
    console.log(`    Tick Size: ${market.tickSize}`)
    console.log(`    Cadence: ${market.cadenceSec}s`)
    console.log(`    Fee: ${market.feeBps}bps`)
    console.log(`    Min Notional: ${market.minNotional}`)
    console.log(`    Active: ${market.active}`)
    console.log(`    Created: ${market.createdAt}`)
    console.log("")
  })

  // Verify specific SOL-USDC market
  const solUsdcMarket = await prisma.market.findUnique({
    where: {
      symbol: "SOL-USDC",
    },
  })

  if (solUsdcMarket) {
    console.log("✅ SOL-USDC market found and verified!")

    // Verify the specific requirements from the task
    const isValidSymbol = solUsdcMarket.symbol === "SOL-USDC"
    const isValidCadence = solUsdcMarket.cadenceSec === 1
    const isValidBaseMint = solUsdcMarket.baseMint === "So11111111111111111111111111111111111111112"
    const isValidQuoteMint = solUsdcMarket.quoteMint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    const isActive = solUsdcMarket.active === true

    console.log("📋 Task Requirements Verification:")
    console.log(`  ✅ Symbol is SOL-USDC: ${isValidSymbol}`)
    console.log(`  ✅ Cadence is 1 second: ${isValidCadence}`)
    console.log(`  ✅ Base mint is SOL: ${isValidBaseMint}`)
    console.log(`  ✅ Quote mint is USDC: ${isValidQuoteMint}`)
    console.log(`  ✅ Market is active: ${isActive}`)

    const allRequirementsMet = isValidSymbol && isValidCadence && isValidBaseMint && isValidQuoteMint && isActive

    if (allRequirementsMet) {
      console.log("🎉 All task requirements met! Seed script completed successfully.")
    } else {
      console.log("❌ Some requirements not met. Please check the configuration.")
      process.exit(1)
    }
  } else {
    console.log("❌ SOL-USDC market not found!")
    process.exit(1)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error("❌ Error during verification:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
