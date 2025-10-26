/**
 * GraphQL Context
 * Provides dependency injection for resolvers
 */

import { prisma } from '../lib/prisma'

// Context interface
export interface GraphQLContext {
  prisma: typeof prisma
  // Add other services here as needed
  // services: Services
  // raikuClient: RaikuClient
}

// Create context function
export function createContext(): GraphQLContext {
  return {
    prisma,
    // Add other dependencies here
    // services,
    // raikuClient,
  }
}

// Context type for TypeScript
export type Context = GraphQLContext
