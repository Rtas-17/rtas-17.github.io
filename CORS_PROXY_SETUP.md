# Fixing the "Failed to Fetch" Error

## Problem
The AssemblyAI voice input fails with "failed to start recording: failed to fetch" because:
- AssemblyAI's token endpoint doesn't support CORS for direct browser requests
- This is a security best practice to protect API keys
- GitHub Pages (static hosting) cannot run server-side code to proxy requests

## Quick Solutions

### Solution 1: Deploy to Netlify (Recommended - Easiest)

This repository includes a Netlify Function that proxies token requests.

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

### Solution 2: Deploy a Cloudflare Worker

For GitHub Pages users who want to keep using GitHub Pages:

1. Sign up for [Cloudflare](https://dash.cloudflare.com/sign-up) (free tier)
2. Go to Workers & Pages → Create Application → Create Worker  
3. Name it `assemblyai-proxy` (or any name)
4. Replace the default code with contents from `cloudflare-worker.js`
5. Click "Save and Deploy"
6. Copy your worker URL (e.g., `https://assemblyai-proxy.your-subdomain.workers.dev`)
7. In your browser console on the app, run:
   ```javascript
   localStorage.setItem('assemblyai_proxy_url', 'https://assemblyai-proxy.your-subdomain.workers.dev');
   ```
8. Reload the page and try again

**Advantages:**
- Keep using GitHub Pages
- Cloudflare Workers are very fast (edge computing)
- Free tier: 100,000 requests/day

### Solution 3: Deploy to Vercel

1. Sign up for [Vercel](https://vercel.com) (free tier)
2. Create `api/assemblyai-token.js`:
   ```javascript
   export default async function handler(req, res) {
     if (req.method !== 'POST') {
       return res.status(405).json({ error: 'Method not allowed' });
     }

     const API_KEY = process.env.ASSEMBLYAI_API_KEY || 'cecc12bdb280498b9c5d37868bc79184';

     try {
       const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
         method: 'POST',
         headers: {
           'Authorization': API_KEY,
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({ expires_in: 3600 })
       });

       const data = await response.json();
       res.status(response.status).json(data);
     } catch (error) {
       res.status(500).json({ error: 'Failed to get token' });
     }
   }
   ```
3. Deploy: `vercel --prod`
4. Set proxy URL:
   ```javascript
   localStorage.setItem('assemblyai_proxy_url', 'https://your-app.vercel.app/api/assemblyai-token');
   ```

## Not Recommended: Public CORS Proxy

You can use a public CORS proxy like `https://corsproxy.io` but this exposes your API key and is not suitable for production:

```javascript
localStorage.setItem('assemblyai_proxy_url', 'https://corsproxy.io/?https://api.assemblyai.com/v2/realtime/token');
```

## Why This Happens

AssemblyAI's API intentionally blocks direct browser requests to the token endpoint because:
1. **Security**: Prevents API key exposure in client-side code
2. **Rate Limiting**: Allows proper rate limiting on the server side
3. **Best Practice**: Token generation should happen on a trusted server

The proper architecture is:
```
Browser → Your Server/Proxy → AssemblyAI API
```

## Need Help?

- Check [AssemblyAI's Documentation](https://www.assemblyai.com/docs/speech-to-text/streaming)
- For issues with this fix, open a GitHub issue

