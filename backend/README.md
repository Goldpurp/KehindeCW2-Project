# KehindeCW2 Project Backend

This folder contains the Azure production backend for KehindeCW2 Project:

- `azure/`: Azure Functions, Cosmos DB, Blob Storage, and Bicep infrastructure.

The frontend already models the important product rules:

- Creator accounts can upload and manage videos.
- Consumer accounts can watch, search, comment, rate, like, and share.
- Consumers cannot upload videos.
- Uploaded videos carry title, publisher, producer, genre, and age rating.
- Feed, search, profile, notifications, comments, ratings, and deletes are backed by live data.

Azure is the supported backend path for this app.

## Data Model

See `shared/schema.md` for the Cosmos DB container shapes.

## Azure Quick Start

1. Create a resource group.
2. Deploy `azure/infra/main.bicep`.
3. Publish `azure/functions`.
4. Connect the frontend to the Function API base URL and Blob Storage upload flow.
