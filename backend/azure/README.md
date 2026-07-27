# Azure Backend

The backend uses Azure Functions for REST service logic, Cosmos DB for structured application records, Blob Storage for private video objects and Application Insights for telemetry.

## Infrastructure Deployment

```bash
az deployment group create \
  --resource-group <resource-group> \
  --template-file backend/azure/infra/main.bicep \
  --parameters appName=kehindecw2 \
  --parameters authTokenSecret='<strong-random-secret>' \
  --parameters creatorSignupCode='<private-invitation-code>'
```

Both secret parameters are marked secure by Bicep and become Function App settings. They must not be committed.

## Authentication Contract

- `POST /api/auth/signup` accepts email/password registration. Consumer registration is public; creator registration also requires `creatorCode`.
- `POST /api/auth/signin` returns the public user profile and a signed bearer token.
- Protected routes require `Authorization: Bearer <token>`.
- The token is verified and then resolved to a current Cosmos DB user before role decisions.
- Azure Easy Auth claims are also supported when the Function App is later placed behind that identity layer.

Legacy `x-user-*` headers are disabled unless the Function App explicitly sets `ALLOW_UNSAFE_HEADER_AUTH=true`; this setting must remain absent in production.

## API Routes

- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `GET /api/users`
- `GET/PATCH/DELETE /api/users/{userId}`
- `GET /api/videos?pageSize=24&continuation=<token>`
- `POST /api/videos` - creator only
- `GET/PATCH/DELETE /api/videos/{videoId}`
- `GET /api/videos/{videoId}/media` - supports HTTP Range
- `GET /api/videos/{videoId}/thumbnail`
- `POST /api/videos/{videoId}/likes`
- `POST /api/videos/{videoId}/views`
- `POST /api/videos/{videoId}/shares`
- `POST /api/videos/{videoId}/ratings`
- `GET/POST /api/videos/{videoId}/comments`
- `PATCH/DELETE /api/videos/{videoId}/comments/{commentId}`
- `POST /api/videos/{videoId}/comments/{commentId}/likes`
- `GET /api/activities`
- `PATCH /api/activities/{activityId}`

## Front Door

`create-frontdoor-cdn.sh` creates a Standard Azure Front Door profile, endpoint, origin group and `/api/*` route on an eligible subscription. Azure for Students currently rejects this resource, so the coursework deployment documents Render CDN delivery and the Front Door migration path honestly.
