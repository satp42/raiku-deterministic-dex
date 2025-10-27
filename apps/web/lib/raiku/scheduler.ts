/**
 * Raiku Scheduler
 * Maintains rolling AOT slot reservations for each market's batch cadence
 */

import { prisma } from "../prisma"
import { raikuClient } from "./client"
import { BatchPlanStatus } from "@prisma/client"

export interface SchedulerConfig {
  /** Number of slots to plan ahead (e.g., 10 for 10 seconds of batches) */
  lookAheadSlots: number
  /** How often to check and plan (in ms) */
  planIntervalMs: number
  /** Slot duration in ms (400ms for Solana) */
  slotDurationMs: number
}

export class RaikuScheduler {
  private config: SchedulerConfig
  private intervalId?: NodeJS.Timeout
  private isRunning = false

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = {
      lookAheadSlots: 10,
      planIntervalMs: 2000, // Check every 2 seconds
      slotDurationMs: 400,  // Solana slot time
      ...config,
    }
  }

  /**
   * Start the scheduler loop
   */
  start(): void {
    if (this.isRunning) {
      console.warn("⚠️  Scheduler already running")
      return
    }

    console.log("🚀 Starting Raiku Scheduler...")
    console.log(`   Look ahead: ${this.config.lookAheadSlots} slots`)
    console.log(`   Plan interval: ${this.config.planIntervalMs}ms`)
    console.log(`   Slot duration: ${this.config.slotDurationMs}ms`)

    this.isRunning = true

    // Initial planning
    this.planAllMarkets()

    // Set up recurring planning
    this.intervalId = setInterval(() => {
      this.planAllMarkets()
    }, this.config.planIntervalMs)
  }

  /**
   * Stop the scheduler loop
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
    this.isRunning = false
    console.log("🛑 Raiku Scheduler stopped")
  }

  /**
   * Plan batches for all active markets
   */
  private async planAllMarkets(): Promise<void> {
    try {
      // Get all active markets
      const markets = await prisma.market.findMany({
        where: { active: true },
        include: {
          plannedBatches: {
            where: {
              status: {
                in: [BatchPlanStatus.PLANNED, BatchPlanStatus.INCLUSION_PUBLISHED]
              }
            },
            orderBy: { slot: "asc" }
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
      status: BatchPlanStatus
      raikuResId: string | null
    }>
  }): Promise<void> {
    try {
      const { id: marketId, symbol, cadenceSec, plannedBatches } = market

      // Get current slot (mock: based on current time)
      const currentSlot = this.getCurrentSlot()

      // Find the latest planned slot for this market
      const latestPlannedSlot = Math.max(
        0,
        ...plannedBatches.map(b => b.slot)
      )

      // Calculate how many slots we need to plan ahead
      const slotsToPlan = this.calculateSlotsToPlan(
        currentSlot,
        latestPlannedSlot,
        cadenceSec,
        this.config.lookAheadSlots
      )

      console.log(`📊 ${symbol}: Current slot ${currentSlot}, latest planned ${latestPlannedSlot}, need ${slotsToPlan.length} new batches`)

      for (const targetSlot of slotsToPlan) {
        await this.planSingleBatch(marketId, symbol, targetSlot)
      }
    } catch (error) {
      console.error(`❌ Error planning batches for market ${market.symbol}:`, error)
    }
  }

  /**
   * Plan a single batch at a specific slot
   */
  private async planSingleBatch(
    marketId: string,
    marketSymbol: string,
    targetSlot: number
  ): Promise<void> {
    try {
      // Check if batch already exists
      const existingBatch = await prisma.plannedBatch.findUnique({
        where: {
          marketId_slot: {
            marketId,
            slot: targetSlot
          }
        }
      })

      if (existingBatch) {
        // Already planned, skip
        return
      }

      // Calculate ETA from slot
      const eta = this.getSlotTime(targetSlot)

      console.log(`🎯 Planning ${marketSymbol} batch at slot ${targetSlot} (ETA: ${eta.toISOString()})`)

      // Reserve AOT slot using Raiku client
      const { reservationId } = await raikuClient.reserveAOT(marketSymbol, targetSlot)

      // Persist to database
      await prisma.plannedBatch.create({
        data: {
          marketId,
          slot: targetSlot,
          eta,
          status: BatchPlanStatus.PLANNED,
          raikuResId: reservationId
        }
      })

      console.log(`✅ ${marketSymbol} batch ${targetSlot} reserved (Raiku: ${reservationId})`)

    } catch (error) {
      console.error(`❌ Failed to plan batch for ${marketSymbol} slot ${targetSlot}:`, error)

      // Still create a record to track the failure
      try {
        const eta = this.getSlotTime(targetSlot)
        await prisma.plannedBatch.create({
          data: {
            marketId,
            slot: targetSlot,
            eta,
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
   * Calculate which slots need to be planned
   */
  private calculateSlotsToPlan(
    currentSlot: number,
    latestPlannedSlot: number,
    cadenceSec: number,
    lookAheadSlots: number
  ): number[] {
    const slotsToPlan: number[] = []

    // Start from the next slot after latest planned
    let nextSlot = Math.max(currentSlot + 1, latestPlannedSlot + 1)

    // Calculate slots based on cadence (cadenceSec seconds between batches)
    // Since slots are ~400ms, cadence of 1 second = ~2-3 slots
    const slotsPerCadence = Math.ceil((cadenceSec * 1000) / this.config.slotDurationMs)

    // Plan ahead for the specified number of slots
    for (let i = 0; i < lookAheadSlots; i++) {
      slotsToPlan.push(nextSlot + (i * slotsPerCadence))
    }

    return slotsToPlan
  }

  /**
   * Get current Solana slot (mock implementation)
   * In production, this would query Solana RPC for current slot
   */
  private getCurrentSlot(): number {
    return Math.floor(Date.now() / this.config.slotDurationMs)
  }

  /**
   * Get timestamp for a given slot
   */
  private getSlotTime(slot: number): Date {
    return new Date(slot * this.config.slotDurationMs)
  }

  /**
   * Get scheduler status
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
export const raikuScheduler = new RaikuScheduler()

// Export for testing
export { RaikuScheduler }
