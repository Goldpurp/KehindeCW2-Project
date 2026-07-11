# Security Specification: Video Sharing Platform

This document outlines the security architecture, invariants, and threat analysis for the Azure Functions API backed by Cosmos DB and Blob Storage.

## 1. Data Invariants

* **Identity Verification**: Standard users cannot modify or set roles of other users, and they cannot self-promote to 'creator' during profile creation unless verified. In our app, we allow toggling creator status via standard profile management but enforce rules to avoid identity spoofing.
* **Creator Exclusivity**: Only users who are registered with `role == 'creator'` in their user record can create or manage videos through the API.
* **Read Boundaries**: Consumers can read videos to scroll/search and can comment/rate. Only creator users can upload or delete their own videos.
* **Rating & Likes Sanitization**: Ratings are restricted between 1 and 5. Users can only edit/add their own ratings inside the `ratings` map (using their UID as the key). Likes are restricted to a string list of user UIDs, and users can only add/remove their own UID.
* **Immutable Fields**: `createdAt`, `creatorId`, `creatorName` in a video are immutable once created. `userId`, `videoId` in comments are immutable.

## 2. The "Dirty Dozen" Payloads (Threat Vectors)

1. **Privilege Escalation**: User tries to register or update their user document with role "admin" or create a creator account without signing in.
2. **Video Spoofing**: Standard consumer attempts to write a video document to the `videos` collection.
3. **Creator Identity Takeover**: Creator tries to upload a video but sets `creatorId` to another user's UID.
4. **Vandalism (Comment Spoofing)**: User attempts to post a comment under another user's `userName` or `userId`.
5. **Rating Poisoning**: User updates a video's rating map with a score of `99` (violating 1-5 boundary).
6. **Denial of Wallet (ID Poisoning)**: User writes a video with a 10KB string of junk characters as the document ID.
7. **Timestamp Tampering**: Creator sets `createdAt` for a new video to a date in the future instead of `request.time`.
8. **Malicious Like Hijacking**: User tries to add another user's UID to the `likes` list of a video.
9. **Spam Comments**: Non-signed-in anonymous user tries to write a comment under a video.
10. **Video Deletion Hijack**: Standard user tries to delete a video uploaded by a creator.
11. **Immortality Field Update**: Creator tries to change the original `createdAt` timestamp of a video post.
12. **Comment Vandalism**: User tries to update or delete someone else's comment.

## 3. The Test Runner Overview

All test scenarios should run against the Azure Functions API using seeded Cosmos DB records. Rejected operations should return `401`, `403`, or `400` depending on whether the request is unauthenticated, unauthorized, or invalid.
