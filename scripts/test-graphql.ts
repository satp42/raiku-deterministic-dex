/**
 * Test Script for GraphQL Endpoint
 * Tests the exact query specified in the task: POST { query: "{ hello }" }
 */

async function testGraphQL() {
  const query = '{ hello }'
  const url = 'http://localhost:3000/api/graphql'

  console.log('🧪 Testing GraphQL endpoint...')
  console.log(`📡 Query: ${query}`)
  console.log(`🌐 URL: ${url}`)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    })

    const result = await response.json()

    console.log('📨 Response:', JSON.stringify(result, null, 2))

    // Check if response contains "world"
    if (result.data && result.data.hello === 'world') {
      console.log('✅ Test PASSED: Response contains "world"')
      return true
    } else {
      console.log('❌ Test FAILED: Response does not contain expected "world"')
      return false
    }
  } catch (error) {
    console.log('❌ Test FAILED: Error making request:', error)
    return false
  }
}

testGraphQL()
