import { createHmac, timingSafeEqual } from 'node:crypto';
import type { HttpRequest } from '@azure/functions';
import { containers } from './cosmos.js';
import type { UserPrincipal, UserRecord, UserRole } from './types.js';

const validRole = (role: string | null): role is UserRole => role === 'creator' || role === 'consumer';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;

type TokenPayload = {
  uid: string;
  exp: number;
};

const authSecret = () => (
  process.env.AUTH_TOKEN_SECRET ||
  process.env.COSMOS_CONNECTION_STRING ||
  process.env.AzureWebJobsStorage ||
  'kehindecw2-local-dev-secret'
);

const toBase64Url = (value: string) => Buffer.from(value, 'utf8').toString('base64url');

const signPayload = (payload: string) => (
  createHmac('sha256', authSecret()).update(payload).digest('base64url')
);

const principalFromUser = (user: UserRecord): UserPrincipal => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  role: user.role
});

export const signAuthToken = (user: UserRecord) => {
  const payload = toBase64Url(JSON.stringify({
    uid: user.id,
    exp: Date.now() + TOKEN_TTL_MS
  } satisfies TokenPayload));
  return `${payload}.${signPayload(payload)}`;
};

const readBearerToken = (request: HttpRequest) => {
  const authorization = request.headers.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
};

const verifyToken = async (token: string): Promise<UserPrincipal | null> => {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = signPayload(payload);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return null;
  }

  let parsed: TokenPayload;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenPayload;
  } catch {
    return null;
  }

  if (!parsed.uid || parsed.exp < Date.now()) return null;

  const { resource: user } = await containers.users.item(parsed.uid, parsed.uid).read<UserRecord>();
  if (!user) return null;

  return principalFromUser(user);
};

export const getPrincipal = async (request: HttpRequest): Promise<UserPrincipal | null> => {
  const token = readBearerToken(request);
  if (token) {
    const principal = await verifyToken(token);
    if (principal) return principal;
  }

  const easyAuthPrincipal = request.headers.get('x-ms-client-principal');
  if (easyAuthPrincipal) {
    const decoded = JSON.parse(Buffer.from(easyAuthPrincipal, 'base64').toString('utf8'));
    const claims = decoded.claims || [];
    const claim = (type: string) => claims.find((item: any) => item.typ === type)?.val;
    const role = claim('roles') || request.headers.get('x-user-role') || 'consumer';
    return {
      id: decoded.userId || claim('sub'),
      email: decoded.userDetails || claim('emails') || '',
      displayName: claim('name') || decoded.userDetails || 'KehindeCW2 user',
      role: validRole(role) ? role : 'consumer'
    };
  }

  if (process.env.ALLOW_UNSAFE_HEADER_AUTH !== 'true') return null;

  const id = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!id || !validRole(role)) return null;

  return {
    id,
    email: request.headers.get('x-user-email') || '',
    displayName: request.headers.get('x-user-name') || 'KehindeCW2 user',
    role
  };
};

export const requireUser = async (request: HttpRequest) => {
  const principal = await getPrincipal(request);
  if (!principal) {
    throw new Response('Sign in required.', { status: 401, statusText: 'Sign in required.' });
  }
  return principal;
};

export const requireCreator = async (request: HttpRequest) => {
  const principal = await requireUser(request);
  if (principal.role !== 'creator') {
    throw new Response('Creator account required.', { status: 403, statusText: 'Creator account required.' });
  }
  return principal;
};

export const asHttpError = (error: unknown) => {
  if (error instanceof Response) {
    return {
      status: error.status,
      jsonBody: { error: error.statusText || 'Request failed' }
    };
  }

  console.error(error);
  return {
    status: 500,
    jsonBody: { error: 'Server error' }
  };
};
