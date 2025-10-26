import type { Context } from '../context'

export const resolvers = {
  Query: {
    markets: async (_: any, __: any, context: Context) => {
      return await context.prisma.market.findMany({
        where: { active: true }
      })
    },

    market: async (_: any, { symbol }: { symbol: string }, context: Context) => {
      return await context.prisma.market.findUnique({
        where: { symbol }
      })
    },

    nextBatch: async (_: any, { symbol }: { symbol: string }, context: Context) => {
      const market = await context.prisma.market.findUnique({
        where: { symbol }
      })

      if (!market) return null

      // Find the next planned batch for this market
      return await context.prisma.plannedBatch.findFirst({
        where: {
          marketId: market.id,
          status: 'PLANNED'
        },
        orderBy: {
          slot: 'asc'
        }
      })
    },

    orderStatus: async (_: any, { orderId }: { orderId: string }, context: Context) => {
      return await context.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: true,
          market: true,
          plannedBatch: true
        }
      })
    },

    batchHistory: async (_: any, { symbol, limit }: { symbol: string, limit: number }, context: Context) => {
      const market = await context.prisma.market.findUnique({
        where: { symbol }
      })

      if (!market) return []

      return await context.prisma.batch.findMany({
        where: {
          marketId: market.id
        },
        include: {
          market: true
        },
        orderBy: {
          slot: 'desc'
        },
        take: limit
      })
    }
  },

  Mutation: {
    commitOrder: async (_: any, { input }: { input: any }, context: Context) => {
      // Find the market
      const market = await context.prisma.market.findUnique({
        where: { symbol: input.symbol }
      })

      if (!market) {
        throw new Error(`Market ${input.symbol} not found`)
      }

      // Find or create user
      let user = await context.prisma.user.findUnique({
        where: { wallet: input.wallet }
      })

      if (!user) {
        user = await context.prisma.user.create({
          data: { wallet: input.wallet }
        })
      }

      // Find the next planned batch for this market
      const plannedBatch = await context.prisma.plannedBatch.findFirst({
        where: {
          marketId: market.id,
          status: 'PLANNED'
        },
        orderBy: {
          slot: 'asc'
        }
      })

      if (!plannedBatch) {
        throw new Error(`No upcoming batch for market ${input.symbol}`)
      }

      // Create the order
      const order = await context.prisma.order.create({
        data: {
          userId: user.id,
          marketId: market.id,
          side: input.side,
          qty: input.qty,
          limitPx: input.limitPx || null,
          salt: input.salt,
          commitment: input.commitment || 'temp-commitment', // TODO: compute actual commitment
          status: 'PENDING',
          plannedBatchId: plannedBatch.id
        },
        include: {
          user: true,
          market: true,
          plannedBatch: true
        }
      })

      return {
        order,
        plannedBatch,
        commitment: order.commitment
      }
    },

    cancelOrder: async (_: any, { orderId }: { orderId: string }, context: Context) => {
      try {
        const order = await context.prisma.order.findUnique({
          where: { id: orderId }
        })

        if (!order) {
          return {
            success: false,
            message: 'Order not found'
          }
        }

        // Check if order can still be canceled
        if (order.status !== 'PENDING') {
          return {
            success: false,
            message: 'Order cannot be canceled (already processed)'
          }
        }

        // Update order status
        await context.prisma.order.update({
          where: { id: orderId },
          data: { status: 'CANCELED' }
        })

        return {
          success: true,
          message: 'Order canceled successfully'
        }
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    },

    registerUser: async (_: any, { wallet }: { wallet: string }, context: Context) => {
      try {
        const user = await context.prisma.user.upsert({
          where: { wallet },
          update: {},
          create: { wallet }
        })

        return {
          user,
          success: true
        }
      } catch (error) {
        return {
          user: null,
          success: false
        }
      }
    }
  },

  // Field resolvers
  Market: {
    tickSize: (market: any) => market.tickSize.toString(),
    minNotional: (market: any) => market.minNotional.toString(),
    createdAt: (market: any) => market.createdAt.toISOString(),
    updatedAt: (market: any) => market.updatedAt.toISOString()
  },

  Order: {
    qty: (order: any) => order.qty.toString(),
    limitPx: (order: any) => order.limitPx ? order.limitPx.toString() : null,
    createdAt: (order: any) => order.createdAt.toISOString(),
    updatedAt: (order: any) => order.updatedAt.toISOString()
  },

  Batch: {
    slot: (batch: any) => batch.slot.toString(),
    clearingPx: (batch: any) => batch.clearingPx.toString(),
    totalBase: (batch: any) => batch.totalBase.toString(),
    totalQuote: (batch: any) => batch.totalQuote.toString(),
    createdAt: (batch: any) => batch.createdAt.toISOString()
  },

  PlannedBatch: {
    slot: (plannedBatch: any) => plannedBatch.slot.toString(),
    eta: (plannedBatch: any) => plannedBatch.eta.toISOString(),
    inclusionTime: (plannedBatch: any) => plannedBatch.inclusionTime ? plannedBatch.inclusionTime.toISOString() : null,
    createdAt: (plannedBatch: any) => plannedBatch.createdAt.toISOString(),
    updatedAt: (plannedBatch: any) => plannedBatch.updatedAt.toISOString()
  },

  User: {
    createdAt: (user: any) => user.createdAt.toISOString(),
    updatedAt: (user: any) => user.updatedAt.toISOString()
  }
}
