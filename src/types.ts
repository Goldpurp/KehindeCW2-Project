export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'creator' | 'consumer';
  photoURL?: string;
  createdAt: any; // Backend timestamp or Date
}

export interface Video {
  id: string;
  title: string;
  publisher: string;
  producer: string;
  genre: string;
  ageRating: AgeRating;
  videoUrl: string;
  thumbnailUrl: string;
  creatorId: string;
  creatorName: string;
  createdAt: any; // Backend timestamp
  likes: string[]; // Array of User UIDs
  ratings: { [userId: string]: number }; // Map of userId -> score
  averageRating: number;
  viewCount: number;
  shareCount?: number;
}

export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: any; // Backend timestamp
  likes?: string[]; // Array of User UIDs
}

export type AgeRating = 'All Ages' | 'G' | 'PG' | 'PG-13' | 'R' | '11+' | '16+' | '18+';

export const GENRES = [
  'Comedy',
  'Education',
  'Entertainment',
  'Gaming',
  'Music',
  'Nature & Travel',
  'Sports',
  'Tech & Science',
  'Vlog'
];

export const AGE_RATINGS: AgeRating[] = ['All Ages', 'G', 'PG', 'PG-13', 'R', '11+', '16+', '18+'];
