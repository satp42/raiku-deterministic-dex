/**
 * Types for uniform price auction matching
 */

export type OrderSide = 'BUY' | 'SELL'
export type OrderType = 'MARKET' | 'LIMIT'

export interface Order {
  id: string
  side: OrderSide
  qty: number
  limitPx?: number // undefined for market orders
  timestamp: number
  type: OrderType
}

export interface Allocation {
  orderId: string
  filledQty: number
  fillPrice: number
}

export interface MatchingResult {
  clearingPrice: number
  allocations: Allocation[]
  totalVolume: number
}

export interface MatchingInput {
  buys: Order[]
  sells: Order[]
  tickSize: number
}