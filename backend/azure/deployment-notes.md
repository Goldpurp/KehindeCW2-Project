# KehindeCW2 Project Azure Deployment Notes

Created in Azure Portal Cloud Shell on 2026-07-10.

## Resource Placement

- Subscription: Azure for Students
- Resource group: KehindeRazaq
- Location: swedencentral

## Created Resources

These Azure resources were created earlier under their original Goldpurp names and are still used by the app.

- Cosmos DB account: `goldpurpcosmos174522579`
- Cosmos DB database: `goldpurp`
- Cosmos DB containers:
  - `users` with partition key `/id`
  - `videos` with partition key `/id`
  - `comments` with partition key `/videoId`
  - `activities` with partition key `/recipientId`
- Storage account: `goldpurpst16154530003`
- Blob container: `videos`
- Function App: `goldpurpapi174522579`

## Function App Settings

The Function App has these app setting names configured:

- `COSMOS_CONNECTION_STRING`
- `COSMOS_DATABASE_NAME`
- `VIDEO_STORAGE_CONTAINER`
- `VIDEO_STORAGE_ACCOUNT`

The secret values stay in Azure and are intentionally not stored in this repo.

## Runtime

The Azure Function App uses Node.js 22 because Azure rejected Node.js 20 as end-of-life.

## Front Door and CDN Status

Attempted on 2026-07-11 from Azure Portal Cloud Shell.

- `Microsoft.Cdn` provider registration completed on the `Azure for Students` subscription.
- Azure Front Door Standard profile creation was blocked by Azure with:
  `Free Trial and Student account is forbidden for Azure Frontdoor resources.`
- Azure CDN classic profile creation was also blocked because Microsoft no longer supports creating new classic CDN profiles.
- No Front Door/CDN endpoint was created on this subscription.

The ready-to-run script for an eligible paid subscription is:

```bash
bash backend/azure/create-frontdoor-cdn.sh
```

After that script succeeds, set the frontend API base URL to the printed `https://<front-door-host>/api` value.

## API Source Status

- The frontend now targets `https://goldpurpapi174522579.azurewebsites.net/api` by default.
- The Azure Functions source in `backend/azure/functions` contains the live API routes for users, videos, comments, ratings, activities, and Blob-backed media playback.
- A Cloud Shell zip deployment was started on 2026-07-10 and reached the Azure zip deployment polling step, but the public Function URL was still returning Azure's placeholder `503 Site Under Construction` page during final verification.
- On 2026-07-11, the Azure Functions API was redeployed with token-based email/password signup and signin. Header-only local users are rejected unless the Function App explicitly enables `ALLOW_UNSAFE_HEADER_AUTH=true`.
- The live Cosmos containers (`users`, `videos`, `comments`, `activities`) and the `videos` blob container were emptied after deployment so the app starts with no preloaded accounts or videos.
- On 2026-07-12, the Function App CORS allowed origins were updated for the Render deployment:
  - `https://kehindecw2-project.onrender.com`
  - `http://127.0.0.1:3000`
  - `http://localhost:3000`
  - `http://127.0.0.1:3003`
  - `http://localhost:3003`
- CORS preflight checks for signup and authenticated video requests from Render returned `200 OK`.
- On 2026-07-12, the Function App was redeployed from commit `55b2df5`.
  - Video views now count unique signed-in consumer users in `viewedBy`.
  - Creator self-views are ignored.
  - Legacy inflated `viewCount` values are no longer trusted by API responses unless backed by real `viewedBy` entries.
  - The deployed `/api/videos` route returns `401 Sign in required` without an auth token, confirming the live API is enforcing authentication.
