import { CosmosClient } from '@azure/cosmos';

const connectionString = process.env.COSMOS_CONNECTION_STRING;
const databaseName = process.env.COSMOS_DATABASE_NAME || 'kehindecw2';

if (!connectionString) {
  throw new Error('COSMOS_CONNECTION_STRING is required');
}

const client = new CosmosClient(connectionString);
const database = client.database(databaseName);

export const containers = {
  users: database.container('users'),
  videos: database.container('videos'),
  comments: database.container('comments'),
  activities: database.container('activities')
};

export const nowIso = () => new Date().toISOString();

export const createId = (prefix: string) => {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `${prefix}_${random}`;
};
