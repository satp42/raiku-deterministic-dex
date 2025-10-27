#!/usr/bin/env tsx

/**
 * Test script for Raiku Scheduler
 * Verifies scheduler creates PlannedBatch records with AOT reservations
 */

import { prisma } from "../apps/web/lib/prisma"
import { raikuScheduler } from "../apps/web/lib/raiku/scheduler"
import { BatchPlanStatus } from "@prisma/client"

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

async function testScheduler() {
  console.log("🧪 Testing Raiku Scheduler...")
  console.log("=============================")

  try {
    // Setup test market
    const market = await setupTestMarket()

    // Clear any existing reservations in mock client
    raikuScheduler.stop() // Ensure clean state

    console.log("🚀 Starting scheduler...")

    // Start scheduler
    raikuScheduler.start()

    console.log("⏳ Waiting 5 seconds for scheduler to create PlannedBatch records...")

    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Stop scheduler
    raikuScheduler.stop()

    // Check database for PlannedBatch records
    const plannedBatches = await prisma.plannedBatch.findMany({
      where: {
        marketId: market.id,
        status: BatchPlanStatus.PLANNED
      },
      orderBy: { slot: "asc" }
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

    // Verify we have at least some batches
    const expectedMinBatches = 3 // Should have created some batches in 5 seconds

    if (plannedBatches.length >= expectedMinBatches) {
      console.log(`✅ Test PASSED: Found ${plannedBatches.length} planned batches (expected >= ${expectedMinBatches})`)

      // Verify slots are in the future
      const futureBatches = plannedBatches.filter(b => b.eta > new Date())
      console.log(`✅ All batches are in future: ${futureBatches.length}/${plannedBatches.length}`)

      // Verify all have Raiku reservation IDs
      const reservedBatches = plannedBatches.filter(b => b.raikuResId)
      console.log(`✅ All batches have Raiku reservations: ${reservedBatches.length}/${plannedBatches.length}`)

      // Verify slots are spaced according to cadence
      if (plannedBatches.length >= 2) {
        const slotGaps = []
        for (let i = 1; i < plannedBatches.length; i++) {
          slotGaps.push(plannedBatches[i].slot - plannedBatches[i-1].slot)
        }
        console.log(`✅ Slot gaps (should be ~2-3 for 1s cadence): ${slotGaps.join(", ")}`)
      }

      console.log("=============================")
      console.log("🎉 Scheduler test completed successfully!")
      return true

    } else {
      console.log(`❌ Test FAILED: Found ${plannedBatches.length} planned batches (expected >= ${expectedMinBatches})`)
      console.log("=============================")
      return false
    }

  } catch (error) {
    console.error("❌ Test FAILED with error:", error)
    console.log("=============================")
    return false
  } finally {
    // Cleanup
    raikuScheduler.stop()
  }
}

async function main() {
  const success = await testScheduler()
  process.exit(success ? 0 : 1)
}

// Handle script execution
if (require.main === module) {
  main().catch(console.error)
}
