/**
 * Uniform Price Auction Matching Engine
 *
 * Implements a deterministic batch auction where all trades execute
 * at a single clearing price. Handles market and limit orders with
 * pro-rata allocation for ties.
 */

import type { Order, Allocation, MatchingResult, MatchingInput } from './types'

/**
 * Sorts buy orders by price (highest first) then timestamp (earliest first)
 */
function sortBuys(buys: Order[]): Order[] {
  return [...buys].sort((a, b) => {
    // First sort by price (highest first)
    // Market orders treated as infinite price for buys
    const priceA = a.limitPx ?? Infinity
    const priceB = b.limitPx ?? Infinity
    if (priceA !== priceB) {
      return priceB - priceA
    }
    // Then by timestamp (earliest first)
    return a.timestamp - b.timestamp
  })
}

/**
 * Sorts sell orders by price (lowest first) then timestamp (earliest first)
 */
function sortSells(sells: Order[]): Order[] {
  return [...sells].sort((a, b) => {
    // First sort by price (lowest first)
    // Market orders treated as zero price for sells
    const priceA = a.limitPx ?? 0
    const priceB = b.limitPx ?? 0
    if (priceA !== priceB) {
      return priceA - priceB
    }
    // Then by timestamp (earliest first)
    return a.timestamp - b.timestamp
  })
}

/**
 * Aligns price to the nearest tick size
 */
function alignToTick(price: number, tickSize: number): number {
  if (!isFinite(price)) return price
  return Math.round(price / tickSize) * tickSize
}

/**
 * Finds the uniform clearing price where buy and sell curves intersect
 */
function findClearingPrice(buys: Order[], sells: Order[], tickSize: number): number {
  if (buys.length === 0 && sells.length === 0) return 0
  if (buys.length === 0) return alignToTick(sells[0]?.limitPx ?? 0, tickSize)
  if (sells.length === 0) return 0 // Only buys: no clearing price (no trades)

  const sortedBuys = sortBuys(buys)
  const sortedSells = sortSells(sells)

  // Get all unique price levels from limit orders
  const allPrices = new Set<number>()
  buys.forEach(buy => buy.limitPx !== undefined && allPrices.add(buy.limitPx))
  sells.forEach(sell => sell.limitPx !== undefined && allPrices.add(sell.limitPx))

  const priceLevels = Array.from(allPrices).sort((a, b) => a - b)

  if (priceLevels.length === 0) {
    // All market orders - use a reasonable price between best bid/ask
    const bestBid = sortedBuys[0]?.limitPx ?? Infinity
    const bestAsk = sortedSells[0]?.limitPx ?? 0
    return alignToTick((bestBid + bestAsk) / 2, tickSize)
  }

  // Find intersection point by walking through price levels
  // Sort all orders by price to find the crossing point
  const allOrders = [...buys, ...sells]
    .filter(order => order.limitPx !== undefined)
    .sort((a, b) => (a.limitPx ?? 0) - (b.limitPx ?? 0))

  let cumulativeBuy = 0
  let cumulativeSell = 0
  let clearingPrice = 0

  // Group orders by price levels
  const priceGroups: { [price: number]: { buys: Order[], sells: Order[] } } = {}

  for (const order of allOrders) {
    const price = order.limitPx!
    if (!priceGroups[price]) {
      priceGroups[price] = { buys: [], sells: [] }
    }
    if (order.side === 'BUY') {
      priceGroups[price].buys.push(order)
    } else {
      priceGroups[price].sells.push(order)
    }
  }

  // Also handle market orders
  const marketBuys = buys.filter(buy => buy.limitPx === undefined)
  const marketSells = sells.filter(sell => sell.limitPx === undefined)

  // Walk through price levels from lowest to highest
  const sortedPrices = Object.keys(priceGroups).map(Number).sort((a, b) => a - b)

  for (const price of sortedPrices) {
    const group = priceGroups[price]

    // Add sells at this price level (sells are willing to sell at this price or lower)
    cumulativeSell += group.sells.reduce((sum, sell) => sum + sell.qty, 0)

    // Check for crossing before adding buys
    if (cumulativeBuy >= cumulativeSell && cumulativeSell > 0) {
      clearingPrice = price
      break
    }

    // Add buys at this price level (buys are willing to buy at this price or higher)
    cumulativeBuy += group.buys.reduce((sum, buy) => sum + buy.qty, 0)
  }

  // If no crossing found in limit orders, check if market orders create a crossing
  if (clearingPrice === 0 && (marketBuys.length > 0 || marketSells.length > 0)) {
    // Add market orders to the accumulation
    cumulativeBuy += marketBuys.reduce((sum, buy) => sum + buy.qty, 0)
    cumulativeSell += marketSells.reduce((sum, sell) => sum + sell.qty, 0)

    if (cumulativeBuy >= cumulativeSell && cumulativeSell > 0) {
      // Use midpoint of best bid and ask for market orders
      const bestBid = Math.max(...buys.map(b => b.limitPx ?? 0), 0)
      const bestAsk = Math.min(...sells.map(s => s.limitPx ?? Infinity), Infinity)
      clearingPrice = (bestBid + bestAsk) / 2
    }
  }

  return alignToTick(clearingPrice, tickSize)
}

/**
 * Performs pro-rata allocation for orders at the same price level
 */
function allocateProRata(
  orders: Order[],
  availableQty: number,
  clearingPrice: number
): Allocation[] {
  if (availableQty <= 0 || orders.length === 0) return []

  const totalQty = orders.reduce((sum, order) => sum + order.qty, 0)

  if (totalQty <= availableQty) {
    // All orders can be fully filled
    return orders.map(order => ({
      orderId: order.id,
      filledQty: order.qty,
      fillPrice: clearingPrice
    }))
  }

  // Pro-rata allocation with precision handling
  const allocations: Allocation[] = []
  let remaining = availableQty

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i]
    const isLast = i === orders.length - 1

    if (isLast) {
      // Give remaining to last order to avoid rounding errors
      allocations.push({
        orderId: order.id,
        filledQty: remaining,
        fillPrice: clearingPrice
      })
    } else {
      const filledQty = (order.qty * availableQty) / totalQty
      const roundedQty = Math.floor(filledQty * 1e9) / 1e9
      allocations.push({
        orderId: order.id,
        filledQty: roundedQty,
        fillPrice: clearingPrice
      })
      remaining -= roundedQty
    }
  }

  return allocations
}

/**
 * Main uniform price auction matching function
 */
export function matchOrders(input: MatchingInput): MatchingResult {
  const { buys, sells, tickSize } = input

  // Handle edge cases
  if (buys.length === 0 && sells.length === 0) {
    return {
      clearingPrice: 0,
      allocations: [],
      totalVolume: 0
    }
  }

  const clearingPrice = findClearingPrice(buys, sells, tickSize)

  // Filter orders that can participate at clearing price
  const validBuys = buys.filter(buy =>
    buy.side === 'BUY' && (
      buy.type === 'MARKET' ||
      (buy.limitPx !== undefined && buy.limitPx >= clearingPrice)
    )
  )

  const validSells = sells.filter(sell =>
    sell.side === 'SELL' && (
      sell.type === 'MARKET' ||
      (sell.limitPx !== undefined && sell.limitPx <= clearingPrice)
    )
  )

  if (validBuys.length === 0 || validSells.length === 0) {
    return {
      clearingPrice,
      allocations: [],
      totalVolume: 0
    }
  }

  const sortedBuys = sortBuys(validBuys)
  const sortedSells = sortSells(validSells)

  // Calculate total volume at clearing price
  const totalBuyVolume = sortedBuys.reduce((sum, buy) => sum + buy.qty, 0)
  const totalSellVolume = sortedSells.reduce((sum, sell) => sum + sell.qty, 0)
  const totalVolume = Math.min(totalBuyVolume, totalSellVolume)

  // Allocate pro-rata at clearing price
  const buyAllocations = allocateProRata(sortedBuys, totalVolume, clearingPrice)
  const sellAllocations = allocateProRata(sortedSells, totalVolume, clearingPrice)

  return {
    clearingPrice,
    allocations: [...buyAllocations, ...sellAllocations],
    totalVolume
  }
}