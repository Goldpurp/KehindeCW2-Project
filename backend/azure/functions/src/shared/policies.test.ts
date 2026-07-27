import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveOwnedVideoMetadata,
  normalizePageSize,
  parseByteRange,
  ratingPolicyError,
  recordUniqueView
} from './policies.js';
import type { UserPrincipal, VideoRecord } from './types.js';

const creator: UserPrincipal = {
  id: 'creator-1',
  email: 'creator@example.com',
  displayName: 'Creator Studio',
  role: 'creator'
};

const consumer: UserPrincipal = {
  id: 'consumer-1',
  email: 'consumer@example.com',
  displayName: 'Consumer One',
  role: 'consumer'
};

const video: VideoRecord = {
  id: 'video-1',
  title: 'A test video',
  publisher: creator.displayName,
  producer: creator.displayName,
  genre: 'Documentary',
  ageRating: 'PG',
  videoUrl: '/api/videos/video-1/media',
  thumbnailUrl: '',
  creatorId: creator.id,
  creatorName: creator.displayName,
  createdAt: new Date(0).toISOString(),
  likes: [],
  ratings: {},
  averageRating: 0,
  viewCount: 0,
  viewedBy: [],
  shareCount: 0
};

test('upload metadata always derives producer and publisher from the signed-in creator', () => {
  const metadata = deriveOwnedVideoMetadata(creator, {
    title: '  Cloud video  ',
    genre: '  Education  ',
    ageRating: 'PG'
  });

  assert.deepEqual(metadata, {
    title: 'Cloud video',
    genre: 'Education',
    ageRating: 'PG',
    producer: 'Creator Studio',
    publisher: 'Creator Studio'
  });
});

test('unique views ignore the uploader and repeated viewers', () => {
  assert.deepEqual(recordUniqueView([], creator.id, creator.id), []);
  assert.deepEqual(recordUniqueView([consumer.id], consumer.id, creator.id), [consumer.id]);
  assert.deepEqual(recordUniqueView([], consumer.id, creator.id), [consumer.id]);
});

test('rating policy allows consumers and rejects creators', () => {
  assert.equal(ratingPolicyError(consumer, video), null);
  assert.equal(ratingPolicyError(creator, video), 'Only consumer accounts can rate videos.');
});

test('page size remains bounded for serverless feed requests', () => {
  assert.equal(normalizePageSize(null), 24);
  assert.equal(normalizePageSize('0'), 1);
  assert.equal(normalizePageSize('30'), 30);
  assert.equal(normalizePageSize('500'), 50);
});

test('byte ranges support normal, open and suffix requests', () => {
  assert.deepEqual(parseByteRange(null, 1000), { kind: 'full' });
  assert.deepEqual(parseByteRange('bytes=100-199', 1000), { kind: 'range', start: 100, end: 199 });
  assert.deepEqual(parseByteRange('bytes=900-', 1000), { kind: 'range', start: 900, end: 999 });
  assert.deepEqual(parseByteRange('bytes=-100', 1000), { kind: 'range', start: 900, end: 999 });
  assert.deepEqual(parseByteRange('bytes=1000-1200', 1000), { kind: 'invalid' });
  assert.deepEqual(parseByteRange('items=0-10', 1000), { kind: 'invalid' });
});
