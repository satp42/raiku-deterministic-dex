/**
 * Shared TypeScript types for Fairlane DEX
 */

// Re-export Prisma enums and types
export { Side, OrderStatus, BatchPlanStatus } from "@prisma/client"
export type { User, Market, Order, PlannedBatch, Batch, Fill } from "@prisma/client"

export interface OrderCommitment {
  readonly id: string
  readonly commitment: string
  readonly marketId: string
  readonly side: Side
  readonly qty: string
  readonly limitPx?: string
  readonly createdAt: Date
  readonly status: OrderStatus
}

export interface Market {
  readonly id: string
  readonly symbol: string
  readonly baseMint: string
  readonly quoteMint: string
  readonly tickSize: string
  readonly cadenceSec: number
  readonly feeBps: number
}

export interface PlannedBatch {
  readonly id: string
  readonly marketId: string
  readonly slot: number
  readonly eta: Date
  readonly status: BatchPlanStatus
  readonly raikuResId?: string
  readonly merkleRoot?: string
}

export interface Batch {
  readonly id: string
  readonly marketId: string
  readonly slot: number
  readonly merkleRoot: string
  readonly clearingPx: string
  readonly totalBase: string
  readonly totalQuote: string
  readonly txSig: string
  readonly createdAt: Date
}

export interface Fill {
  readonly id: string
  readonly orderId: string
  readonly batchId: string
  readonly filledQty: string
  readonly avgFillPx: string
}

// SSE Event types
export interface CountdownEvent {
  readonly type: "COUNTDOWN_TICK"
  readonly market: string
  readonly slot: number
  readonly eta: string
  readonly remainingMs: number
}

export interface InclusionPublishedEvent {
  readonly type: "INCLUSION_PUBLISHED"
  readonly market: string
  readonly slot: number
  readonly merkleRoot: string
  readonly orderIds: string[]
}

export interface BatchSettledEvent {
  readonly type: "BATCH_SETTLED"
  readonly market: string
  readonly slot: number
  readonly clearingPx: string
  readonly fills: Fill[]
}

export type SSEEvent = CountdownEvent | InclusionPublishedEvent | BatchSettledEvent

// Raiku types
export interface RaikuReservation {
  readonly reservationId: string
  readonly slot: number
  readonly eta: Date
  readonly status: "PENDING" | "CONFIRMED" | "INCLUDED" | "FAILED"
}

export interface RaikuReceipt {
  readonly reservationId: string
  readonly slot: number
  readonly status: "PRE_CONFIRMED" | "FINAL_INCLUSION"
  readonly timestamp: Date
}

