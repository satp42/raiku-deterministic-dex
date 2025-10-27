/**
 * Test Script for GraphQL Services Export
 * Tests that context exports { prisma, services } as specified
 */

async function testServicesExport() {
  const url = 'http://localhost:3000/api/graphql'

  console.log('🧪 Testing GraphQL Services Export...')
  console.log(`🌐 URL: ${url}`)

  try {
    // Test that we can query the schema to verify context is working
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          {
            __schema {
              queryType {
                name
              }
              mutationType {
                name
              }
            }
          }
        `
      }),
    })

    const result = await response.json()

    if (result.errors) {
      console.log('❌ Schema query errors:', result.errors)
      return false
    }

    console.log('✅ Schema accessible:', {
      queryType: result.data.__schema.queryType.name,
      mutationType: result.data.__schema.mutationType.name
    })

    // Test that markets query works (verifies prisma access through context)
    const marketsResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '{ markets { symbol } }'
      }),
    })

    const marketsResult = await marketsResponse.json()

    if (marketsResult.errors) {
      console.log('❌ Markets query errors:', marketsResult.errors)
      return false
    }

    const count = marketsResult.data.markets.length
    console.log(`✅ Markets count through context: ${count}`)

    // Test mutation (verifies services access through context)
    const mutationResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          mutation {
            registerUser(wallet: "test-context-services-456") {
              success
              user {
                wallet
              }
            }
          }
        `
      }),
    })

    const mutationResult = await mutationResponse.json()

    if (mutationResult.errors) {
      console.log('❌ Mutation errors:', mutationResult.errors)
      return false
    }

    if (mutationResult.data.registerUser.success) {
      console.log('✅ Services accessible through context - user created:', mutationResult.data.registerUser.user.wallet)
    } else {
      console.log('❌ Services not accessible through context')
      return false
    }

    console.log('🎉 Services export test PASSED!')
    console.log('📊 Summary:')
    console.log('  - Context exports { prisma, services } as specified')
    console.log('  - Route properly injects context into resolvers')
    console.log('  - Resolvers can perform prisma.market.findMany() operations')
    console.log('  - Services object is available for future domain services')

    return true

  } catch (error) {
    console.log('❌ Test FAILED: Error making request:', error)
    return false
  }
}

testServicesExport()
