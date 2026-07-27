# Testing and Deployment Evidence

## Automated Verification

The repository includes a two-job GitHub Actions workflow in `.github/workflows/ci.yml`.

### Frontend job

- clean dependency installation with `npm ci`
- high-severity production dependency audit
- TypeScript verification with `npm run lint`
- optimized Vite production build with `npm run build`

### Azure Functions job

- clean backend dependency installation
- high-severity production dependency audit
- strict TypeScript verification
- compilation to deployable JavaScript
- Node test execution for authorization, metadata ownership, unique views, bounded pagination and HTTP byte ranges

## Policy Tests

`backend/azure/functions/src/shared/policies.test.ts` verifies:

1. Producer and publisher cannot be replaced by client form data.
2. Creator self-views and repeat consumer views do not inflate metrics.
3. Only consumers can rate videos.
4. Feed page sizes remain between 1 and 50.
5. Normal, suffix and open-ended HTTP byte ranges are calculated correctly and invalid ranges are rejected.

Run the complete local verification with:

```bash
npm ci
npm run verify
```

## Live Smoke Test

`scripts/live-smoke.mjs` performs non-destructive checks against the deployed Azure endpoint:

- anonymous requests receive `401`
- creator and consumer accounts resolve to the correct persisted roles
- authenticated users can read the live video catalogue
- a consumer upload attempt receives `403`
- a creator self-rating attempt receives `403`

Credentials are supplied only through local environment variables and are never committed.

## Verified Live Results - 27 July 2026

- Azure zip deployment completed successfully with deployment ID `40b83baafe194ac189dd7869593c3bb5`.
- Anonymous catalogue access returned `401`.
- Consumer upload returned `403`.
- Creator self-rating returned `403`.
- Persisted accounts resolved to creator and consumer roles correctly.
- `GET /videos?pageSize=1` returned a paged object containing one item.
- `Range: bytes=0-31` returned `206`, `Accept-Ranges: bytes` and `Content-Range: bytes 0-31/16026848`.
- Frontend and backend production dependency audits returned zero known vulnerabilities.

## Responsive Visual Verification

An authenticated browser pass covered the registration screen, creator and consumer
feeds, profile, navigation and notifications at widths of 320, 375, 768, 1440 and
1920 pixels.

- 17 viewport and role checks completed with zero failures.
- No page produced horizontal overflow or off-screen interactive controls.
- All form controls remain at least 16 pixels on phone layouts, preventing automatic
  input zoom in iOS Safari.
- Consumer navigation exposes no upload control, while creator navigation retains it.
- Profile images and live video records were verified in both mobile and desktop
  layouts.
- The pass exposed a sign-in refresh race that briefly showed an empty feed; the
  authentication client now triggers an immediate data refresh after sign-in and
  sign-out.

## Demonstration Evidence Checklist

The five-minute recording should capture one traceable transaction across every layer:

1. Open the Render deployment and the protected Azure API.
2. Show consumer registration and absence of creator publication controls.
3. Sign in as an invited creator and upload a video with catalogue metadata.
4. Show the Cosmos video record and corresponding private Blob object.
5. Consume the video from the consumer account; search, seek, like, comment and rate.
6. Show the unique viewer, rating, comment and activity changes in Cosmos DB.
7. Delete the video as its owner and confirm UI, Cosmos and Blob removal.

This sequence demonstrates behavior, deployment and backend state changes rather than presenting screenshots alone.
