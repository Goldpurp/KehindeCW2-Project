# KehindeCW2 Project Backend Schema

## users/{uid}

```ts
type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  role: "creator" | "consumer";
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
};
```

Rules:

- Users can read signed-in profiles.
- Users can create and update only their own profile.
- A consumer cannot upload videos.
- Creator role should be set at sign-up, admin tooling, or custom claim assignment.

## videos/{videoId}

```ts
type Video = {
  id: string;
  title: string;
  publisher: string;
  producer: string;
  genre: string;
  ageRating: "All Ages" | "G" | "PG" | "PG-13" | "R" | "11+" | "16+" | "18+";
  videoUrl: string;
  thumbnailUrl: string;
  storagePath?: string;
  thumbnailPath?: string;
  creatorId: string;
  creatorName: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  likes: string[];
  ratings: Record<string, number>;
  averageRating: number;
  viewCount: number;
  shareCount: number;
};
```

Rules:

- Signed-in consumers and creators can read videos.
- Only creators can create videos.
- Only the original creator can delete their videos.
- Video media URLs and creator identity are immutable after create.
- Signed-in users can add comments, likes, ratings, views, and shares.

## videos/{videoId}/comments/{commentId}

```ts
type Comment = {
  id: string;
  videoId: string;
  userId: string;
  userName: string;
  text: string;
  likes: string[];
  createdAt: Timestamp;
};
```

Rules:

- Signed-in users can comment.
- Comment owner or video owner can delete a comment.
- Comments are not edited after posting in the current app.

## activities/{activityId}

```ts
type Activity = {
  id: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  videoId?: string;
  commentId?: string;
  type: "upload" | "comment" | "like" | "rating" | "follow" | "delete";
  text: string;
  thumbnailUrl?: string;
  createdAt: Timestamp;
  read: boolean;
};
```

Rules:

- Users can read only their own activity feed.
- Backend functions create activity records from app events.
