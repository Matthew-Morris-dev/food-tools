import { Platform } from 'react-native';

import { authClient } from './auth-client';
import { API_URL } from './config';

// Calls our API with the signed-in session. Native apps have no cookie jar, so the
// session cookie Better Auth keeps in SecureStore is attached by hand.
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (Platform.OS !== 'web') {
    const cookie = await authClient.getCookie();
    if (cookie) headers.set('Cookie', cookie);
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: Platform.OS === 'web' ? 'include' : 'omit',
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
