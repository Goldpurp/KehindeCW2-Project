import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { containers, nowIso } from '../shared/cosmos.js';
import { asHttpError, requireUser, signAuthToken } from '../shared/auth.js';
import { createActivity } from '../shared/activity.js';
import type { UserRecord, UserRole } from '../shared/types.js';

const isRole = (role: unknown): role is UserRole => role === 'creator' || role === 'consumer';

type AuthBody = {
  uid?: string;
  email?: string;
  password?: string;
  displayName?: string;
  role?: UserRole;
};

type PublicUser = Omit<UserRecord, 'passwordHash' | 'passwordSalt'>;

const publicUser = (user: UserRecord): PublicUser => {
  const { passwordHash: _passwordHash, passwordSalt: _passwordSalt, ...safeUser } = user;
  return safeUser;
};

const passwordHash = (password: string, salt: string) => (
  scryptSync(password, salt, 64).toString('hex')
);

const verifyPassword = (password: string, salt: string, storedHash: string) => {
  const candidate = Buffer.from(passwordHash(password, salt), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
};

const normalizeEmail = (email?: string) => email?.trim().toLowerCase() || '';

const normalizeFollowingIds = (value: unknown, selfId: string) => {
  if (!Array.isArray(value)) return undefined;
  return Array.from(new Set(
    value
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.trim())
      .filter((id) => id && id !== selfId)
  ));
};

const normalizeUser = (userId: string, body: Partial<UserRecord>): UserRecord => {
  const now = nowIso();
  return {
    id: userId,
    uid: userId,
    email: body.email || '',
    displayName: body.displayName?.trim() || body.email?.split('@')[0] || 'KehindeCW2 user',
    role: isRole(body.role) ? body.role : 'consumer',
    bio: body.bio || '',
    photoURL: body.photoURL || '',
    followingIds: normalizeFollowingIds(body.followingIds, userId) || [],
    passwordHash: body.passwordHash,
    passwordSalt: body.passwordSalt,
    createdAt: body.createdAt || now,
    updatedAt: now
  };
};

const createFollowActivities = async (before: UserRecord, after: UserRecord) => {
  const previous = new Set(before.followingIds || []);
  const additions = (after.followingIds || []).filter((id) => !previous.has(id));

  await Promise.all(additions.map(async (creatorId) => {
    const { resource: creator } = await containers.users.item(creatorId, creatorId).read<UserRecord>();
    if (!creator || creator.id === after.id) return;

    await createActivity({
      recipientId: creator.id,
      actorId: after.id,
      actorName: after.displayName,
      type: 'follow',
      text: 'started following you'
    });
  }));
};

export async function listUsers(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    await requireUser(request);
    const search = request.query.get('q')?.trim().toLowerCase() || '';
    const role = request.query.get('role')?.trim();

    const filters: string[] = [];
    const parameters: { name: string; value: string }[] = [];

    if (isRole(role)) {
      filters.push('c.role = @role');
      parameters.push({ name: '@role', value: role });
    }

    if (search) {
      filters.push('(CONTAINS(LOWER(c.displayName), @search) OR CONTAINS(LOWER(c.email), @search))');
      parameters.push({ name: '@search', value: search });
    }

    const query = `SELECT * FROM c ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''} ORDER BY c.createdAt DESC`;
    const { resources } = await containers.users.items.query<UserRecord>({ query, parameters }).fetchAll();
    return { jsonBody: resources.map(publicUser) };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function getUser(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    await requireUser(request);
    const userId = request.params.userId;

    const { resource } = await containers.users.item(userId, userId).read<UserRecord>();
    if (!resource) return { status: 404, jsonBody: { error: 'User not found.' } };
    return { jsonBody: publicUser(resource) };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function upsertUser(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const current = await requireUser(request);
    const userId = request.params.userId;
    if (current.id !== userId) {
      return { status: 403, jsonBody: { error: 'Cannot update another account.' } };
    }

    const body = (await request.json()) as Partial<UserRecord>;
    const { resource: existing } = await containers.users.item(userId, userId).read<UserRecord>();
    if (!existing) return { status: 404, jsonBody: { error: 'User not found.' } };

    const user: UserRecord = {
      ...existing,
      displayName: body.displayName?.trim() || existing.displayName,
      bio: body.bio ?? existing.bio,
      photoURL: body.photoURL ?? existing.photoURL,
      followingIds: normalizeFollowingIds(body.followingIds, userId) ?? existing.followingIds ?? [],
      updatedAt: nowIso()
    };
    const { resource } = await containers.users.item(userId, userId).replace<UserRecord>(user);
    const saved = resource || user;
    await createFollowActivities(existing, saved);
    return { status: 200, jsonBody: publicUser(saved) };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function updateUser(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const current = await requireUser(request);
    const userId = request.params.userId;
    if (current.id !== userId) {
      return { status: 403, jsonBody: { error: 'Cannot update another account.' } };
    }

    const body = (await request.json()) as Partial<UserRecord>;
    const { resource: existing } = await containers.users.item(userId, userId).read<UserRecord>();
    if (!existing) return { status: 404, jsonBody: { error: 'User not found.' } };

    const user: UserRecord = {
      ...existing,
      displayName: body.displayName?.trim() || existing.displayName,
      email: body.email || existing.email,
      role: existing.role,
      bio: body.bio ?? existing.bio,
      photoURL: body.photoURL ?? existing.photoURL,
      followingIds: normalizeFollowingIds(body.followingIds, userId) ?? existing.followingIds ?? [],
      updatedAt: nowIso()
    };

    const { resource } = await containers.users.item(userId, userId).replace<UserRecord>(user);
    const saved = resource || user;
    await createFollowActivities(existing, saved);
    return { jsonBody: publicUser(saved) };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function deleteUser(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const current = await requireUser(request);
    const userId = request.params.userId;
    if (current.id !== userId) {
      return { status: 403, jsonBody: { error: 'Cannot delete another account.' } };
    }
    await containers.users.item(userId, userId).delete();
    return { status: 204 };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function signUp(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as AuthBody;
    const email = normalizeEmail(body.email);
    const password = body.password || '';
    const uid = body.uid?.trim();

    if (!uid || !email || !password) {
      return { status: 400, jsonBody: { error: 'Email and password are required.' } };
    }

    if (password.length < 6) {
      return { status: 400, jsonBody: { error: 'Password must be at least 6 characters.' } };
    }

    const { resource: existing } = await containers.users.item(uid, uid).read<UserRecord>();
    if (existing) {
      return { status: 409, jsonBody: { error: 'This email is already registered.' } };
    }

    const salt = randomBytes(16).toString('hex');
    const now = nowIso();
    const user: UserRecord = {
      id: uid,
      uid,
      email,
      displayName: body.displayName?.trim() || email.split('@')[0] || 'KehindeCW2 user',
      role: isRole(body.role) ? body.role : 'consumer',
      bio: isRole(body.role) && body.role === 'creator' ? 'Creator account' : 'Consumer account',
      photoURL: '',
      followingIds: [],
      passwordHash: passwordHash(password, salt),
      passwordSalt: salt,
      createdAt: now,
      updatedAt: now
    };

    const { resource } = await containers.users.items.create<UserRecord>(user);
    const created = resource || user;
    return {
      status: 201,
      jsonBody: {
        user: publicUser(created),
        token: signAuthToken(created)
      }
    };
  } catch (error) {
    return asHttpError(error);
  }
}

export async function signIn(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as AuthBody;
    const uid = body.uid?.trim();
    const password = body.password || '';

    if (!uid || !password) {
      return { status: 400, jsonBody: { error: 'Email and password are required.' } };
    }

    const { resource: user } = await containers.users.item(uid, uid).read<UserRecord>();
    if (!user?.passwordHash || !user.passwordSalt || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return { status: 401, jsonBody: { error: 'No registered account matches those details.' } };
    }

    return {
      jsonBody: {
        user: publicUser(user),
        token: signAuthToken(user)
      }
    };
  } catch (error) {
    return asHttpError(error);
  }
}

app.http('listUsers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'users',
  handler: listUsers
});

app.http('getUser', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'users/{userId}',
  handler: getUser
});

app.http('upsertUser', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'users/{userId}',
  handler: upsertUser
});

app.http('updateUser', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'users/{userId}',
  handler: updateUser
});

app.http('deleteUser', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'users/{userId}',
  handler: deleteUser
});

app.http('signUp', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/signup',
  handler: signUp
});

app.http('signIn', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/signin',
  handler: signIn
});
