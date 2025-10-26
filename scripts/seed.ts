/**
 * Seed Script for Fairlane DEX
 * Seeds the database with initial markets
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient({
  log: ["query", "error", "warn"],
})

async function main() {
  console.log("🌱 Starting database seed...")

  // Seed SOL-USDC market
  const solUsdcMarket = await prisma.market.upsert({
    where: {
      symbol: "SOL-USDC",
    },
    create: {
      symbol: "SOL-USDC",
      baseMint: "So11111111111111111111111111111111111111112", // SOL mint
      quoteMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC mint
      tickSize: 0.0001, // Minimum price increment
      cadenceSec: 1, // Batch cadence in seconds
      feeBps: 10, // 0.1% fee
      minNotional: 1.0, // Minimum order size in quote currency
      active: true,
    },
    update: {
      // Update if market already exists
      active: true,
    },
  })

  console.log("✅ Seeded SOL-USDC market:", solUsdcMarket)

  // Verify the market was created
  const markets = await prisma.market.findMany()
  console.log(`📊 Total markets in database: ${markets.length}`)
  console.log("Markets:", markets.map(m => ({ symbol: m.symbol, active: m.active })))

  console.log("🎉 Database seed completed successfully!")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error("❌ Error during database seed:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
