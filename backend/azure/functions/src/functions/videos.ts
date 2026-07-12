import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { containers, createId, nowIso } from '../shared/cosmos.js';
import { asHttpError, requireCreator, requireUser } from '../shared/auth.js';
import { createActivity } from '../shared/activity.js';
import { deleteBlobIfExists, downloadBlob, uploadDataUrl } from '../shared/storage.js';
import type { AgeRating, VideoRecord } from '../shared/types.js';

type VideoCreateBody = Partial<VideoRecord> & {
  videoDataUrl?: string;
  thumbnailDataUrl?: string;
};

const validAges: AgeRating[] = ['All Ages', 'G', 'PG', 'PG-13', 'R', '11+', '16+', '18+'];
const editableFields = ['title', 'publisher', 'producer', 'genre', 'ageRating', 'thumbnailUrl'] as const;

const readJson = async <T>(request: HttpRequest) => (await request.json()) as T;

const mediaUrl = (request: HttpRequest, videoId: string, kind: 'media' | 'thumbnail') => {
  const origin = new URL(request.url).origin;
  return `${origin}/api/videos/${videoId}/${kind}`;
};

const isDataUrl = (value?: string) => Boolean(value?.startsWith('data:'));

export async function listVideos(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    await requireUser(request);
    const search = request.query.get('q')?.trim().toLowerCase() || '';
    const genre = request.query.get('genre')?.trim() || '';
    const creatorId = request.query.get('creatorId')?.trim() || '';

    const filters: string[] = [];
    const parameters: { name: string; value: string }[] = [];

    if (genre) {
      filters.push('c.genre = @genre');
      parameters.push({ name: '@genre', value: genre });
    }

    if (creatorId) {
      filters.push('c.creatorId = @creatorId');
      parameters.push({ name: '@creatorId', value: creatorId });
    }

    if (search) {
      filters.push('(CONTAINS(LOWER(c.title), @search) OR CONTAINS(LOWER(c.genre), @search) OR CONTAINS(LOWER(c.creatorName), @search) OR CONTAINS(LOWER(c.publisher), @search) OR CONTAINS(LOWER(c.producer), @search) OR CONTAINS(LOWER(c.ageRating), @search))');
      parameters.push({ name: '@search', value: search });
    }

    const query = `SELECT * FROM c ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''} ORDER BY c.createdAt DESC`;
    const { resources } = await containers.videos.items.query<VideoRecord>({ query, parameters }).fetchAll();
    return { jsonBody: resources };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function getVideo(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    await requireUser(request);
    const videoId = request.params.videoId;
    const { resource: video } = await containers.videos.item(videoId, videoId).read<VideoRecord>();
    if (!video) return { status: 404, jsonBody: { error: 'Video not found.' } };
    return { jsonBody: video };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function createVideo(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const user = await requireCreator(request);
    const body = await readJson<VideoCreateBody>(request);
    const videoSource = body.videoDataUrl || body.videoUrl;

    if (!body.title || !body.publisher || !body.producer || !body.genre || !videoSource) {
      return { status: 400, jsonBody: { error: 'Missing video details.' } };
    }

    if (!validAges.includes(body.ageRating as AgeRating)) {
      return { status: 400, jsonBody: { error: 'Invalid age rating.' } };
    }

    const id = body.id?.trim() || createId('vid');
    const videoUpload = isDataUrl(videoSource)
      ? await uploadDataUrl(`videos/${id}`, 'source', videoSource)
      : null;
    const thumbnailUpload = isDataUrl(body.thumbnailDataUrl || body.thumbnailUrl)
      ? await uploadDataUrl(`videos/${id}`, 'thumbnail', body.thumbnailDataUrl || body.thumbnailUrl)
      : null;

    const video: VideoRecord = {
      id,
      title: body.title.trim(),
      publisher: body.publisher.trim(),
      producer: body.producer.trim(),
      genre: body.genre.trim(),
      ageRating: body.ageRating as AgeRating,
      videoUrl: videoUpload ? mediaUrl(request, id, 'media') : videoSource,
      thumbnailUrl: thumbnailUpload ? mediaUrl(request, id, 'thumbnail') : body.thumbnailUrl || '',
      storagePath: videoUpload?.path || body.storagePath,
      thumbnailPath: thumbnailUpload?.path || body.thumbnailPath,
      storageContentType: videoUpload?.contentType,
      thumbnailContentType: thumbnailUpload?.contentType,
      fileName: body.fileName,
      creatorId: user.id,
      creatorName: user.displayName,
      creatorPhotoURL: user.photoURL || '',
      createdAt: nowIso(),
      likes: [],
      ratings: {},
      averageRating: 0,
      viewCount: 0,
      shareCount: 0
    };

    await containers.videos.items.create(video);
    await createActivity({
      recipientId: user.id,
      actorId: user.id,
      actorName: user.displayName,
      videoId: video.id,
      type: 'upload',
      text: `Uploaded ${video.title}`,
      thumbnailUrl: video.thumbnailUrl
    });

    return { status: 201, jsonBody: video };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function updateVideo(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const user = await requireUser(request);
    const videoId = request.params.videoId;
    const body = await readJson<Partial<VideoRecord>>(request);
    const { resource: video } = await containers.videos.item(videoId, videoId).read<VideoRecord>();

    if (!video) return { status: 404, jsonBody: { error: 'Video not found.' } };
    if (video.creatorId !== user.id) return { status: 403, jsonBody: { error: 'Only the creator can edit this video.' } };

    for (const field of editableFields) {
      if (body[field] !== undefined) {
        (video as any)[field] = typeof body[field] === 'string' ? body[field].trim() : body[field];
      }
    }

    if (!validAges.includes(video.ageRating)) {
      return { status: 400, jsonBody: { error: 'Invalid age rating.' } };
    }

    video.updatedAt = nowIso();
    const { resource } = await containers.videos.item(video.id, video.id).replace(video);
    return { jsonBody: resource || video };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function deleteVideo(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const user = await requireUser(request);
    const videoId = request.params.videoId;
    const { resource: video } = await containers.videos.item(videoId, videoId).read<VideoRecord>();

    if (!video) return { status: 404, jsonBody: { error: 'Video not found.' } };
    if (video.creatorId !== user.id) return { status: 403, jsonBody: { error: 'Only the creator can delete this video.' } };

    await containers.videos.item(videoId, videoId).delete();
    await Promise.all([
      deleteBlobIfExists(video.storagePath),
      deleteBlobIfExists(video.thumbnailPath)
    ]);

    const comments = await containers.comments.items
      .query({ query: 'SELECT c.id, c.videoId FROM c WHERE c.videoId = @videoId', parameters: [{ name: '@videoId', value: videoId }] })
      .fetchAll();
    await Promise.all(comments.resources.map((comment: any) => containers.comments.item(comment.id, comment.videoId).delete()));

    return { status: 204 };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function toggleLike(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const user = await requireUser(request);
    const videoId = request.params.videoId;
    const { resource: video } = await containers.videos.item(videoId, videoId).read<VideoRecord>();

    if (!video) return { status: 404, jsonBody: { error: 'Video not found.' } };

    const liked = video.likes.includes(user.id);
    video.likes = liked ? video.likes.filter((id) => id !== user.id) : [...video.likes, user.id];
    video.updatedAt = nowIso();
    await containers.videos.item(video.id, video.id).replace(video);

    if (!liked && user.id !== video.creatorId) {
      await createActivity({
        recipientId: video.creatorId,
        actorId: user.id,
        actorName: user.displayName,
        videoId,
        type: 'like',
        text: `Liked ${video.title}`,
        thumbnailUrl: video.thumbnailUrl
      });
    }

    return { jsonBody: video };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function trackView(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    await requireUser(request);
    const videoId = request.params.videoId;
    const { resource: video } = await containers.videos.item(videoId, videoId).read<VideoRecord>();
    if (!video) return { status: 404, jsonBody: { error: 'Video not found.' } };

    video.viewCount = (video.viewCount || 0) + 1;
    video.updatedAt = nowIso();
    await containers.videos.item(video.id, video.id).replace(video);
    return { jsonBody: video };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function trackShare(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    await requireUser(request);
    const videoId = request.params.videoId;
    const { resource: video } = await containers.videos.item(videoId, videoId).read<VideoRecord>();
    if (!video) return { status: 404, jsonBody: { error: 'Video not found.' } };

    video.shareCount = (video.shareCount || 0) + 1;
    video.updatedAt = nowIso();
    await containers.videos.item(video.id, video.id).replace(video);
    return { jsonBody: video };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function getMedia(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const videoId = request.params.videoId;
    const { resource: video } = await containers.videos.item(videoId, videoId).read<VideoRecord>();
    if (!video?.storagePath) return { status: 404, jsonBody: { error: 'Media not found.' } };

    const media = await downloadBlob(video.storagePath);
    if (!media) return { status: 404, jsonBody: { error: 'Media not found.' } };

    return {
      body: media.buffer as any,
      headers: {
        'Content-Type': media.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function getThumbnail(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const videoId = request.params.videoId;
    const { resource: video } = await containers.videos.item(videoId, videoId).read<VideoRecord>();
    if (!video?.thumbnailPath) return { status: 404, jsonBody: { error: 'Thumbnail not found.' } };

    const thumbnail = await downloadBlob(video.thumbnailPath);
    if (!thumbnail) return { status: 404, jsonBody: { error: 'Thumbnail not found.' } };

    return {
      body: thumbnail.buffer as any,
      headers: {
        'Content-Type': thumbnail.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    };
  } catch (error) {
    return asHttpError(error);
  }
}

app.http('listVideos', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'videos',
  handler: listVideos
});

app.http('createVideo', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'videos',
  handler: createVideo
});

app.http('getVideo', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'videos/{videoId}',
  handler: getVideo
});

app.http('updateVideo', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'videos/{videoId}',
  handler: updateVideo
});

app.http('deleteVideo', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'videos/{videoId}',
  handler: deleteVideo
});

app.http('toggleLike', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'videos/{videoId}/likes',
  handler: toggleLike
});

app.http('trackView', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'videos/{videoId}/views',
  handler: trackView
});

app.http('trackShare', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'videos/{videoId}/shares',
  handler: trackShare
});

app.http('getMedia', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'videos/{videoId}/media',
  handler: getMedia
});

app.http('getThumbnail', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'videos/{videoId}/thumbnail',
  handler: getThumbnail
});
