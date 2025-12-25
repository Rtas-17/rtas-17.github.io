# MasriConnect - Real-time English to Egyptian Arabic Translation

This project provides real-time voice translation from English to Egyptian Arabic using AssemblyAI for speech recognition and Google Gemini for translation.

## ⚠️ Important: CORS Proxy Required

If you see the error **"failed to start recording: failed to fetch"**, this is because AssemblyAI's API requires a server-side proxy for security reasons. 

**Quick Fix**: Deploy to Netlify (free) instead of GitHub Pages:
1. Fork this repository
2. Sign up at [Netlify](https://netlify.com)
3. Import your fork and deploy
4. Done! The included Netlify Function will handle the proxy automatically

For other solutions, see [CORS_PROXY_SETUP.md](./CORS_PROXY_SETUP.md).

## Features

- Real-time speech-to-text transcription
- Automatic translation to Egyptian Arabic with phonetic transcription
- Support for audio file uploads
- Text input for testing

## Local Development

```bash
npm install
npm run dev
```

**Note**: You may encounter CORS issues when testing locally. See [CORS_PROXY_SETUP.md](./CORS_PROXY_SETUP.md) for solutions.

## Deployment

### GitHub Pages (Default - Requires CORS Proxy Setup)

This project is automatically deployed to GitHub Pages when changes are pushed to the `master` branch. However, you'll need to set up a CORS proxy for the AssemblyAI integration to work. See [CORS_PROXY_SETUP.md](./CORS_PROXY_SETUP.md).

### Netlify (Recommended - Works Out of the Box)

The easiest way to deploy this app:

1. Push to GitHub
2. Import into [Netlify](https://netlify.com)
3. Deploy (uses included `netlify.toml` configuration)

The Netlify Function will automatically proxy AssemblyAI requests, so everything works immediately.

### Vercel

Similar to Netlify, but you'll need to create an `api/assemblyai-token.js` file. See [CORS_PROXY_SETUP.md](./CORS_PROXY_SETUP.md) for details.

## Configuration

### API Keys

- **AssemblyAI**: Hardcoded in `src/services/assemblyai.js` (consider using environment variables)
- **Google Gemini**: Configured through the app's settings UI

### Custom Proxy URL

To use a custom CORS proxy:
```javascript
localStorage.setItem('assemblyai_proxy_url', 'YOUR_PROXY_URL');
```

## React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Vite Plugins

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
