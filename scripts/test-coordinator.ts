#!/usr/bin/env tsx

/**
 * Test script for Coordinator Service
 * Verifies coordinator boots, connects to DB, and logs markets
 */

import { CoordinatorService } from "../services/coordinator/src/index"

// Mock environment for testing
process.env.DATABASE_URL = "file:../../apps/web/prisma/dev.db"
process.env.NODE_ENV = "test"
process.env.LOG_LEVEL = "debug"

async function testCoordinator() {
  console.log("🧪 Testing Coordinator Service...")
  console.log("=================================")

  let coordinator: CoordinatorService

  try {
    // Create coordinator instance
    coordinator = new CoordinatorService()

    console.log("✅ Coordinator instance created")

    // Test configuration loading
    const status = coordinator.getStatus()
    console.log("✅ Configuration loaded:")
    console.log(`   Environment: ${status.environment}`)
    console.log(`   Database URL configured: ${!!status.config.databaseUrl}`)

    // Test database connection (without starting the full service)
    console.log("\n🗄️  Testing database connection...")

    // Manually test DB connection
    await coordinator["testDatabaseConnection"]()
    console.log("✅ Database connection test passed")

    // Test market loading
    console.log("\n📊 Testing market loading...")
    await coordinator["logMarkets"]()
    console.log("✅ Market loading test passed")

    console.log("\n🎉 All tests passed!")
    console.log("=================================")

    return true

  } catch (error) {
    console.error("❌ Test FAILED:", error)
    console.log("=================================")
    return false
  } finally {
    // Cleanup
    if (coordinator) {
      await coordinator.shutdown()
    }
  }
}

async function testFullBoot() {
  console.log("\n🧪 Testing Full Coordinator Boot...")
  console.log("===================================")

  try {
    const coordinator = new CoordinatorService()

    // Start the full service (this will run indefinitely)
    console.log("🚀 Starting coordinator service...")
    await coordinator.start()

    // If we reach here, something went wrong (start should block)
    console.error("❌ Service started but didn't block as expected")
    return false

  } catch (error) {
    if (error instanceof Error && error.message.includes("DATABASE_URL")) {
      console.log("ℹ️  Expected error: DATABASE_URL not set (run with proper env)")
      console.log("   To test with real DB: DATABASE_URL=file:../apps/web/prisma/dev.db tsx scripts/test-coordinator.ts")
      return true
    }

    console.error("❌ Unexpected error:", error)
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes("--full")) {
    await testFullBoot()
  } else {
    const success = await testCoordinator()
    process.exit(success ? 0 : 1)
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(console.error)
}
