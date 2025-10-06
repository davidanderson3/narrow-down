Narrow things down.

## Recipe panel setup

If the Recipes tab shows a CORS error when searching, the frontend could not reach the
Spoonacular proxy. To fix this locally:

1. Create a `.env` file next to `backend/server.js` with your Spoonacular API key, for example `SPOONACULAR_KEY=your_api_key_here`.
2. Restart the development server with `npm start` so the `/api/spoonacular` endpoint becomes available with the proper CORS headers.
3. If you are using a hosted proxy instead of the local server, assign its base URL to `window.apiBaseUrl` before the dashboard initializes.

After applying one of the setups above, reload the page and try the search again.

## Eventbrite panel setup

The Eventbrite tab now defaults to the shared API token `2YR3RA4K6VCZVEUZMBG4`. You can leave the field as-is to use the shared token or replace it with one of your own—your choice will be saved to local storage for future visits.

### Firebase secret storage

If you deploy the dashboard with Firebase Hosting/Functions and would like to keep the Eventbrite token in Firebase rather than hard-coding it, store it as a secret with:

```bash
firebase functions:secrets:set EVENTBRITE_API_TOKEN --data="2YR3RA4K6VCZVEUZMBG4"
```

Once the secret is created you can access it from Cloud Functions via `process.env.EVENTBRITE_API_TOKEN` and surface it to the frontend however you prefer (for example, by returning it from a callable function or writing it to Remote Config).
