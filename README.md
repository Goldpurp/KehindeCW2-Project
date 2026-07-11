# KehindeCW2 Project

KehindeCW2 Project is a school coursework video streaming app. It supports creator accounts that can upload and manage videos, and consumer accounts that can watch, search, comment, like, share, and rate uploaded content.

The frontend is a React/Vite app. The production backend path uses Azure Functions, Cosmos DB, and Blob Storage.

## Main Features

- Email and password signup/signin.
- Creator and consumer roles.
- Creator-only video upload flow with caption, genre, age rating, publisher, and producer metadata.
- Consumer video browsing, search, comments, likes, shares, and ratings.
- Profile photo upload for both account types.
- Dashboard feed, profile page, notification panel, and search view.
- Azure-backed API, database, and object storage structure.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:

```bash
npm install
```

2. Run the app:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
```

## Azure Backend

The frontend points to the existing Azure Function API by default:

```text
https://goldpurpapi174522579.azurewebsites.net/api
```

To override this for another deployment, set:

```bash
VITE_AZURE_API_BASE_URL=https://your-api-host/api
```
