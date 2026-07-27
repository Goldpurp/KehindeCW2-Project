# COM769 Coursework 2 Evidence Map

This document maps the assessment outline to concrete source, deployment and demonstration evidence. It is intended to make the submission easy to inspect and to keep presentation claims traceable.

## Problem Definition and Scalability

Evidence:

- Presentation slides 1-2 explain creator/consumer journeys and four scale pressures.
- `docs/architecture-and-scalability.md` explains independent delivery, compute, structured-data and object-storage boundaries.
- `security_spec.md` explains why role spoofing, uploader self-rating and client-owned metadata become more serious at scale.

## Technical Solution

Evidence:

- `src/` contains the responsive React/Vite client.
- `backend/azure/functions/src/functions/` contains REST handlers for users, videos, comments, ratings and activities.
- `backend/azure/functions/src/shared/` contains authentication, Cosmos, Blob and policy logic.
- `backend/azure/infra/main.bicep` defines Functions, Cosmos DB, Blob Storage and Application Insights resources.
- `backend/shared/schema.md` documents persisted records and partition keys.
- `backend/azure/deployment-notes.md` records the live Azure resources and deployments.

## Advanced Features

Evidence:

- Server-derived producer, publisher and creator ownership metadata.
- Invitation-controlled creator enrolment and public consumer registration.
- Unique authenticated consumer views; repeat views and creator self-views do not inflate totals.
- Consumer-only 1-5 ratings and real activity notifications.
- Cursor-bounded feed pages with a maximum page size of 50.
- HTTP byte-range video delivery for seeking and partial playback.
- Autoplay-in-view, hold-right 2x playback and double-tap five-second seeking.
- Persisted profile photos reused across feed, profile, comments and activity.

## Limitations and Scale Evaluation

Evidence:

- `docs/architecture-and-scalability.md` records current constraints and a staged scale plan.
- `backend/azure/deployment-notes.md` records the Azure Student subscription Front Door restriction.
- Presentation slides 9-10 distinguish the working coursework baseline from direct Blob upload, managed identity, observability, transcoding and multi-region work.

## Testing and Deployment

Evidence:

- `.github/workflows/ci.yml` runs clean frontend and backend verification on pushes and pull requests.
- `backend/azure/functions/src/shared/policies.test.ts` contains five automated policy tests.
- `scripts/live-smoke.mjs` checks the deployed Azure endpoint without mutating data.
- `docs/testing-evidence.md` records the test scope and demonstration trace.
- Live frontend: <https://kehindecw2-project.onrender.com>
- Live API: <https://goldpurpapi174522579.azurewebsites.net/api>

## Recorded Demonstration

The presentation speaker notes on slide 11 contain a timed five-minute script. The recording should show one transaction through the complete system: role-based login, creator upload, Blob/Cosmos persistence, consumer playback and interaction, activity creation, and owner deletion.

## Conclusion and References

Presentation slide 12 summarises built, tested and deployed evidence. Slide 13 cites Microsoft Learn, Render, the source repository and live endpoints. Speaker notes contain source blocks for the implementation claims added during the final hardening pass.
