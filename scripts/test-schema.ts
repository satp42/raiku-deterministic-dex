/**
 * Test Script for GraphQL Schema SDL
 * Tests that the server boots and introspection shows defined types/fields
 */

async function testGraphQLSchema() {
  const url = 'http://localhost:3000/api/graphql'

  console.log('🧪 Testing GraphQL Schema SDL...')
  console.log(`🌐 URL: ${url}`)

  try {
    // Test introspection
    const introspectionResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          {
            __schema {
              types {
                name
                kind
                fields {
                  name
                  type {
                    name
                    kind
                  }
                }
              }
              queryType {
                name
                fields {
                  name
                }
              }
              mutationType {
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

    console.log('📊 Schema loaded successfully!')
    console.log(`📈 Found ${introspectionResult.data.__schema.types.length} types`)

    // Check for required types
    const types = introspectionResult.data.__schema.types
    const typeNames = types.map((t: any) => t.name)

    const requiredTypes = ['Market', 'Order', 'Batch', 'PlannedBatch', 'Query', 'Mutation']
    const missingTypes = requiredTypes.filter(type => !typeNames.includes(type))

    if (missingTypes.length > 0) {
      console.log('❌ Missing required types:', missingTypes)
      return false
    }

    console.log('✅ All required types found:', requiredTypes)

    // Check for required queries
    const queryType = introspectionResult.data.__schema.queryType
    const queryFields = queryType.fields.map((f: any) => f.name)

    const requiredQueries = ['markets', 'nextBatch', 'market']
    const missingQueries = requiredQueries.filter(query => !queryFields.includes(query))

    if (missingQueries.length > 0) {
      console.log('❌ Missing required queries:', missingQueries)
      return false
    }

    console.log('✅ All required queries found:', requiredQueries)

    // Check for required mutations
    const mutationType = introspectionResult.data.__schema.mutationType
    const mutationFields = mutationType.fields.map((f: any) => f.name)

    const requiredMutations = ['commitOrder']
    const missingMutations = requiredMutations.filter(mutation => !mutationFields.includes(mutation))

    if (missingMutations.length > 0) {
      console.log('❌ Missing required mutations:', missingMutations)
      return false
    }

    console.log('✅ All required mutations found:', requiredMutations)

    // Test markets query
    const marketsResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '{ markets { symbol baseMint quoteMint active } }'
      }),
    })

    const marketsResult = await marketsResponse.json()

    if (marketsResult.errors) {
      console.log('❌ Markets query errors:', marketsResult.errors)
      return false
    }

    if (marketsResult.data.markets.length === 0) {
      console.log('⚠️  No markets found - this is expected if no markets are seeded')
    } else {
      console.log('✅ Markets query working:', marketsResult.data.markets)
    }

    console.log('🎉 Schema SDL test PASSED!')
    return true

  } catch (error) {
    console.log('❌ Test FAILED: Error making request:', error)
    return false
  }
}

testGraphQLSchema()
