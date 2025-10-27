/**
 * GraphQL Context
 * Provides dependency injection for resolvers
 */

import { prisma } from '../lib/prisma'

// Services interface (expandable for domain services)
export interface Services {
  // Placeholder for domain services
  // matching: MatchingService
  // raiku: RaikuClient
  // merkle: MerkleService
}

// Context interface
export interface GraphQLContext {
  prisma: typeof prisma
  services: Services
}

// Create services object
function createServices(): Services {
  return {
    // Add domain services here as they are implemented
    // matching: new MatchingService(),
    // raiku: new RaikuClient(),
    // merkle: new MerkleService(),
  }
}

// Create context function
export function createContext(): GraphQLContext {
  return {
    prisma,
    services: createServices(),
  }
}

// Export context components for resolvers
export { prisma } from '../lib/prisma'
export { createServices as services }

// Context type for TypeScript
export type Context = GraphQLContext
