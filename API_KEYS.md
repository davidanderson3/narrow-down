# Securely Storing API Keys

API keys should never be committed to the repository or exposed in the browser. Use the following steps to keep keys private while still making requests on behalf of all users.

## 1. Keep keys out of source control

1. Create a `.env` file in the project root.
2. Add entries like `MY_SERVICE_API_KEY=your-key`.
3. Ensure the `.env` file is ignored by git so secrets are not committed.

## 2. Load keys on the server

1. Install [dotenv](https://www.npmjs.com/package/dotenv) (`npm install dotenv`) so the server can read the `.env` file during development.
2. At the top of `backend/server.js` add:
   ```js
   require('dotenv').config();
   ```
3. Read keys from `process.env` in server code and use them when calling third‑party APIs.

## 3. Never expose keys in client code

Frontend code should request data from your backend instead of calling third‑party APIs directly. This keeps the key on the server and identical for all users.

## 4. Hosting options

### GitHub Pages
GitHub Pages only serves static files and cannot keep runtime secrets. Use it only for the frontend. Host the backend elsewhere or through a serverless platform.

### Serverless or other hosts
Services like Netlify, Vercel, Cloudflare Workers, or a small Node server allow you to define environment variables in their dashboards. Deploy the backend there and set your API keys as secrets.

## 5. Local development

1. Duplicate `.env` to `.env.example` (without actual keys) so others know which variables are required.
2. When you clone the repo, copy `.env.example` to `.env` and fill in your real keys.

Following these steps keeps sensitive API keys out of the interface and source control while letting all users benefit from the same server‑side credentials.

