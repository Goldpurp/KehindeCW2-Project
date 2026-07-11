import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { containers } from '../shared/cosmos.js';
import { asHttpError, requireUser } from '../shared/auth.js';
import { createActivity } from '../shared/activity.js';
import type { VideoRecord } from '../shared/types.js';

export async function rateVideo(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const user = await requireUser(request);
    const videoId = request.params.videoId;
    const body = (await request.json()) as { rating?: number };
    const rating = Number(body.rating);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { status: 400, jsonBody: { error: 'Rating must be 1 to 5.' } };
    }

    const { resource: video } = await containers.videos.item(videoId, videoId).read<VideoRecord>();
    if (!video) return { status: 404, jsonBody: { error: 'Video not found.' } };
    if (user.role !== 'consumer') {
      return { status: 403, jsonBody: { error: 'Only consumer accounts can rate videos.' } };
    }
    if (user.id === video.creatorId) {
      return { status: 403, jsonBody: { error: 'Uploaders cannot rate their own videos.' } };
    }

    video.ratings = { ...video.ratings, [user.id]: rating };
    const scores = Object.values(video.ratings);
    video.averageRating = scores.length ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)) : 0;

    await containers.videos.item(video.id, video.id).replace(video);

    await createActivity({
      recipientId: video.creatorId,
      actorId: user.id,
      actorName: user.displayName,
      videoId,
      type: 'rating',
      text: `Rated ${video.title} ${rating}/5`,
      thumbnailUrl: video.thumbnailUrl
    });

    return { jsonBody: video };
  } catch (error) {
    return asHttpError(error);
  }
}

app.http('rateVideo', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'videos/{videoId}/ratings',
  handler: rateVideo
});
