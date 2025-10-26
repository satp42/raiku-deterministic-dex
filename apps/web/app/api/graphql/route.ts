import { ApolloServer } from '@apollo/server'
import { startServerAndCreateNextHandler } from '@as-integrations/next'
import { readFileSync } from 'fs'
import { join } from 'path'
import { resolvers } from '../../../graphql/resolvers'
import { createContext } from '../../../graphql/context'

// Read the schema from file
const schemaPath = '/Users/satwik/Desktop/raiku_hackathon/apps/web/graphql/schema.graphql'
const typeDefs = readFileSync(schemaPath, 'utf8')

// Create the Apollo Server instance
const server = new ApolloServer({
  typeDefs,
  resolvers,
})

// Start the server and create the Next.js handler
const handler = startServerAndCreateNextHandler(server, {
  context: async (req) => createContext(),
})

export async function POST(request: Request) {
  return handler(request)
}

export async function GET(request: Request) {
  return Response.json({ message: 'GraphQL endpoint - use POST for queries' })
}
