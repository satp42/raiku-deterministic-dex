#!/usr/bin/env tsx

/**
 * Fairlane DEX Coordinator Service
 * Main entry point that boots the batch coordination system
 */

import * as dotenv from "dotenv"
import { PrismaClient } from "@prisma/client"

// Load environment variables
dotenv.config()

interface CoordinatorConfig {
  databaseUrl: string
  environment: string
  port?: number
  logLevel: string
}

class CoordinatorService {
  private prisma: PrismaClient
  private config: CoordinatorConfig
  private isShuttingDown = false

  constructor() {
    this.config = this.loadConfig()
    this.prisma = new PrismaClient({
      log: this.config.logLevel === "debug" ? ["query", "error", "warn"] : ["error"],
      datasources: {
        db: {
          url: this.config.databaseUrl,
        },
      },
    })

    // Handle graceful shutdown
    process.on("SIGINT", () => this.shutdown())
    process.on("SIGTERM", () => this.shutdown())
  }

  private loadConfig(): CoordinatorConfig {
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is required")
    }

    return {
      databaseUrl,
      environment: process.env.NODE_ENV || "development",
      port: parseInt(process.env.PORT || "3001", 10),
      logLevel: process.env.LOG_LEVEL || "info",
    }
  }

  async start(): Promise<void> {
    try {
      console.log("🚀 Starting Fairlane DEX Coordinator...")
      console.log(`   Environment: ${this.config.environment}`)
      console.log(`   Database: ${this.config.databaseUrl.replace(/\/\/.*@/, "//***:***@")}`)
      console.log(`   Log Level: ${this.config.logLevel}`)

      // Test database connection
      await this.testDatabaseConnection()

      // Load and log markets
      await this.logMarkets()

      // Start main coordination loop (placeholder for now)
      await this.startCoordinationLoop()

      console.log("✅ Coordinator service started successfully")
      console.log("   Press Ctrl+C to stop")

    } catch (error) {
      console.error("❌ Failed to start coordinator:", error)
      process.exit(1)
    }
  }

  private async testDatabaseConnection(): Promise<void> {
    try {
      await this.prisma.$connect()
      console.log("✅ Database connection established")
    } catch (error) {
      console.error("❌ Database connection failed:", error)
      throw error
    }
  }

  private async logMarkets(): Promise<void> {
    try {
      const markets = await this.prisma.market.findMany({
        where: { active: true },
        include: {
          plannedBatches: {
            where: {
              status: {
                in: ["PLANNED", "INCLUSION_PUBLISHED"]
              }
            },
            orderBy: { slot: "asc" },
            take: 5 // Show next 5 planned batches per market
          },
          _count: {
            select: {
              orders: true,
              plannedBatches: true,
              batches: true
            }
          }
        },
        orderBy: { symbol: "asc" }
      })

      if (markets.length === 0) {
        console.log("⚠️  No active markets found in database")
        console.log("   Run the seed script to create markets: pnpm -C apps/web tsx scripts/seed.ts")
        return
      }

      console.log(`📊 Found ${markets.length} active markets:`)
      console.log("")

      for (const market of markets) {
        const { symbol, cadenceSec, baseMint, quoteMint } = market
        const { orders, plannedBatches, batches } = market._count

        console.log(`   ${symbol}`)
        console.log(`     Base: ${baseMint.slice(0, 8)}...${baseMint.slice(-4)}`)
        console.log(`     Quote: ${quoteMint.slice(0, 8)}...${quoteMint.slice(-4)}`)
        console.log(`     Cadence: ${cadenceSec}s (${Math.round(1000 / cadenceSec)} batches/min)`)
        console.log(`     Orders: ${orders} total`)
        console.log(`     Planned: ${plannedBatches} upcoming`)
        console.log(`     Settled: ${batches} completed`)
        console.log(`     Fee: ${(market.feeBps / 100).toFixed(2)}%`)

        if (market.plannedBatches.length > 0) {
          console.log(`     Next batches:`)
          market.plannedBatches.forEach((batch, i) => {
            const etaInSeconds = Math.round((batch.eta.getTime() - Date.now()) / 1000)
            const status = batch.status === "PLANNED" ? "📋" : "✅"
            console.log(`       ${status} Slot ${batch.slot} (ETA: ${etaInSeconds}s)`)
          })
        }

        console.log("")
      }

    } catch (error) {
      console.error("❌ Failed to load markets:", error)
      throw error
    }
  }

  private async startCoordinationLoop(): Promise<void> {
    console.log("🔄 Starting coordination loop...")

    // TODO: Implement actual coordination logic
    // For now, just log that we're running
    console.log("   Coordinator loop active (placeholder)")
    console.log("   Next steps: batch planner, inclusion publisher, batch executor")

    // Keep the service alive
    return new Promise(() => {
      // This promise never resolves, keeping the service running
    })
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return
    this.isShuttingDown = true

    console.log("\n🛑 Shutting down coordinator...")

    try {
      await this.prisma.$disconnect()
      console.log("✅ Database disconnected")
    } catch (error) {
      console.error("❌ Error during shutdown:", error)
    }

    console.log("👋 Coordinator stopped")
    process.exit(0)
  }

  getStatus() {
    return {
      environment: this.config.environment,
      databaseConnected: this.prisma.$isConnected(),
      config: this.config,
    }
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error)
  process.exit(1)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason)
  process.exit(1)
})

// Start the service
async function main() {
  const coordinator = new CoordinatorService()
  await coordinator.start()
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

// Export for testing
export { CoordinatorService }
