# Fixing the "Failed to Fetch" Error

## Problem
The AssemblyAI voice input fails with "failed to start recording: failed to fetch" or "Cannot connect to token server" because:
- AssemblyAI's v3 streaming API requires a backend server to generate temporary tokens
- This is a security best practice to protect API keys
- GitHub Pages (static hosting) cannot run server-side code

## Architecture

The proper setup requires:
```
Browser → Your Backend/Proxy → AssemblyAI Token API
Browser → AssemblyAI WebSocket (with token from above)
```

This project is based on [AssemblyAI's official realtime-react-example](https://github.com/AssemblyAI-Community/realtime-react-example).

## Quick Solutions

### Solution 1: Deploy to Netlify (Recommended - Easiest)

This repository includes a Netlify Function that automatically proxies token requests.

1. Sign up for a free [Netlify](https://netlify.com) account
2. Click "Import project" → "Import from Git"  
3. Select this repository
4. Deploy! (Netlify will automatically use the included `netlify.toml` configuration)
5. Your app will work immediately at `https://your-site.netlify.app`

**Advantages:**
- Zero configuration needed
- Free tier is generous
- Automatic HTTPS
- Global CDN
- Serverless functions included

### Solution 2: Run Local Development with Backend

For local development, you need to run a token server:

**Option A: Simple Node.js Server**

Create `server/server.js`:
```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

app.get('/token', async (req, res) => {
  const expiresInSeconds = 500;
  const url = `https://streaming.assemblyai.com/v3/token?expires_in_seconds=${expiresInSeconds}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: process.env.ASSEMBLYAI_API_KEY || 'cecc12bdb280498b9c5d37868bc79184',
      },
    });
    
    const data = await response.json();
    res.json({ token: data.token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch token' });
  }
});

app.listen(8000, () => console.log('Server running on port 8000'));
```

Then run:
```bash
npm install express cors dotenv
node server/server.js
```

And configure the frontend:
```javascript
localStorage.setItem('assemblyai_token_url', 'http://localhost:8000/token');
```

### Solution 3: Deploy a Cloudflare Worker

For GitHub Pages users who want to keep using GitHub Pages:

1. Sign up for [Cloudflare](https://dash.cloudflare.com/sign-up) (free tier)
2. Go to Workers & Pages → Create Application → Create Worker  
3. Name it `assemblyai-proxy`
4. Replace the default code with contents from `cloudflare-worker.js` in this repo
5. Click "Save and Deploy"
6. Copy your worker URL (e.g., `https://assemblyai-proxy.your-subdomain.workers.dev`)
7. In your browser console on the app, run:
   ```javascript
   localStorage.setItem('assemblyai_token_url', 'https://assemblyai-proxy.your-subdomain.workers.dev');
   ```
8. Reload the page and try again

**Advantages:**
- Keep using GitHub Pages
- Cloudflare Workers are very fast (edge computing)
- Free tier: 100,000 requests/day

### Solution 4: Deploy to Vercel

1. Sign up for [Vercel](https://vercel.com) (free tier)
2. Create `api/token.js`:
   ```javascript
   export default async function handler(req, res) {
     if (req.method !== 'GET') {
       return res.status(405).json({ error: 'Method not allowed' });
     }

     const API_KEY = process.env.ASSEMBLYAI_API_KEY || 'cecc12bdb280498b9c5d37868bc79184';
     const expiresInSeconds = 500;
     const url = `https://streaming.assemblyai.com/v3/token?expires_in_seconds=${expiresInSeconds}`;

     try {
       const response = await fetch(url, {
         headers: { 'Authorization': API_KEY }
       });
       const data = await response.json();
       res.status(200).json(data);
     } catch (error) {
       res.status(500).json({ error: 'Failed to get token' });
     }
   }
   ```
3. Deploy: `vercel --prod`
4. The token endpoint will be at `https://your-app.vercel.app/api/token`

## API Version Information

This project uses **AssemblyAI v3 Streaming API** which:
- Uses `https://streaming.assemblyai.com/v3/token` for tokens
- Connects to `wss://streaming.assemblyai.com/v3/ws` for streaming
- Uses AudioContext and ScriptProcessor for audio capture
- Sends raw PCM audio data directly (not base64 encoded)

If you see references to v2 API in old code, that's outdated.

## Troubleshooting

### Error: "Cannot connect to token server"
- Make sure your backend/proxy is running
- Check the token URL in `src/services/assemblyai.js`
- For local dev, ensure backend is on port 8000
- For deployed apps, check serverless function logs

### Error: "Failed to get token" or 401/403
- Check your AssemblyAI API key
- Ensure your account has access to real-time streaming
- Verify the API key environment variable is set

### Error: "Requested device not found"
- Grant microphone permissions in your browser
- Check that your device has a working microphone
- Try a different browser

## Security Best Practices

- Never expose API keys in client-side code
- Use environment variables for API keys in production
- Implement rate limiting on your backend
- Restrict CORS to your specific domain in production
- Consider token expiration times

## Need Help?

- Check [AssemblyAI's Streaming Documentation](https://www.assemblyai.com/docs/speech-to-text/streaming)
- See the [official example repo](https://github.com/AssemblyAI-Community/realtime-react-example)
- For issues with this fix, open a GitHub issue

