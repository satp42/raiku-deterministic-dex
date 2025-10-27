/**
 * Batch Planner Service
 * Uses Raiku SDK to reserve AOT slots and manages PlannedBatch lifecycle
 */

import { prisma } from "../../apps/web/lib/prisma"
import { raikuClient } from "../../apps/web/lib/raiku/client"
import { BatchPlanStatus } from "@prisma/client"

export interface BatchPlanConfig {
  /** Number of future batches to maintain per market */
  lookAheadBatches: number
  /** How often to check and plan (in ms) */
  planIntervalMs: number
  /** Lead time before batch ETA to stop accepting orders (ms) */
  cutoffLeadMs: number
}

export class BatchPlanner {
  private config: BatchPlanConfig
  private intervalId?: NodeJS.Timeout
  private isRunning = false

  constructor(config: Partial<BatchPlanConfig> = {}) {
    this.config = {
      lookAheadBatches: 10,
      planIntervalMs: 1000, // Check every 1 second
      cutoffLeadMs: 500,    // Stop accepting orders 500ms before batch
      ...config,
    }
  }

  /**
   * Start the batch planning loop
   */
  start(): void {
    if (this.isRunning) {
      console.warn("⚠️  Batch planner already running")
      return
    }

    console.log("🗓️  Starting Batch Planner...")
    console.log(`   Look ahead: ${this.config.lookAheadBatches} batches`)
    console.log(`   Plan interval: ${this.config.planIntervalMs}ms`)
    console.log(`   Cutoff lead: ${this.config.cutoffLeadMs}ms`)

    this.isRunning = true

    // Initial planning
    this.planAllMarkets()

    // Set up recurring planning
    this.intervalId = setInterval(() => {
      this.planAllMarkets()
    }, this.config.planIntervalMs)
  }

  /**
   * Stop the batch planning loop
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
    this.isRunning = false
    console.log("🛑 Batch planner stopped")
  }

  /**
   * Plan batches for all active markets
   */
  private async planAllMarkets(): Promise<void> {
    try {
      // Get all active markets with their current planned batches
      const markets = await prisma.market.findMany({
        where: { active: true },
        include: {
          plannedBatches: {
            where: {
              status: {
                in: [BatchPlanStatus.PLANNED, BatchPlanStatus.INCLUSION_PUBLISHED]
              }
            },
            orderBy: { eta: "asc" }
          }
        }
      })

      console.log(`📋 Planning batches for ${markets.length} markets`)

      for (const market of markets) {
        await this.planMarketBatches(market)
      }
    } catch (error) {
      console.error("❌ Error in planAllMarkets:", error)
    }
  }

  /**
   * Plan future batches for a specific market
   */
  private async planMarketBatches(market: {
    id: string
    symbol: string
    cadenceSec: number
    plannedBatches: Array<{
      id: string
      slot: number
      eta: Date
      status: BatchPlanStatus
      raikuResId: string | null
    }>
  }): Promise<void> {
    try {
      const { id: marketId, symbol, cadenceSec, plannedBatches } = market

      // Get current time
      const now = new Date()

      // Find the latest planned batch that's still in the future
      const futureBatches = plannedBatches.filter(b => b.eta > now)
      const latestFutureBatch = futureBatches.length > 0
        ? futureBatches.reduce((latest, current) =>
            current.eta > latest.eta ? current : latest
          )
        : null

      // Calculate how many batches we need to plan
      const batchesToPlan = this.calculateBatchesToPlan(
        now,
        latestFutureBatch,
        cadenceSec,
        this.config.lookAheadBatches
      )

      console.log(`📊 ${symbol}: ${futureBatches.length} future batches, need ${batchesToPlan.length} new`)

      for (const batchTime of batchesToPlan) {
        await this.planSingleBatch(marketId, symbol, batchTime)
      }
    } catch (error) {
      console.error(`❌ Error planning batches for market ${market.symbol}:`, error)
    }
  }

  /**
   * Plan a single batch at a specific time
   */
  private async planSingleBatch(
    marketId: string,
    marketSymbol: string,
    batchTime: Date
  ): Promise<void> {
    try {
      // Check if batch already exists for this time
      const existingBatch = await prisma.plannedBatch.findFirst({
        where: {
          marketId,
          eta: {
            gte: new Date(batchTime.getTime() - 100), // 100ms tolerance
            lte: new Date(batchTime.getTime() + 100)
          }
        }
      })

      if (existingBatch) {
        // Already planned, skip
        return
      }

      // Calculate slot from time (mock: 400ms per slot)
      const slotDurationMs = 400
      const targetSlot = Math.floor(batchTime.getTime() / slotDurationMs)

      console.log(`🎯 Planning ${marketSymbol} batch at ${batchTime.toISOString()} (slot ${targetSlot})`)

      // Reserve AOT slot using Raiku client
      const { reservationId } = await raikuClient.reserveAOT(marketSymbol, targetSlot)

      // Persist to database
      await prisma.plannedBatch.create({
        data: {
          marketId,
          slot: targetSlot,
          eta: batchTime,
          status: BatchPlanStatus.PLANNED,
          raikuResId: reservationId
        }
      })

      console.log(`✅ ${marketSymbol} batch ${targetSlot} reserved (Raiku: ${reservationId})`)

    } catch (error) {
      console.error(`❌ Failed to plan batch for ${marketSymbol} at ${batchTime.toISOString()}:`, error)

      // Still create a record to track the failure
      try {
        const slotDurationMs = 400
        const targetSlot = Math.floor(batchTime.getTime() / slotDurationMs)

        await prisma.plannedBatch.create({
          data: {
            marketId,
            slot: targetSlot,
            eta: batchTime,
            status: BatchPlanStatus.FAILED,
            raikuResId: null
          }
        })
      } catch (dbError) {
        console.error("❌ Failed to create failed batch record:", dbError)
      }
    }
  }

  /**
   * Calculate which batch times need to be planned
   */
  private calculateBatchesToPlan(
    now: Date,
    latestFutureBatch: { eta: Date } | null,
    cadenceSec: number,
    lookAheadBatches: number
  ): Date[] {
    const batchTimes: Date[] = []

    // Start from either now + cadence, or after the latest planned batch
    let nextBatchTime: Date
    if (latestFutureBatch) {
      nextBatchTime = new Date(latestFutureBatch.eta.getTime() + (cadenceSec * 1000))
    } else {
      nextBatchTime = new Date(now.getTime() + (cadenceSec * 1000))
    }

    // Plan the specified number of batches ahead
    for (let i = 0; i < lookAheadBatches; i++) {
      batchTimes.push(new Date(nextBatchTime.getTime() + (i * cadenceSec * 1000)))
    }

    return batchTimes
  }

  /**
   * Get the cutoff time for a batch (when to stop accepting orders)
   */
  getBatchCutoffTime(batchTime: Date): Date {
    return new Date(batchTime.getTime() - this.config.cutoffLeadMs)
  }

  /**
   * Find the next batch for order assignment
   */
  async findNextBatchForOrder(marketId: string): Promise<{
    batch: { id: string; slot: number; eta: Date } | null
    cutoffTime: Date
  }> {
    try {
      const now = new Date()

      const nextBatch = await prisma.plannedBatch.findFirst({
        where: {
          marketId,
          status: BatchPlanStatus.PLANNED,
          eta: {
            gt: new Date(now.getTime() + this.config.cutoffLeadMs)
          }
        },
        orderBy: { eta: "asc" }
      })

      if (!nextBatch) {
        return { batch: null, cutoffTime: now }
      }

      return {
        batch: {
          id: nextBatch.id,
          slot: nextBatch.slot,
          eta: nextBatch.eta
        },
        cutoffTime: this.getBatchCutoffTime(nextBatch.eta)
      }
    } catch (error) {
      console.error("❌ Error finding next batch:", error)
      return { batch: null, cutoffTime: new Date() }
    }
  }

  /**
   * Get planner status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      nextCheck: this.intervalId ? new Date(Date.now() + this.config.planIntervalMs) : null
    }
  }

  /**
   * Force a planning cycle (useful for testing)
   */
  async forcePlan(): Promise<void> {
    await this.planAllMarkets()
  }
}

// Export singleton instance
export const batchPlanner = new BatchPlanner()

// Export for testing
export { BatchPlanner }
