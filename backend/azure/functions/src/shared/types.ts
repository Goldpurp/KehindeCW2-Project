export type UserRole = 'creator' | 'consumer';

export type UserPrincipal = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  followingIds?: string[];
};

export type UserRecord = {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  bio?: string;
  photoURL?: string;
  followingIds?: string[];
  passwordHash?: string;
  passwordSalt?: string;
  createdAt: string;
  updatedAt?: string;
};

export type AgeRating = 'All Ages' | 'G' | 'PG' | 'PG-13' | 'R' | '11+' | '16+' | '18+';

export type VideoRecord = {
  id: string;
  title: string;
  publisher: string;
  producer: string;
  genre: string;
  ageRating: AgeRating;
  videoUrl: string;
  thumbnailUrl: string;
  storagePath?: string;
  thumbnailPath?: string;
  storageContentType?: string;
  thumbnailContentType?: string;
  fileName?: string;
  creatorId: string;
  creatorName: string;
  creatorPhotoURL?: string;
  createdAt: string;
  updatedAt?: string;
  likes: string[];
  ratings: Record<string, number>;
  averageRating: number;
  viewCount: number;
  shareCount: number;
};

export type CommentRecord = {
  id: string;
  videoId: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  text: string;
  likes: string[];
  createdAt: string;
};

export type ActivityRecord = {
  id: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  videoId?: string;
  commentId?: string;
  type: 'upload' | 'comment' | 'like' | 'rating' | 'follow' | 'delete';
  text: string;
  thumbnailUrl?: string;
  createdAt: string;
  read: boolean;
};
