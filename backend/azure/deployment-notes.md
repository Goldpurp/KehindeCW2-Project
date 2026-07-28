# kehindeScalableSolution Azure Deployment Notes

Provisioned and verified on 28 July 2026.

## Resource Placement

- Subscription: Azure for Students
- Resource group: `kehindeScalableSolution`
- Location: `swedencentral`

## Active Resources

- Function App: `kehinde-scalable-solution-api`
- Function API: <https://kehinde-scalable-solution-api.azurewebsites.net/api>
- Cosmos DB account: `kehinde-scalable-solution-cosmos`
- Cosmos DB database: `kehindeScalableSolution`
- Cosmos DB containers:
  - `users` with partition key `/id`
  - `videos` with partition key `/id`
  - `comments` with partition key `/videoId`
  - `activities` with partition key `/recipientId`
- Storage account: `kehindescalablesolution`
- Private Blob container: `videos`
- Consumption plan: `kehinde-scalable-solution-plan`
- Application Insights: `kehinde-scalable-solution-insights`

The displayed project name uses the requested camel-case form. Azure host and
account names use lowercase forms because those resource types do not permit
uppercase characters.

## Security Settings

The Function App has these settings:

- `COSMOS_CONNECTION_STRING`
- `COSMOS_DATABASE_NAME`
- `VIDEO_STORAGE_CONTAINER`
- `AUTH_TOKEN_SECRET`
- `CREATOR_SIGNUP_CODE`
- `WEBSITE_NODE_DEFAULT_VERSION`
- `SCM_DO_BUILD_DURING_DEPLOYMENT`
- `ENABLE_ORYX_BUILD`

Secret values remain in Azure and are not committed. The creator invitation is
stored in the developer Mac login keychain under
`kehindeScalableSolution Creator Signup Code`.

The Storage container is private, TLS 1.2 is required, FTPS is disabled and the
Function API uses Node.js 22.

## Deployment Verification

- Infrastructure deployment:
  `kehinde-scalable-solution-infrastructure`
- Initial code deployment ID: `141144aea8644b50a61e6e056cd63e53`
- Corrected empty-feed deployment ID: `3524ca03719149afad2b263e3d35f0a1`
- Anonymous video access returns `401`.
- An invalid creator invitation returns `403`.
- Temporary creator and consumer accounts resolve to the correct roles.
- The new database returns an empty paged feed instead of an error.
- Consumer upload attempts return `403`.
- Verification accounts were deleted after testing.
- Direct inspection confirms zero users, videos, comments, activities and blobs.
- GitHub source:
  <https://github.com/Goldpurp/kehindeScalableSolution>
- Render service: `kehinde-scalable-solution`
- Render application:
  <https://kehinde-scalable-solution.onrender.com>
- The published Render bundle references only the new Azure API.
- An Azure CORS preflight from the new Render origin returns `200`.
- Responsive browser QA passed 17 phone, tablet, laptop and large-screen checks.

## CORS

Allowed frontend origins:

- `https://kehinde-scalable-solution.onrender.com`
- `http://127.0.0.1:3000`
- `http://localhost:3000`
- `http://127.0.0.1:3003`
- `http://localhost:3003`

## Front Door and CDN

`Microsoft.Cdn` is registered, but Azure for Students does not permit Azure Front
Door Standard creation. Classic Azure CDN no longer accepts new profiles. The
ready-to-run script for an eligible subscription remains:

```bash
bash backend/azure/create-frontdoor-cdn.sh
```

## Legacy Fallback

The old Render service and the four old Azure resources are not used by the new
application. They remain temporarily available as rollback history until their
permanent deletion is explicitly approved:

- Render service: `kehinde-scalable-solution-legacy`
- Function App: `goldpurpapi174522579`
- Cosmos DB account: `goldpurpcosmos174522579`
- Storage account: `goldpurpst16154530003`
- Consumption plan: `SwedenCentralPlan`
