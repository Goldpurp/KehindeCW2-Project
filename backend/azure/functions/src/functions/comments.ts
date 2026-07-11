import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { containers, createId, nowIso } from '../shared/cosmos.js';
import { asHttpError, requireUser } from '../shared/auth.js';
import { createActivity } from '../shared/activity.js';
import type { CommentRecord, VideoRecord } from '../shared/types.js';

export async function listComments(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    await requireUser(request);
    const videoId = request.params.videoId;
    const { resources } = await containers.comments.items
      .query<CommentRecord>({
        query: 'SELECT * FROM c WHERE c.videoId = @videoId ORDER BY c.createdAt DESC',
        parameters: [{ name: '@videoId', value: videoId }]
      })
      .fetchAll();

    return { jsonBody: resources };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function createComment(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const user = await requireUser(request);
    const videoId = request.params.videoId;
    const body = (await request.json()) as Partial<CommentRecord>;

    if (!body.text?.trim()) {
      return { status: 400, jsonBody: { error: 'Comment is required.' } };
    }

    const { resource: video } = await containers.videos.item(videoId, videoId).read<VideoRecord>();
    if (!video) return { status: 404, jsonBody: { error: 'Video not found.' } };

    const comment: CommentRecord = {
      id: body.id?.trim() || createId('comment'),
      videoId,
      userId: user.id,
      userName: user.displayName,
      text: body.text.trim(),
      likes: [],
      createdAt: nowIso()
    };

    await containers.comments.items.create(comment);

    if (user.id !== video.creatorId) {
      await createActivity({
        recipientId: video.creatorId,
        actorId: user.id,
        actorName: user.displayName,
        videoId,
        commentId: comment.id,
        type: 'comment',
        text: comment.text,
        thumbnailUrl: video.thumbnailUrl
      });
    }

    return { status: 201, jsonBody: comment };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function updateComment(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const user = await requireUser(request);
    const videoId = request.params.videoId;
    const commentId = request.params.commentId;
    const body = (await request.json()) as Partial<CommentRecord>;
    const { resource: comment } = await containers.comments.item(commentId, videoId).read<CommentRecord>();

    if (!comment) return { status: 404, jsonBody: { error: 'Comment not found.' } };
    if (comment.userId !== user.id) return { status: 403, jsonBody: { error: 'Cannot edit this comment.' } };
    if (!body.text?.trim()) return { status: 400, jsonBody: { error: 'Comment is required.' } };

    comment.text = body.text.trim();
    await containers.comments.item(comment.id, comment.videoId).replace(comment);
    return { jsonBody: comment };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function deleteComment(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const user = await requireUser(request);
    const videoId = request.params.videoId;
    const commentId = request.params.commentId;
    const { resource: comment } = await containers.comments.item(commentId, videoId).read<CommentRecord>();
    const { resource: video } = await containers.videos.item(videoId, videoId).read<VideoRecord>();

    if (!comment) return { status: 404, jsonBody: { error: 'Comment not found.' } };
    if (comment.userId !== user.id && video?.creatorId !== user.id) {
      return { status: 403, jsonBody: { error: 'Cannot delete this comment.' } };
    }

    await containers.comments.item(commentId, videoId).delete();
    return { status: 204 };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function toggleCommentLike(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const user = await requireUser(request);
    const videoId = request.params.videoId;
    const commentId = request.params.commentId;
    const { resource: comment } = await containers.comments.item(commentId, videoId).read<CommentRecord>();

    if (!comment) return { status: 404, jsonBody: { error: 'Comment not found.' } };

    const liked = comment.likes.includes(user.id);
    comment.likes = liked ? comment.likes.filter((id) => id !== user.id) : [...comment.likes, user.id];
    await containers.comments.item(comment.id, comment.videoId).replace(comment);

    if (!liked && user.id !== comment.userId) {
      const { resource: video } = await containers.videos.item(videoId, videoId).read<VideoRecord>();
      await createActivity({
        recipientId: comment.userId,
        actorId: user.id,
        actorName: user.displayName,
        videoId,
        commentId: comment.id,
        type: 'like',
        text: `Liked your comment: ${comment.text}`,
        thumbnailUrl: video?.thumbnailUrl
      });
    }

    return { jsonBody: comment };
  } catch (error) {
    return asHttpError(error);
  }
}

app.http('listComments', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'videos/{videoId}/comments',
  handler: listComments
});

app.http('createComment', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'videos/{videoId}/comments',
  handler: createComment
});

app.http('updateComment', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'videos/{videoId}/comments/{commentId}',
  handler: updateComment
});

app.http('deleteComment', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'videos/{videoId}/comments/{commentId}',
  handler: deleteComment
});

app.http('toggleCommentLike', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'videos/{videoId}/comments/{commentId}/likes',
  handler: toggleCommentLike
});
