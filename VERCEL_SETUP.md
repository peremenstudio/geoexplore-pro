## Vercel Deployment Setup

### Set Environment Variables on Vercel

Follow these steps to set up the Google Places API key on Vercel:

1. **Go to your Vercel project:**
   - Visit https://vercel.com/dashboard
   - Select your "Geo Explore" project

2. **Add Environment Variable:**
   - Click "Settings" tab
   - Go to "Environment Variables"
   - Click "Add New"
   - **Name:** `GOOGLE_PLACES_API`
   - **Value:** `your_google_places_api_key_here` (get from Google Cloud Console)
   - **Environments:** Select all (Production, Preview, Development)
   - Click "Save"

3. **Redeploy:**
   - Go to "Deployments" tab
   - Click the latest deployment
   - Click "Redeploy" button
   - Wait for it to build and deploy

4. **Test:**
   - Open your Vercel URL
   - Go to Commercial > Google Maps
   - Pick a location and click "Fetch"
   - Should work now! ✅

### For Local Development:

**In two separate terminals:**

Terminal 1 - Start the API proxy:
```bash
npm run dev:api
```

Terminal 2 - Start Vite:
```bash
npm run dev
```

Then visit `http://localhost:3000`

### Troubleshooting:

If you see "Google Places API key not configured":
- ✓ Check that `GOOGLE_PLACES_API` is set in Vercel Environment Variables
- ✓ Check that it's set for all environments (Production, Preview, Development)
- ✓ Redeploy after adding the variable
- ✓ Wait a few moments for the deployment to complete

If local doesn't work:
- ✓ Make sure you ran `npm install`
- ✓ Make sure `.env.local` has `GOOGLE_PLACES_API=...`
- ✓ Make sure both dev:api and dev servers are running
- ✓ Check browser console for errors
