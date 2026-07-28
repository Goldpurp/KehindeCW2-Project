const baseUrl = (process.env.KSS_API_BASE_URL || '').replace(/\/$/, '');

const required = [
  'KSS_API_BASE_URL',
  'KSS_CREATOR_EMAIL',
  'KSS_CREATOR_PASSWORD',
  'KSS_CONSUMER_EMAIL',
  'KSS_CONSUMER_PASSWORD'
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}`);
}

const stableUserId = (email) => {
  const normalized = email.trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(index)) | 0;
  }
  return `user_${Math.abs(hash).toString(36)}`;
};

const request = async (path, token, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Some successful delete or denied probe responses have no JSON body.
  }

  return { response, payload };
};

const signIn = async (email, password) => {
  const { response, payload } = await request('/auth/signin', null, {
    method: 'POST',
    body: JSON.stringify({ uid: stableUserId(email), email, password })
  });
  if (!response.ok) throw new Error(`Sign-in failed for ${email}: ${response.status}`);
  return payload;
};

const expectStatus = (actual, expected, label) => {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}`);
};

const unauthenticated = await request('/videos');
expectStatus(unauthenticated.response.status, 401, 'Anonymous video access');

const creator = await signIn(process.env.KSS_CREATOR_EMAIL, process.env.KSS_CREATOR_PASSWORD);
const consumer = await signIn(process.env.KSS_CONSUMER_EMAIL, process.env.KSS_CONSUMER_PASSWORD);

if (creator.user.role !== 'creator') throw new Error('Creator account resolved to the wrong role');
if (consumer.user.role !== 'consumer') throw new Error('Consumer account resolved to the wrong role');

const creatorVideos = await request('/videos?pageSize=24', creator.token);
expectStatus(creatorVideos.response.status, 200, 'Authenticated feed');
const videos = Array.isArray(creatorVideos.payload)
  ? creatorVideos.payload
  : creatorVideos.payload?.items || [];

const deniedUpload = await request('/videos', consumer.token, {
  method: 'POST',
  body: JSON.stringify({})
});
expectStatus(deniedUpload.response.status, 403, 'Consumer upload denial');

const ownVideo = videos.find((video) => video.creatorId === creator.user.id);
let selfRatingStatus = 'not-applicable';
if (ownVideo) {
  const deniedRating = await request(`/videos/${encodeURIComponent(ownVideo.id)}/ratings`, creator.token, {
    method: 'POST',
    body: JSON.stringify({ rating: 5 })
  });
  expectStatus(deniedRating.response.status, 403, 'Creator self-rating denial');
  selfRatingStatus = '403 denied';
}

console.log(JSON.stringify({
  liveApi: 'reachable',
  anonymousAccess: '401 denied',
  creatorRole: creator.user.role,
  consumerRole: consumer.user.role,
  consumerUpload: '403 denied',
  creatorSelfRating: selfRatingStatus,
  visibleVideos: videos.length
}, null, 2));
