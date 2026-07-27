# Architecture and Scalability Evaluation

## Design Goal

KehindeCW2 Project must support two different trust journeys. Creators own publication and metadata; consumers read and interact. The API, rather than the interface alone, enforces that distinction.

## Selected Architecture

| Layer | Selected service | Responsibility | Scale characteristic |
| --- | --- | --- | --- |
| Delivery | Render static site | React build, HTTPS, edge caching and automatic deployment | Static files scale independently from the API |
| Compute | Azure Functions Consumption | REST service logic, validation, authentication and authorization | Event-driven instances scale with requests |
| Records | Azure Cosmos DB | Users, videos, comments and recipient-scoped activities | Partitioned JSON documents and point reads |
| Media | Azure Blob Storage | Private source videos and thumbnails | Object storage avoids database bloat |
| Observability | Application Insights | Function telemetry and failure investigation | Centralized cloud diagnostics |

## Control Flow

1. Registration hashes the password with scrypt and stores only the salt and derived hash.
2. Sign-in returns a seven-day HMAC token containing a user identifier and expiry.
3. Every protected request validates the signature, expiry and current Cosmos user record.
4. The resolved role is used for creator upload and consumer rating decisions.
5. Creator identity, producer and publisher are assigned by the API, not trusted from form fields.
6. Structured metadata is persisted to Cosmos DB and binary media to private Blob Storage.
7. Playback requests support HTTP `Range`, returning `206 Partial Content` for efficient seeking.

## Data Distribution

- `users`, partition `/id`: profile and role point reads during authentication.
- `videos`, partition `/id`: ownership checks, playback lookup and update operations.
- `comments`, partition `/videoId`: comments for one video remain colocated.
- `activities`, partition `/recipientId`: each notification feed is a single-recipient query.

Video listing supports bounded cursor pages of 1-50 records. The frontend requests the latest 50 rather than transferring an unbounded catalogue.

## Advanced Features

1. **Identity and authorization:** hashed passwords, expiring signed tokens, current-user resolution, invitation-controlled creator enrolment and API-side role enforcement.
2. **Continuous integration and delivery:** GitHub Actions verifies the frontend and backend; successful `main` commits trigger the Render static deployment.
3. **Media-aware delivery:** private object storage, immutable caching and byte-range responses support seeking without loading a whole video per request.
4. **Interaction integrity:** unique consumer views, consumer-only 1-5 ratings, uploader self-rating prevention and recipient-scoped activity records.

## Alternatives Considered

| Alternative | Reason not selected for the coursework baseline |
| --- | --- |
| Single Node/Express server | Couples frontend delivery, service logic and media transfer into one scaling boundary |
| Store base64 media in Cosmos DB | Expensive document growth and inefficient read/write behavior for binary data |
| Containerized API | Appropriate for sustained workloads, but Functions better matches intermittent coursework traffic and the taught serverless model |
| Azure Front Door | Suitable for global API routing, but blocked on the Azure for Students subscription |
| Azure Media Services | Retired service; a production replacement would use queue workers plus an encoding provider or FFmpeg workload |
| Microsoft Entra External ID | Stronger production identity, but custom authentication keeps the coursework deployable within the student subscription |

## Current Limitations

- Uploads still arrive as data URLs, increasing request size and Function memory usage.
- Feed search can cross Cosmos partitions and needs denormalized query models at high volume.
- Interaction updates use read-modify-replace and should adopt optimistic concurrency for heavy simultaneous writes.
- There is no transcoding, adaptive bitrate ladder, moderation or automated caption generation.
- Render provides frontend edge caching, but the API does not yet have Front Door multi-region routing.

## Scale Roadmap

1. Replace data-URL ingestion with short-lived, creator-scoped direct-to-Blob SAS uploads.
2. Add queue-triggered validation, thumbnailing and adaptive encoding workers.
3. Add optimistic concurrency, denormalized feed documents and measured indexing policies.
4. Move identity to Entra External ID with recovery, MFA and managed signing keys.
5. Add Front Door, Cosmos autoscale, multi-region reads and tested failover on an eligible subscription.
6. Use Application Insights load metrics to set latency, failure-rate and cost guardrails.
