/**
 * Test Script for GraphQL Context Wiring
 * Tests that resolvers can access prisma through context and return expected values from seed
 */

async function testContextWiring() {
  const url = 'http://localhost:3000/api/graphql'

  console.log('🧪 Testing GraphQL Context Wiring...')
  console.log(`🌐 URL: ${url}`)

  try {
    // Test 1: markets query (should return seeded SOL-USDC market)
    const marketsResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          {
            markets {
              symbol
              baseMint
              quoteMint
              active
            }
          }
        `
      }),
    })

    const marketsResult = await marketsResponse.json()

    if (marketsResult.errors) {
      console.log('❌ Markets query errors:', marketsResult.errors)
      return false
    }

    console.log('✅ Markets query successful:', marketsResult.data.markets)

    // Test 2: market query by symbol
    const marketResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          {
            market(symbol: "SOL-USDC") {
              symbol
              cadenceSec
              feeBps
              active
            }
          }
        `
      }),
    })

    const marketResult = await marketResponse.json()

    if (marketResult.errors) {
      console.log('❌ Market query errors:', marketResult.errors)
      return false
    }

    console.log('✅ Market query successful:', marketResult.data.market)

    // Test 3: Verify the seeded market has correct values
    const market = marketResult.data.market
    if (market.symbol !== 'SOL-USDC') {
      console.log('❌ Market symbol mismatch:', market.symbol)
      return false
    }

    if (market.cadenceSec !== 1) {
      console.log('❌ Cadence mismatch:', market.cadenceSec)
      return false
    }

    if (market.active !== true) {
      console.log('❌ Market not active:', market.active)
      return false
    }

    console.log('✅ All seeded values match expected values')

    // Test 4: Test introspection to verify context is working
    const introspectionResponse = await fetch(url, {
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
                fields {
                  name
                }
              }
            }
          }
        `
      }),
    })

    const introspectionResult = await introspectionResponse.json()

    if (introspectionResult.errors) {
      console.log('❌ Introspection errors:', introspectionResult.errors)
      return false
    }

    const queryFields = introspectionResult.data.__schema.queryType.fields.map((f: any) => f.name)
    const requiredFields = ['markets', 'market', 'nextBatch']

    for (const field of requiredFields) {
      if (!queryFields.includes(field)) {
        console.log(`❌ Missing query field: ${field}`)
        return false
      }
    }

    console.log('✅ All required query fields available:', requiredFields)

    // Test 5: Test a mutation to verify context works in mutations too
    const mutationResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          mutation {
            registerUser(wallet: "test-wallet-123") {
              success
              user {
                id
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

    if (!mutationResult.data.registerUser.success) {
      console.log('❌ User registration failed:', mutationResult.data.registerUser)
      return false
    }

    console.log('✅ User registration mutation successful:', mutationResult.data.registerUser)

    console.log('🎉 Context wiring test PASSED!')
    console.log('📊 Summary:')
    console.log('  - GraphQL server boots successfully')
    console.log('  - Context properly injects prisma and services')
    console.log('  - Resolvers can access database through context')
    console.log('  - Seeded market data accessible via queries')
    console.log('  - Mutations work with context injection')

    return true

  } catch (error) {
    console.log('❌ Test FAILED: Error making request:', error)
    return false
  }
}

testContextWiring()
