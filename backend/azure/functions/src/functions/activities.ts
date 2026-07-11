import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { containers } from '../shared/cosmos.js';
import { asHttpError, requireUser } from '../shared/auth.js';
import type { ActivityRecord } from '../shared/types.js';

export async function listActivities(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const user = await requireUser(request);
    const { resources } = await containers.activities.items
      .query<ActivityRecord>({
        query: 'SELECT * FROM c WHERE c.recipientId = @recipientId ORDER BY c.createdAt DESC',
        parameters: [{ name: '@recipientId', value: user.id }]
      })
      .fetchAll();

    return { jsonBody: resources };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function markActivityRead(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const user = await requireUser(request);
    const activityId = request.params.activityId;
    const { resource: activity } = await containers.activities.item(activityId, user.id).read<ActivityRecord>();

    if (!activity) return { status: 404, jsonBody: { error: 'Activity not found.' } };

    activity.read = true;
    await containers.activities.item(activityId, user.id).replace(activity);

    return { jsonBody: activity };
  } catch (error) {
    return asHttpError(error);
  }
}

app.http('listActivities', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'activities',
  handler: listActivities
});

app.http('markActivityRead', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'activities/{activityId}',
  handler: markActivityRead
});

