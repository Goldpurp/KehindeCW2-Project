# Cosmos DB Data Model

## `users` container - partition key `/id`

Profiles persist email, display name, immutable role, profile photo, follow identifiers, scrypt password material and ISO timestamps. API responses remove password hash and salt.

## `videos` container - partition key `/id`

Video records persist caption/title, genre, validated age rating, authenticated producer/publisher identity, Blob paths, creator identity, likes, per-consumer ratings, unique viewer IDs, aggregate rating, view count and share count.

The API owns `creatorId`, `creatorName`, `producer`, `publisher` and timestamps. The client cannot replace those values.

## `comments` container - partition key `/videoId`

Comments are colocated by video and contain authenticated user identity, text, likes and an ISO creation timestamp.

## `activities` container - partition key `/recipientId`

Upload, comment, like, rating and follow events are written for a specific recipient. The recipient partition supports an efficient notification feed and persisted read state.

## Object Storage

The private Blob container stores `videos/{videoId}/source.<ext>` and `videos/{videoId}/thumbnail.<ext>`. Cosmos holds paths and metadata only. Media is served with immutable caching and HTTP byte-range responses through the Function API.
