import { containers, createId, nowIso } from './cosmos.js';
import type { ActivityRecord } from './types.js';

export const createActivity = async (activity: Omit<ActivityRecord, 'id' | 'createdAt' | 'read'>) => {
  const record: ActivityRecord = {
    id: createId('act'),
    createdAt: nowIso(),
    read: false,
    ...activity
  };

  await containers.activities.items.create(record);
  return record;
};

