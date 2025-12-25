// Cloudflare Worker to proxy AssemblyAI token requests
// Based on AssemblyAI's official realtime-react-example
// This worker should be deployed to Cloudflare Workers

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Only allow GET requests (matching AssemblyAI's v3 API)
  if (request.method === 'OPTIONS') {
    // Handle CORS preflight
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // Get API key from Cloudflare Worker secrets
    // Set in Workers dashboard: Settings > Variables > Add variable
    // For development, you can temporarily hardcode it here (NOT FOR PRODUCTION!)
    // const apiKey = 'YOUR_API_KEY_HERE'
    
    // In production, use environment variables/secrets
    // eslint-disable-next-line no-undef
    const apiKey = typeof ASSEMBLYAI_API_KEY !== 'undefined' ? ASSEMBLYAI_API_KEY : null
    
    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: 'ASSEMBLYAI_API_KEY not configured',
        message: 'Please set the API key as a Worker secret'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      })
    }

    // Use v3 API endpoint (matching official example)
    const expiresInSeconds = 500
    const url = `https://streaming.assemblyai.com/v3/token?expires_in_seconds=${expiresInSeconds}`

    // Forward the request to AssemblyAI
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': apiKey
      }
    })

    // Get the response data
    const data = await response.json()

    // Return with CORS headers
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }
}
