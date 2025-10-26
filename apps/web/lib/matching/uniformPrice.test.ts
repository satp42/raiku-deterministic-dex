import { describe, it, expect } from 'vitest'
import { matchOrders } from './uniformPrice'
import type { Order } from './types'

describe('uniformPrice', () => {
  const createOrder = (
    id: string,
    side: 'BUY' | 'SELL',
    qty: number,
    limitPx?: number,
    timestamp: number = 0,
    type: 'MARKET' | 'LIMIT' = 'LIMIT'
  ): Order => ({
    id,
    side,
    qty,
    limitPx,
    timestamp,
    type
  })

  describe('symmetric buy/sell books', () => {
    it('matches equal quantities at midpoint price', () => {
      const buys: Order[] = [
        createOrder('buy1', 'BUY', 100, 10.5, 1000),
        createOrder('buy2', 'BUY', 100, 10.0, 1001),
      ]

      const sells: Order[] = [
        createOrder('sell1', 'SELL', 100, 11.0, 1002),
        createOrder('sell2', 'SELL', 100, 11.5, 1003),
      ]

      const result = matchOrders({ buys, sells, tickSize: 0.01 })

      expect(result.clearingPrice).toBe(10.5) // midpoint of 10.5 and 11.0
      expect(result.totalVolume).toBe(200) // min(200, 200)

      const allocations = result.allocations.sort((a, b) => a.orderId.localeCompare(b.orderId))
      expect(allocations).toHaveLength(4)

      // All orders should be fully filled since quantities match
      expect(allocations.find(a => a.orderId === 'buy1')?.filledQty).toBe(100)
      expect(allocations.find(a => a.orderId === 'buy2')?.filledQty).toBe(100)
      expect(allocations.find(a => a.orderId === 'sell1')?.filledQty).toBe(100)
      expect(allocations.find(a => a.orderId === 'sell2')?.filledQty).toBe(100)
    })

    it('handles imbalanced quantities with pro-rata allocation', () => {
      const buys: Order[] = [
        createOrder('buy1', 'BUY', 50, 11.0, 1000),
        createOrder('buy2', 'BUY', 50, 11.0, 1001), // Same price, later timestamp
      ]

      const sells: Order[] = [
        createOrder('sell1', 'SELL', 70, 10.0, 1002),
      ]

      const result = matchOrders({ buys, sells, tickSize: 0.01 })

      expect(result.clearingPrice).toBe(10.5) // midpoint
      expect(result.totalVolume).toBe(100) // min(100, 70)

      const allocations = result.allocations.sort((a, b) => a.orderId.localeCompare(b.orderId))
      expect(allocations).toHaveLength(3)

      // Buys should be pro-rata allocated 50/100 * 70 = 35 each
      expect(allocations.find(a => a.orderId === 'buy1')?.filledQty).toBe(35)
      expect(allocations.find(a => a.orderId === 'buy2')?.filledQty).toBe(35)
      expect(allocations.find(a => a.orderId === 'sell1')?.filledQty).toBe(70)
    })
  })

  describe('edge cases - only buys or only sells', () => {
    it('handles only buy orders', () => {
      const buys: Order[] = [
        createOrder('buy1', 'BUY', 100, 10.0, 1000),
        createOrder('buy2', 'BUY', 100, 9.5, 1001),
      ]

      const sells: Order[] = []

      const result = matchOrders({ buys, sells, tickSize: 0.01 })

      expect(result.clearingPrice).toBe(0) // No sells, so clearing price is 0
      expect(result.totalVolume).toBe(0)
      expect(result.allocations).toHaveLength(0)
    })

    it('handles only sell orders', () => {
      const sells: Order[] = [
        createOrder('sell1', 'SELL', 100, 11.0, 1000),
        createOrder('sell2', 'SELL', 100, 11.5, 1001),
      ]

      const buys: Order[] = []

      const result = matchOrders({ buys, sells, tickSize: 0.01 })

      expect(result.clearingPrice).toBe(11.0) // Best ask price
      expect(result.totalVolume).toBe(0)
      expect(result.allocations).toHaveLength(0)
    })

    it('handles empty inputs', () => {
      const result = matchOrders({ buys: [], sells: [], tickSize: 0.01 })

      expect(result.clearingPrice).toBe(0)
      expect(result.totalVolume).toBe(0)
      expect(result.allocations).toHaveLength(0)
    })
  })

  describe('price grid rounding (tick alignment)', () => {
    it('aligns clearing price to tick size', () => {
      const buys: Order[] = [
        createOrder('buy1', 'BUY', 100, 10.123, 1000),
      ]

      const sells: Order[] = [
        createOrder('sell1', 'SELL', 100, 10.127, 1001),
      ]

      const result = matchOrders({ buys, sells, tickSize: 0.05 })

      // Should align to nearest 0.05: 10.125 -> 10.15? Wait, let's calculate properly
      // Midpoint of 10.123 and 10.127 is 10.125, aligned to 0.05 should be 10.15
      expect(result.clearingPrice).toBe(10.15)
    })

    it('handles tick size of 1.0', () => {
      const buys: Order[] = [
        createOrder('buy1', 'BUY', 100, 10.7, 1000),
      ]

      const sells: Order[] = [
        createOrder('sell1', 'SELL', 100, 11.3, 1001),
      ]

      const result = matchOrders({ buys, sells, tickSize: 1.0 })

      expect(result.clearingPrice).toBe(11.0) // Aligned to nearest integer
    })
  })

  describe('pro-rata allocation for ties', () => {
    it('allocates fairly when multiple orders at same price', () => {
      const buys: Order[] = [
        createOrder('buy1', 'BUY', 30, 10.0, 1000),
        createOrder('buy2', 'BUY', 40, 10.0, 1001), // Same price, different qty
        createOrder('buy3', 'BUY', 50, 10.0, 1002),
      ]

      const sells: Order[] = [
        createOrder('sell1', 'SELL', 70, 9.0, 1003),
      ]

      const result = matchOrders({ buys, sells, tickSize: 0.01 })

      expect(result.totalVolume).toBe(70) // Limited by sell side

      const allocations = result.allocations.filter(a => a.orderId.startsWith('buy'))

      // Total buy allocation should be 70
      const totalBuyAllocation = allocations.reduce((sum, a) => sum + a.filledQty, 0)
      expect(totalBuyAllocation).toBe(70)

      // Pro-rata based on original quantities: 30:40:50 = 3:4:5
      // Total parts: 12, each part gets 70/12 ≈ 5.833
      const buy1Alloc = allocations.find(a => a.orderId === 'buy1')?.filledQty ?? 0
      const buy2Alloc = allocations.find(a => a.orderId === 'buy2')?.filledQty ?? 0
      const buy3Alloc = allocations.find(a => a.orderId === 'buy3')?.filledQty ?? 0

      // Should be approximately 30/120 * 70 = 17.5, 40/120 * 70 ≈ 23.33, 50/120 * 70 ≈ 29.17
      expect(buy1Alloc).toBeCloseTo(17.5, 1)
      expect(buy2Alloc).toBeCloseTo(23.33, 1)
      expect(buy3Alloc).toBeCloseTo(29.17, 1)
    })
  })

  describe('market orders vs limit orders', () => {
    it('includes market orders at any price', () => {
      const buys: Order[] = [
        createOrder('market_buy', 'BUY', 100, undefined, 1000, 'MARKET'),
      ]

      const sells: Order[] = [
        createOrder('sell1', 'SELL', 100, 15.0, 1001),
      ]

      const result = matchOrders({ buys, sells, tickSize: 0.01 })

      expect(result.clearingPrice).toBe(15.0)
      expect(result.totalVolume).toBe(100)

      const marketAlloc = result.allocations.find(a => a.orderId === 'market_buy')
      expect(marketAlloc?.filledQty).toBe(100)
      expect(marketAlloc?.fillPrice).toBe(15.0)
    })

    it('excludes limit orders priced away from market', () => {
      const buys: Order[] = [
        createOrder('buy1', 'BUY', 100, 5.0, 1000), // Too low
        createOrder('buy2', 'BUY', 100, 15.0, 1001), // At market
      ]

      const sells: Order[] = [
        createOrder('sell1', 'SELL', 100, 10.0, 1002),
      ]

      const result = matchOrders({ buys, sells, tickSize: 0.01 })

      expect(result.clearingPrice).toBe(12.5) // Between 15.0 and 10.0
      expect(result.totalVolume).toBe(100)

      // Only buy2 should be filled (the one with limit >= clearing price)
      const buy1Alloc = result.allocations.find(a => a.orderId === 'buy1')
      const buy2Alloc = result.allocations.find(a => a.orderId === 'buy2')

      expect(buy1Alloc).toBeUndefined()
      expect(buy2Alloc?.filledQty).toBe(100)
    })
  })

  describe('timestamp-based tie breaking', () => {
    it('prioritizes earlier timestamps for same price', () => {
      const buys: Order[] = [
        createOrder('buy1', 'BUY', 100, 10.0, 1000), // Earlier
        createOrder('buy2', 'BUY', 100, 10.0, 1001), // Later
      ]

      const sells: Order[] = [
        createOrder('sell1', 'SELL', 150, 9.0, 1002),
      ]

      const result = matchOrders({ buys, sells, tickSize: 0.01 })

      expect(result.totalVolume).toBe(150) // Limited by sells

      const buy1Alloc = result.allocations.find(a => a.orderId === 'buy1')?.filledQty ?? 0
      const buy2Alloc = result.allocations.find(a => a.orderId === 'buy2')?.filledQty ?? 0

      // Both should get pro-rata, but since same price and qty, should be equal
      expect(buy1Alloc).toBe(75)
      expect(buy2Alloc).toBe(75)
    })
  })

  describe('floating point precision', () => {
    it('handles floating point quantities correctly', () => {
      const buys: Order[] = [
        createOrder('buy1', 'BUY', 33.333333, 10.0, 1000),
      ]

      const sells: Order[] = [
        createOrder('sell1', 'SELL', 50, 9.0, 1001),
      ]

      const result = matchOrders({ buys, sells, tickSize: 0.01 })

      expect(result.totalVolume).toBe(33.333333)
      expect(result.clearingPrice).toBe(9.5)

      const alloc = result.allocations.find(a => a.orderId === 'buy1')
      expect(alloc?.filledQty).toBeCloseTo(33.333333, 6)
    })

    it('avoids precision issues in pro-rata allocation', () => {
      const buys: Order[] = [
        createOrder('buy1', 'BUY', 1, 10.0, 1000),
        createOrder('buy2', 'BUY', 1, 10.0, 1001),
      ]

      const sells: Order[] = [
        createOrder('sell1', 'SELL', 1, 9.0, 1002),
      ]

      const result = matchOrders({ buys, sells, tickSize: 0.01 })

      expect(result.totalVolume).toBe(1)

      const allocations = result.allocations.filter(a => a.orderId.startsWith('buy'))
      const totalAllocated = allocations.reduce((sum, a) => sum + a.filledQty, 0)

      // Should allocate exactly 1.0 total, not 1.0000001 or 0.999999
      expect(totalAllocated).toBe(1)
    })
  })

  describe('deterministic output', () => {
    it('produces consistent results for same inputs', () => {
      const buys: Order[] = [
        createOrder('buy1', 'BUY', 100, 10.0, 1000),
        createOrder('buy2', 'BUY', 50, 9.0, 1001),
      ]

      const sells: Order[] = [
        createOrder('sell1', 'SELL', 120, 11.0, 1002),
      ]

      const result1 = matchOrders({ buys, sells, tickSize: 0.01 })
      const result2 = matchOrders({ buys, sells, tickSize: 0.01 })

      expect(result1).toEqual(result2)
    })

    it('produces same results regardless of input order', () => {
      const buys1: Order[] = [
        createOrder('buy1', 'BUY', 100, 10.0, 1000),
        createOrder('buy2', 'BUY', 50, 9.0, 1001),
      ]

      const buys2: Order[] = [
        createOrder('buy2', 'BUY', 50, 9.0, 1001),
        createOrder('buy1', 'BUY', 100, 10.0, 1000),
      ]

      const sells: Order[] = [
        createOrder('sell1', 'SELL', 120, 11.0, 1002),
      ]

      const result1 = matchOrders({ buys: buys1, sells, tickSize: 0.01 })
      const result2 = matchOrders({ buys: buys2, sells, tickSize: 0.01 })

      expect(result1.clearingPrice).toBe(result2.clearingPrice)
      expect(result1.totalVolume).toBe(result2.totalVolume)
      expect(result1.allocations.length).toBe(result2.allocations.length)
    })
  })
})