/**
 * Mock Raiku SDK Client
 * Provides deterministic execution guarantees via AOT and JIT slot reservations
 */

export interface RaikuReceipt {
  type: "pre-confirmation" | "final-inclusion" | "failed"
  reservationId: string
  slot?: number
  timestamp: number
  txHash?: string
  error?: string
}

export interface AOTReservation {
  reservationId: string
  market: string
  slot: number
  eta: number
  status: "pending" | "pre-confirmed" | "finalized" | "failed"
}

export interface JITBid {
  reservationId: string
  market: string
  slot: number
  bidAmount: number
  status: "pending" | "won" | "lost" | "failed"
}

export class RaikuClient {
  private mock = true
  private receiptCallbacks: ((receipt: RaikuReceipt) => void)[] = []
  private reservations: Map<string, AOTReservation | JITBid> = new Map()

  constructor(options: { mock?: boolean } = {}) {
    this.mock = options.mock ?? true
  }

  /**
   * Reserve an Ahead-of-Time slot for deterministic execution
   */
  async reserveAOT(
    market: string,
    targetSlot: number
  ): Promise<{ reservationId: string }> {
    const reservationId = `aot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const reservation: AOTReservation = {
      reservationId,
      market,
      slot: targetSlot,
      eta: Date.now() + 1000, // Mock ETA 1 second from now
      status: "pending"
    }

    this.reservations.set(reservationId, reservation)

    if (this.mock) {
      // Simulate pre-confirmation after 100ms
      setTimeout(() => {
        if (this.reservations.has(reservationId)) {
          const receipt: RaikuReceipt = {
            type: "pre-confirmation",
            reservationId,
            slot: targetSlot,
            timestamp: Date.now()
          }

          this.receiptCallbacks.forEach(cb => cb(receipt))
        }
      }, 100)

      // Simulate final inclusion after 1000ms
      setTimeout(() => {
        if (this.reservations.has(reservationId)) {
          const receipt: RaikuReceipt = {
            type: "final-inclusion",
            reservationId,
            slot: targetSlot,
            timestamp: Date.now(),
            txHash: `mock_tx_${reservationId}`
          }

          // Update reservation status
          const res = this.reservations.get(reservationId) as AOTReservation
          if (res) {
            res.status = "finalized"
          }

          this.receiptCallbacks.forEach(cb => cb(receipt))
        }
      }, 1000)
    }

    return { reservationId }
  }

  /**
   * Bid for Just-in-Time execution in the next available slot
   */
  async requestJIT(
    market: string,
    bidAmount: number
  ): Promise<{ reservationId: string }> {
    const reservationId = `jit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const reservation: JITBid = {
      reservationId,
      market,
      slot: Math.floor(Date.now() / 400) + 1, // Next slot
      bidAmount,
      status: "pending"
    }

    this.reservations.set(reservationId, reservation)

    if (this.mock) {
      // Simulate JIT auction result after 50ms (faster than AOT)
      setTimeout(() => {
        if (this.reservations.has(reservationId)) {
          // Mock auction - assume we win 90% of the time
          const won = Math.random() > 0.1

          const receipt: RaikuReceipt = won
            ? {
                type: "pre-confirmation",
                reservationId,
                slot: reservation.slot,
                timestamp: Date.now()
              }
            : {
                type: "failed",
                reservationId,
                timestamp: Date.now(),
                error: "Outbid in JIT auction"
              }

          // Update status
          const res = this.reservations.get(reservationId) as JITBid
          if (res) {
            res.status = won ? "won" : "lost"
          }

          this.receiptCallbacks.forEach(cb => cb(receipt))

          if (won) {
            // Follow up with final inclusion after 200ms
            setTimeout(() => {
              if (this.reservations.has(reservationId)) {
                const finalReceipt: RaikuReceipt = {
                  type: "final-inclusion",
                  reservationId,
                  slot: reservation.slot,
                  timestamp: Date.now(),
                  txHash: `mock_tx_${reservationId}`
                }

                this.receiptCallbacks.forEach(cb => cb(finalReceipt))
              }
            }, 200)
          }
        }
      }, 50)
    }

    return { reservationId }
  }

  /**
   * Subscribe to receipt events (pre-confirmations, finalizations, failures)
   */
  onReceipt(callback: (receipt: RaikuReceipt) => void): () => void {
    this.receiptCallbacks.push(callback)

    // Return unsubscribe function
    return () => {
      const index = this.receiptCallbacks.indexOf(callback)
      if (index > -1) {
        this.receiptCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * Get reservation status
   */
  getReservation(reservationId: string): AOTReservation | JITBid | undefined {
    return this.reservations.get(reservationId)
  }

  /**
   * List all active reservations
   */
  getAllReservations(): (AOTReservation | JITBid)[] {
    return Array.from(this.reservations.values())
  }

  /**
   * Clean up expired reservations (for testing)
   */
  clearReservations(): void {
    this.reservations.clear()
  }
}

// Export singleton instance for easy use
export const raikuClient = new RaikuClient({ mock: true })

// Export types for external use
export type { AOTReservation, JITBid, RaikuReceipt }
