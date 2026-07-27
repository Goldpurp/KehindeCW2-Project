import type { AgeRating, UserPrincipal, VideoRecord } from './types.js';

export const VALID_AGE_RATINGS: AgeRating[] = [
  'All Ages',
  'G',
  'PG',
  'PG-13',
  'R',
  '11+',
  '16+',
  '18+'
];

type UploadMetadataInput = Pick<VideoRecord, 'title' | 'genre' | 'ageRating'>;

export const deriveOwnedVideoMetadata = (
  user: UserPrincipal,
  input: UploadMetadataInput
) => {
  const ownerName = user.displayName.trim() || user.email.trim();

  return {
    title: input.title.trim(),
    genre: input.genre.trim(),
    ageRating: input.ageRating,
    producer: ownerName,
    publisher: ownerName
  };
};

export const normalizeViewedBy = (viewedBy: unknown) => (
  Array.from(new Set(
    (Array.isArray(viewedBy) ? viewedBy : [])
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.trim())
      .filter(Boolean)
  ))
);

export const recordUniqueView = (
  viewedBy: unknown,
  viewerId: string,
  creatorId: string
) => {
  const normalized = normalizeViewedBy(viewedBy);
  if (viewerId !== creatorId && !normalized.includes(viewerId)) {
    normalized.push(viewerId);
  }
  return normalized;
};

export const ratingPolicyError = (user: UserPrincipal, video: VideoRecord) => {
  if (user.role !== 'consumer') return 'Only consumer accounts can rate videos.';
  if (user.id === video.creatorId) return 'Uploaders cannot rate their own videos.';
  return null;
};

export const normalizePageSize = (value: string | null, fallback = 24) => {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(50, Math.max(1, parsed));
};

export type ByteRangeResult =
  | { kind: 'full' }
  | { kind: 'invalid' }
  | { kind: 'range'; start: number; end: number };

export const parseByteRange = (header: string | null, totalBytes: number): ByteRangeResult => {
  if (!header) return { kind: 'full' };
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return { kind: 'invalid' };

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return { kind: 'invalid' };

  if (!match[1]) {
    const suffixLength = Number.parseInt(match[2], 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return { kind: 'invalid' };
    return {
      kind: 'range',
      start: Math.max(0, totalBytes - suffixLength),
      end: totalBytes - 1
    };
  }

  const start = Number.parseInt(match[1], 10);
  const requestedEnd = match[2] ? Number.parseInt(match[2], 10) : totalBytes - 1;
  if (!Number.isFinite(start) || !Number.isFinite(requestedEnd) || start < 0 || start >= totalBytes || requestedEnd < start) {
    return { kind: 'invalid' };
  }

  return {
    kind: 'range',
    start,
    end: Math.min(requestedEnd, totalBytes - 1)
  };
};
