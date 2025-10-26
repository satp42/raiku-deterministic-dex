import { ApolloServer } from '@apollo/server'
import { startServerAndCreateNextHandler } from '@as-integrations/next'

// Create the Apollo Server instance
const server = new ApolloServer({
  typeDefs: `
    type Query {
      hello: String
    }
  `,
  resolvers: {
    Query: {
      hello: () => 'world'
    }
  }
})

// Start the server and create the Next.js handler
const handler = startServerAndCreateNextHandler(server, {
  context: async (req) => ({}),
})

export async function POST(request: Request) {
  return handler(request)
}

export async function GET(request: Request) {
  return Response.json({ message: 'GraphQL endpoint - use POST for queries' })
}
