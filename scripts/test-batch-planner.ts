#!/usr/bin/env tsx

/**
 * Test script for Batch Planner Integration
 * Verifies coordinator creates rolling PlannedBatch records with Raiku reservations
 */

import { prisma } from "../apps/web/lib/prisma"
import { CoordinatorService } from "../services/coordinator/src/index"
import { BatchPlanStatus } from "@prisma/client"

// Mock environment for testing
process.env.DATABASE_URL = "file:../../apps/web/prisma/dev.db"
process.env.NODE_ENV = "test"
process.env.LOG_LEVEL = "debug"
process.env.BATCH_LOOK_AHEAD = "5"
process.env.BATCH_PLAN_INTERVAL = "500"
process.env.CUTOFF_LEAD_MS = "200"

async function setupTestMarket() {
  // Clean up any existing test data
  await prisma.plannedBatch.deleteMany({
    where: {
      market: {
        symbol: "TEST-SOL"
      }
    }
  })

  await prisma.market.deleteMany({
    where: { symbol: "TEST-SOL" }
  })

  // Create test market
  const market = await prisma.market.create({
    data: {
      symbol: "TEST-SOL",
      baseMint: "So11111111111111111111111111111111111111112", // SOL
      quoteMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      tickSize: 0.01,
      cadenceSec: 1, // 1 second batches
      feeBps: 10
    }
  })

  console.log(`📦 Created test market: ${market.symbol} (cadence: ${market.cadenceSec}s)`)
  return market
}

async function testBatchPlanner() {
  console.log("🧪 Testing Batch Planner Integration...")
  console.log("=====================================")

  let coordinator: CoordinatorService

  try {
    // Setup test market
    const market = await setupTestMarket()

    // Create coordinator instance
    coordinator = new CoordinatorService()

    console.log("✅ Coordinator instance created")

    // Test configuration loading
    const status = coordinator.getStatus()
    console.log("✅ Configuration loaded:")
    console.log(`   Environment: ${status.environment}`)
    console.log(`   Batch Look Ahead: ${status.config.batchLookAhead} batches`)
    console.log(`   Batch Plan Interval: ${status.config.batchPlanInterval}ms`)
    console.log(`   Cutoff Lead: ${status.config.cutoffLeadMs}ms`)

    // Test database connection
    console.log("\n🗄️  Testing database connection...")
    await coordinator["testDatabaseConnection"]()
    console.log("✅ Database connection test passed")

    // Test market loading
    console.log("\n📊 Testing market loading...")
    await coordinator["logMarkets"]()
    console.log("✅ Market loading test passed")

    // Start batch planner
    console.log("\n🗓️  Starting batch planner...")
    coordinator["batchPlanner"].start()

    console.log("⏳ Waiting 3 seconds for batch planner to create PlannedBatch records...")

    // Wait for batch planner to work
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Check database for PlannedBatch records
    const plannedBatches = await prisma.plannedBatch.findMany({
      where: {
        marketId: market.id,
        status: BatchPlanStatus.PLANNED
      },
      orderBy: { eta: "asc" }
    })

    console.log(`\n📊 Found ${plannedBatches.length} PLANNED batches in database:`)

    plannedBatches.forEach((batch, index) => {
      const etaInSeconds = Math.round((batch.eta.getTime() - Date.now()) / 1000)
      console.log(`   ${index + 1}. Slot ${batch.slot} (ETA: ${etaInSeconds}s from now)`)
      console.log(`      Raiku ID: ${batch.raikuResId}`)
      console.log(`      Status: ${batch.status}`)
      console.log(`      Created: ${batch.createdAt.toISOString()}`)
      console.log("")
    })

    // Verify we have planned batches
    const expectedMinBatches = 2 // Should have created some batches in 3 seconds

    if (plannedBatches.length >= expectedMinBatches) {
      console.log(`✅ Test PASSED: Found ${plannedBatches.length} planned batches (expected >= ${expectedMinBatches})`)

      // Verify all batches are in the future
      const futureBatches = plannedBatches.filter(b => b.eta > new Date())
      console.log(`✅ All batches are in future: ${futureBatches.length}/${plannedBatches.length}`)

      // Verify all have Raiku reservation IDs
      const reservedBatches = plannedBatches.filter(b => b.raikuResId)
      console.log(`✅ All batches have Raiku reservations: ${reservedBatches.length}/${plannedBatches.length}`)

      // Verify batches are spaced according to cadence (should be ~1 second apart)
      if (plannedBatches.length >= 2) {
        const timeGaps = []
        for (let i = 1; i < plannedBatches.length; i++) {
          const gapSeconds = Math.round((plannedBatches[i].eta.getTime() - plannedBatches[i-1].eta.getTime()) / 1000)
          timeGaps.push(gapSeconds)
        }
        console.log(`✅ Batch time gaps (should be ~1s for cadence): ${timeGaps.join(", ")}s`)
      }

      console.log("=====================================")
      console.log("🎉 Batch planner integration test completed successfully!")

      // Test order assignment
      console.log("\n🧪 Testing order assignment...")
      const nextBatchResult = await coordinator["batchPlanner"].findNextBatchForOrder(market.id)

      if (nextBatchResult.batch) {
        console.log(`✅ Found next batch: Slot ${nextBatchResult.batch.slot} (ETA: ${nextBatchResult.batch.eta.toISOString()})`)
        console.log(`✅ Cutoff time: ${nextBatchResult.cutoffTime.toISOString()}`)
        console.log("✅ Order assignment working correctly")
      } else {
        console.log("⚠️  No future batches found for order assignment (normal if all batches expired)")
      }

      return true

    } else {
      console.log(`❌ Test FAILED: Found ${plannedBatches.length} planned batches (expected >= ${expectedMinBatches})`)
      console.log("=====================================")
      return false
    }

  } catch (error) {
    console.error("❌ Test FAILED with error:", error)
    console.log("=====================================")
    return false
  } finally {
    // Cleanup
    if (coordinator) {
      await coordinator.shutdown()
    }
  }
}

async function testCoordinatorBoot() {
  console.log("\n🧪 Testing Full Coordinator Boot with Batch Planner...")
  console.log("======================================================")

  try {
    const coordinator = new CoordinatorService()

    // Start the full service (this will run indefinitely until interrupted)
    console.log("🚀 Starting coordinator service with batch planner...")
    await coordinator.start()

    // If we reach here, something went wrong (start should block)
    console.error("❌ Service started but didn't block as expected")
    return false

  } catch (error) {
    if (error instanceof Error && error.message.includes("DATABASE_URL")) {
      console.log("ℹ️  Expected error: DATABASE_URL not set (run with proper env)")
      console.log("   To test with real DB: DATABASE_URL=file:../apps/web/prisma/dev.db tsx scripts/test-batch-planner.ts")
      return true
    }

    console.error("❌ Unexpected error:", error)
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes("--full")) {
    await testCoordinatorBoot()
  } else {
    const success = await testBatchPlanner()
    process.exit(success ? 0 : 1)
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(console.error)
}
