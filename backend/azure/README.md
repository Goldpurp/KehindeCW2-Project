# Azure Backend

This option uses Azure Functions for the API, Cosmos DB for app data, and Blob Storage for uploaded video files.

## Services

- Azure Static Web Apps or App Service for the frontend.
- Azure Functions for API routes.
- Azure Cosmos DB SQL API for users, videos, comments, and activities.
- Azure Blob Storage for video and thumbnail files.
- Optional Easy Auth or Firebase/Auth0 token verification in front of Functions.

## Deploy Infrastructure

```bash
az deployment group create \
  --resource-group <resource-group> \
  --template-file infra/main.bicep \
  --parameters appName=kehindecw2 location=eastus
```

## Front Door / CDN Edge

Azure now creates new CDN-style edge profiles through Azure Front Door Standard/Premium. The helper script below creates:

- Front Door profile
- Front Door endpoint
- Origin group
- Function App origin
- `/api/*` route to the KehindeCW2 Project API

```bash
bash backend/azure/create-frontdoor-cdn.sh
```

The current Azure for Students subscription rejects Front Door resources. Run this from an eligible paid subscription, then set `VITE_AZURE_API_BASE_URL` to the printed `https://<front-door-host>/api` value.

## API Routes

- `GET /api/users`
- `GET /api/users/{userId}`
- `PUT /api/users/{userId}`
- `PATCH /api/users/{userId}`
- `DELETE /api/users/{userId}`
- `GET /api/videos`
- `POST /api/videos`
- `GET /api/videos/{videoId}`
- `PATCH /api/videos/{videoId}`
- `DELETE /api/videos/{videoId}`
- `GET /api/videos/{videoId}/media`
- `GET /api/videos/{videoId}/thumbnail`
- `POST /api/videos/{videoId}/likes`
- `POST /api/videos/{videoId}/views`
- `POST /api/videos/{videoId}/shares`
- `GET /api/videos/{videoId}/comments`
- `POST /api/videos/{videoId}/comments`
- `PATCH /api/videos/{videoId}/comments/{commentId}`
- `DELETE /api/videos/{videoId}/comments/{commentId}`
- `POST /api/videos/{videoId}/comments/{commentId}/likes`
- `POST /api/videos/{videoId}/ratings`
- `GET /api/activities`
- `PATCH /api/activities/{activityId}`

## Auth Contract

The Functions read identity from headers so the backend can work with Azure Easy Auth, Firebase Auth verification middleware, or a gateway:

- `x-user-id`
- `x-user-email`
- `x-user-name`
- `x-user-role`: `creator` or `consumer`

In production, replace this header trust with Easy Auth claims or verified JWT parsing.
