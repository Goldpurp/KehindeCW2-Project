# Security Specification

## Trust Model

The browser is untrusted. Hiding controls is a usability decision; every sensitive decision is repeated by Azure Functions using a verified identity and the current Cosmos DB user record.

## Identity Controls

- Passwords are salted and hashed with scrypt before persistence.
- Authentication returns a seven-day HMAC-SHA256 bearer token.
- The token contains only the user identifier and expiry.
- `AUTH_TOKEN_SECRET` is required and supplied through Azure application settings.
- Protected requests resolve the user from Cosmos DB, so deleted accounts and role changes take effect immediately.
- Public registration creates consumer accounts.
- Creator registration requires the server-side `CREATOR_SIGNUP_CODE`; the code is never committed to source control.

## Authorization Invariants

- Only a resolved creator can create videos.
- Only the original creator can edit or delete a video.
- Producer, publisher, creator ID and creator name are assigned by the API.
- Consumers can read, search, comment, like, share and submit one 1-5 rating per video.
- Creator accounts cannot rate content, preventing uploader self-rating.
- A comment owner can update or delete their own comment; video ownership is checked for moderation behavior where supported.
- Users can update only their own profile and cannot alter their persisted role.
- Activity queries are scoped to the authenticated recipient.

## Abuse Cases and Expected Responses

| Attempt | Expected control |
| --- | --- |
| Anonymous catalogue request | `401 Sign in required` |
| Consumer video upload | `403 Creator account required` |
| Creator enrolment without invite | `403 valid invitation code required` |
| Client-supplied producer or publisher | ignored and replaced with authenticated creator identity |
| Rating outside 1-5 | `400 Rating must be 1 to 5` |
| Creator rating | `403 Only consumer accounts can rate` |
| Delete another creator's upload | `403 Only the creator can delete` |
| Modify another profile | `403 Cannot update another account` |
| Invalid media byte range | `416 Range Not Satisfiable` |

## Residual Risks

- Custom HMAC authentication does not provide MFA, recovery or managed key rotation.
- Data-URL uploads require explicit payload limits at the gateway for production use.
- Rate limiting and automated abuse detection are not yet configured.
- Concurrent interaction writes should use optimistic concurrency at larger scale.

The production roadmap moves identity to Microsoft Entra External ID, direct uploads to scoped SAS URLs, and traffic controls to Front Door or API Management.
