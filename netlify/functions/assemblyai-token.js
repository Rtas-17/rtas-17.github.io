// Netlify Function to proxy AssemblyAI token requests
// Based on AssemblyAI's official realtime-react-example
// This allows the client app to get tokens without CORS issues

export async function handler(event) {
  // Only allow GET requests (matching AssemblyAI's official example)
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Get API key from environment variable or use default (not recommended for production)
    // eslint-disable-next-line no-undef
    const API_KEY = process.env.ASSEMBLYAI_API_KEY || 'cecc12bdb280498b9c5d37868bc79184';
    
    // Use v3 API endpoint with query parameter (matching official example)
    const expiresInSeconds = 500;
    const url = `https://streaming.assemblyai.com/v3/token?expires_in_seconds=${expiresInSeconds}`;

    // Forward the request to AssemblyAI using GET method
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': API_KEY
      }
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Error proxying AssemblyAI request:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to get AssemblyAI token', details: error.message })
    };
  }
}
