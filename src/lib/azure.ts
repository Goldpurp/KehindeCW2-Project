const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;

const AZURE_API_BASE_URL =
  viteEnv?.VITE_AZURE_API_BASE_URL?.replace(/\/$/, '') ||
  'https://goldpurpapi174522579.azurewebsites.net/api';

const CURRENT_USER_KEY = 'kehindecw2_current_user';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface AzureErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: unknown;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: 'creator' | 'consumer';
  photoURL?: string;
  followingIds?: string[];
  token?: string;
  emailVerified: boolean;
  isAnonymous: boolean;
  providerData: unknown[];
}

type AuthResponse = {
  user: {
    id?: string;
    uid?: string;
    email?: string;
    displayName?: string;
    role?: 'creator' | 'consumer';
    photoURL?: string;
    followingIds?: string[];
  };
  token: string;
};

type ArrayMutation = {
  type: 'arrayUnion' | 'arrayRemove';
  items: unknown[];
};

type SnapshotDoc = {
  id: string;
  data: () => any;
};

const authListeners = new Set<(user: User | null) => void>();
const snapshotListeners = new Set<() => void>();

const stableUserId = (email: string) => {
  const normalized = email.trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(index)) | 0;
  }
  return `user_${Math.abs(hash).toString(36)}`;
};

const readStoredUser = (): User | null => {
  try {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    const parsed = stored ? JSON.parse(stored) as User : null;
    if (parsed && !parsed.token) {
      localStorage.removeItem(CURRENT_USER_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

let currentAzureUser: User | null = readStoredUser();

const writeStoredUser = (user: User | null) => {
  currentAzureUser = user;
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
};

const notifyAuthChange = () => {
  authListeners.forEach((listener) => listener(currentAzureUser));
};

const notifyDataChange = () => {
  snapshotListeners.forEach((listener) => listener());
};

const authHeaders = () => {
  const user = currentAzureUser;
  if (!user) return {};

  const headers: Record<string, string> = {
    'x-user-id': user.uid,
    'x-user-email': user.email || '',
    'x-user-name': user.displayName || 'KehindeCW2 user',
    'x-user-role': user.role || 'consumer'
  };

  if (user.token) {
    headers.Authorization = `Bearer ${user.token}`;
  }

  return headers;
};

const endpoint = (path: string) => `${AZURE_API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

const parseJson = async (response: Response) => {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const apiRequest = async <T = any>(path: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  Object.entries(authHeaders()).forEach(([key, value]) => headers.set(key, value));

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint(path), {
    ...init,
    headers
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    const message = typeof payload === 'object' && payload?.error ? payload.error : `Azure request failed (${response.status})`;
    if (response.status === 401 && currentAzureUser) {
      writeStoredUser(null);
      notifyAuthChange();
    }
    throw new Error(message);
  }

  return payload as T;
};

export function handleAzureError(error: unknown, operationType: OperationType, path: string | null) {
  console.error('Azure backend error:', { error, operationType, path, authInfo: currentAzureUser });
}

export const auth = {
  get currentUser() {
    return currentAzureUser;
  }
};

export const db = {
  provider: 'azure',
  apiBaseUrl: AZURE_API_BASE_URL
};

export function onAuthStateChanged(_authInstance: unknown, callback: (user: User | null) => void) {
  authListeners.add(callback);
  callback(currentAzureUser);
  return () => {
    authListeners.delete(callback);
  };
}

const userFromAuthResponse = (response: AuthResponse, fallbackEmail: string): User => {
  const profile = response.user;
  return {
    uid: profile.uid || profile.id || stableUserId(fallbackEmail),
    email: profile.email || fallbackEmail,
    displayName: profile.displayName || fallbackEmail.split('@')[0] || 'KehindeCW2 user',
    role: profile.role || 'consumer',
    photoURL: profile.photoURL || '',
    followingIds: Array.isArray(profile.followingIds) ? profile.followingIds : [],
    token: response.token,
    emailVerified: true,
    isAnonymous: false,
    providerData: []
  };
};

export async function signInWithEmailAndPassword(_authInstance: unknown, email: string, password: string) {
  const uid = stableUserId(email);
  const response = await apiRequest<AuthResponse>('/auth/signin', {
    method: 'POST',
    body: JSON.stringify({
      uid,
      email: email.trim().toLowerCase(),
      password
    })
  });
  const user = userFromAuthResponse(response, email.trim().toLowerCase());

  writeStoredUser(user);
  notifyAuthChange();
  return { user };
}

export async function createUserWithEmailAndPassword(
  _authInstance: unknown,
  email: string,
  password: string,
  profile: { displayName?: string; role?: 'creator' | 'consumer' } = {}
) {
  const uid = stableUserId(email);
  const fallbackEmail = email.trim().toLowerCase();
  const response = await apiRequest<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      uid,
      email: fallbackEmail,
      password,
      displayName: profile.displayName?.trim() || fallbackEmail.split('@')[0] || 'KehindeCW2 user',
      role: profile.role || 'consumer'
    })
  });
  const user = userFromAuthResponse(response, fallbackEmail);

  writeStoredUser(user);
  notifyAuthChange();
  notifyDataChange();
  return { user };
}

export async function signOut(_authInstance: unknown) {
  writeStoredUser(null);
  notifyAuthChange();
}

export async function updateProfile(userInstance: User, profileUpdate: { displayName?: string; photoURL?: string }) {
  const displayName = profileUpdate.displayName?.trim();
  const photoURL = profileUpdate.photoURL;
  if (!displayName && photoURL === undefined) return;

  const nextUser = {
    ...userInstance,
    ...(displayName ? { displayName } : {}),
    ...(photoURL !== undefined ? { photoURL } : {})
  };

  writeStoredUser(nextUser);
  notifyAuthChange();

  await apiRequest(`/users/${userInstance.uid}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(displayName ? { displayName } : {}),
      ...(photoURL !== undefined ? { photoURL } : {})
    })
  }).catch(() => undefined);
}

export class AzureCollectionReference {
  constructor(public dbInstance: unknown, public path: string, public parentPath: string | null = null) {}
}

export class AzureDocumentReference {
  constructor(public dbInstance: unknown, public path: string, public id: string, public parentPath: string) {}
}

export class AzureQuery {
  constructor(public colRef: AzureCollectionReference, public constraints: unknown[] = []) {}
}

export function collection(dbInstance: unknown, ...paths: string[]) {
  const fullPath = paths.join('/');
  return new AzureCollectionReference(dbInstance, fullPath);
}

export function doc(dbInstance: unknown, ...paths: string[]) {
  const fullPath = paths.join('/');
  const id = paths[paths.length - 1];
  const parentPath = paths.slice(0, paths.length - 1).join('/');
  return new AzureDocumentReference(dbInstance, fullPath, id, parentPath);
}

export function query(colRef: AzureCollectionReference, ...constraints: unknown[]) {
  return new AzureQuery(colRef, constraints);
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function arrayUnion(...items: unknown[]): ArrayMutation {
  return { type: 'arrayUnion', items };
}

export function arrayRemove(...items: unknown[]): ArrayMutation {
  return { type: 'arrayRemove', items };
}

const getCollectionPath = (queryOrColRef: AzureQuery | AzureCollectionReference) => (
  queryOrColRef instanceof AzureQuery ? queryOrColRef.colRef.path : queryOrColRef.path
);

const getVideoIdFromCommentPath = (path: string) => path.split('/')[1];

const makeSnapshot = (items: any[]) => {
  const docs: SnapshotDoc[] = items.map((item) => ({
    id: item.id || item.uid,
    data: () => item
  }));

  return {
    size: docs.length,
    docs,
    forEach: (callback: (doc: SnapshotDoc) => void) => {
      docs.forEach(callback);
    }
  };
};

export async function getDoc(docRef: AzureDocumentReference) {
  const collectionName = docRef.parentPath.split('/').pop() || docRef.parentPath;
  let foundData: any = null;

  try {
    if (collectionName === 'users') {
      foundData = await apiRequest(`/users/${docRef.id}`);
    } else if (collectionName === 'videos') {
      foundData = await apiRequest(`/videos/${docRef.id}`);
    } else if (docRef.parentPath.includes('comments')) {
      const videoId = getVideoIdFromCommentPath(docRef.parentPath);
      const comments = await apiRequest<any[]>(`/videos/${videoId}/comments`);
      foundData = comments.find((comment) => comment.id === docRef.id) || null;
    }
  } catch {
    foundData = null;
  }

  return {
    exists: () => foundData !== null && foundData !== undefined,
    data: () => foundData
  };
}

export async function getDocs(queryOrColRef: AzureQuery | AzureCollectionReference) {
  const path = getCollectionPath(queryOrColRef);
  const parts = path.split('/');
  const collectionName = parts[parts.length - 1];
  let list: any[] = [];

  if (collectionName === 'users') {
    list = await apiRequest('/users');
  } else if (collectionName === 'videos') {
    list = await apiRequest('/videos');
  } else if (collectionName === 'activities') {
    list = await apiRequest('/activities');
  } else if (path.includes('comments')) {
    const videoId = getVideoIdFromCommentPath(path);
    list = await apiRequest(`/videos/${videoId}/comments`);
  }

  return makeSnapshot(list);
}

export async function setDoc(docRef: AzureDocumentReference, data: any, _options?: unknown) {
  const collectionName = docRef.parentPath.split('/').pop() || docRef.parentPath;

  if (collectionName === 'users') {
    const profile = await apiRequest(`/users/${docRef.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, uid: docRef.id })
    });
    if (currentAzureUser?.uid === docRef.id) {
      writeStoredUser({
        ...currentAzureUser,
        displayName: profile.displayName || currentAzureUser.displayName,
        role: profile.role || currentAzureUser.role || 'consumer',
        photoURL: profile.photoURL ?? currentAzureUser.photoURL,
        followingIds: Array.isArray(profile.followingIds) ? profile.followingIds : currentAzureUser.followingIds || []
      });
      notifyAuthChange();
    }
  } else if (collectionName === 'videos') {
    await apiRequest('/videos', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  } else if (docRef.parentPath.includes('comments')) {
    const videoId = getVideoIdFromCommentPath(docRef.parentPath);
    await apiRequest(`/videos/${videoId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  notifyDataChange();
}

const isArrayMutation = (value: unknown): value is ArrayMutation => (
  Boolean(value && typeof value === 'object' && 'type' in value && 'items' in value)
);

export async function updateDoc(docRef: AzureDocumentReference, fields: any) {
  const collectionName = docRef.parentPath.split('/').pop() || docRef.parentPath;

  if (collectionName === 'users') {
    const profile = await apiRequest(`/users/${docRef.id}`, {
      method: 'PATCH',
      body: JSON.stringify(fields)
    });
    if (currentAzureUser?.uid === docRef.id) {
      writeStoredUser({
        ...currentAzureUser,
        displayName: profile.displayName || currentAzureUser.displayName,
        role: profile.role || currentAzureUser.role || 'consumer',
        photoURL: profile.photoURL ?? currentAzureUser.photoURL,
        followingIds: Array.isArray(profile.followingIds) ? profile.followingIds : currentAzureUser.followingIds || []
      });
      notifyAuthChange();
    }
  } else if (collectionName === 'videos') {
    if (isArrayMutation(fields.likes)) {
      await apiRequest(`/videos/${docRef.id}/likes`, { method: 'POST' });
    } else if (fields.ratings && currentAzureUser?.uid) {
      await apiRequest(`/videos/${docRef.id}/ratings`, {
        method: 'POST',
        body: JSON.stringify({ rating: fields.ratings[currentAzureUser.uid] })
      });
    } else if ('viewCount' in fields) {
      await apiRequest(`/videos/${docRef.id}/views`, { method: 'POST' });
    } else if ('shareCount' in fields) {
      await apiRequest(`/videos/${docRef.id}/shares`, { method: 'POST' });
    } else {
      await apiRequest(`/videos/${docRef.id}`, {
        method: 'PATCH',
        body: JSON.stringify(fields)
      });
    }
  } else if (docRef.parentPath.includes('comments')) {
    const videoId = getVideoIdFromCommentPath(docRef.parentPath);
    if (isArrayMutation(fields.likes)) {
      await apiRequest(`/videos/${videoId}/comments/${docRef.id}/likes`, { method: 'POST' });
    } else {
      await apiRequest(`/videos/${videoId}/comments/${docRef.id}`, {
        method: 'PATCH',
        body: JSON.stringify(fields)
      });
    }
  } else if (collectionName === 'activities') {
    await apiRequest(`/activities/${docRef.id}`, {
      method: 'PATCH',
      body: JSON.stringify(fields)
    });
  }

  notifyDataChange();
}

export async function deleteDoc(docRef: AzureDocumentReference) {
  const collectionName = docRef.parentPath.split('/').pop() || docRef.parentPath;

  if (collectionName === 'videos') {
    await apiRequest(`/videos/${docRef.id}`, { method: 'DELETE' });
  } else if (docRef.parentPath.includes('comments')) {
    const videoId = getVideoIdFromCommentPath(docRef.parentPath);
    await apiRequest(`/videos/${videoId}/comments/${docRef.id}`, { method: 'DELETE' });
  } else if (collectionName === 'users') {
    await apiRequest(`/users/${docRef.id}`, { method: 'DELETE' });
  }

  notifyDataChange();
}

export function onSnapshot(
  queryOrRef: AzureQuery | AzureDocumentReference,
  onNext: (snapshot: any) => void,
  onError?: (error: unknown) => void
) {
  let active = true;

  const syncAndTrigger = async () => {
    if (!active || !currentAzureUser) {
      if (!currentAzureUser) {
        onNext(makeSnapshot([]));
      }
      return;
    }

    try {
      if (queryOrRef instanceof AzureDocumentReference) {
        const snap = await getDoc(queryOrRef);
        if (active) onNext(snap);
        return;
      }

      const snap = await getDocs(queryOrRef);
      if (active) onNext(snap);
    } catch (error) {
      onError?.(error);
    }
  };

  const wrappedListener = () => {
    void syncAndTrigger();
  };

  snapshotListeners.add(wrappedListener);
  void syncAndTrigger();
  const timer = window.setInterval(syncAndTrigger, 5000);

  return () => {
    active = false;
    window.clearInterval(timer);
    snapshotListeners.delete(wrappedListener);
  };
}

export const azureBackend = {
  apiBaseUrl: AZURE_API_BASE_URL
};
