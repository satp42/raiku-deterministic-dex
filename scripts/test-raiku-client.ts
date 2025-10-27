#!/usr/bin/env tsx

/**
 * Test script for Raiku Client Mock
 * Verifies AOT reservations trigger callbacks with pre-confirmation and final-inclusion
 */

import { raikuClient } from "../apps/web/lib/raiku/client"

async function testAOTReservation() {
  console.log("🧪 Testing Raiku Client AOT Reservation...")
  console.log("=========================================")

  const receivedEvents: string[] = []
  const startTime = Date.now()

  // Set up receipt listener
  const unsubscribe = raikuClient.onReceipt((receipt) => {
    const elapsed = Date.now() - startTime
    console.log(`📨 [${elapsed}ms] ${receipt.type.toUpperCase()}: ${receipt.reservationId}`)

    if (receipt.type === "pre-confirmation") {
      console.log(`   ✅ Pre-confirmation received for slot ${receipt.slot}`)
    } else if (receipt.type === "final-inclusion") {
      console.log(`   ✅ Final inclusion received with tx: ${receipt.txHash}`)
    } else if (receipt.type === "failed") {
      console.log(`   ❌ Failed: ${receipt.error}`)
    }

    receivedEvents.push(receipt.type)

    // Check if we got both expected events
    if (receivedEvents.includes("pre-confirmation") && receivedEvents.includes("final-inclusion")) {
      console.log("\n🎉 Test PASSED: Both pre-confirmation and final-inclusion received!")
      console.log("=========================================")
      unsubscribe()
      process.exit(0)
    }
  })

  // Make AOT reservation
  console.log("📋 Making AOT reservation for slot 1000...")
  const { reservationId } = await raikuClient.reserveAOT("SOL-USDC", 1000)
  console.log(`📝 Reservation ID: ${reservationId}`)

  // Wait for events (should complete within 2 seconds)
  setTimeout(() => {
    console.log("\n❌ Test FAILED: Timeout - did not receive both events")
    console.log("Events received:", receivedEvents)
    console.log("=========================================")
    unsubscribe()
    process.exit(1)
  }, 3000)
}

// Test JIT as well
async function testJITRequest() {
  console.log("\n🧪 Testing Raiku Client JIT Request...")
  console.log("=========================================")

  const receivedEvents: string[] = []
  const startTime = Date.now()

  const unsubscribe = raikuClient.onReceipt((receipt) => {
    const elapsed = Date.now() - startTime
    console.log(`📨 [${elapsed}ms] ${receipt.type.toUpperCase()}: ${receipt.reservationId}`)

    if (receipt.type === "pre-confirmation") {
      console.log(`   ✅ JIT auction won for slot ${receipt.slot}`)
    } else if (receipt.type === "final-inclusion") {
      console.log(`   ✅ JIT final inclusion with tx: ${receipt.txHash}`)
    } else if (receipt.type === "failed") {
      console.log(`   ❌ JIT failed: ${receipt.error}`)
    }

    receivedEvents.push(receipt.type)

    // Check if we got the expected events (or failure)
    if (receivedEvents.includes("pre-confirmation") && receivedEvents.includes("final-inclusion")) {
      console.log("\n🎉 JIT Test PASSED: Won auction and got final inclusion!")
      console.log("=========================================")
      unsubscribe()
    } else if (receivedEvents.includes("failed")) {
      console.log("\n🎲 JIT Test RESULT: Lost auction (normal random behavior)")
      console.log("=========================================")
      unsubscribe()
    }
  })

  // Make JIT request
  console.log("⚡ Making JIT request with bid 1000...")
  const { reservationId } = await raikuClient.requestJIT("SOL-USDC", 1000)
  console.log(`📝 Reservation ID: ${reservationId}`)

  // Wait for events (should complete within 1 second)
  setTimeout(() => {
    console.log("\n⏰ JIT Test: Timeout reached")
    console.log("Events received:", receivedEvents)
    console.log("=========================================")
    unsubscribe()
  }, 1500)
}

// Run tests
async function main() {
  await testAOTReservation()
  await new Promise(resolve => setTimeout(resolve, 1000)) // Brief pause between tests
  await testJITRequest()
}

// Handle script execution
if (require.main === module) {
  main().catch(console.error)
}
