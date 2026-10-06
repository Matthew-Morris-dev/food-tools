import { Platform } from 'react-native';

import { authClient } from './auth-client';
import { API_URL } from './config';
import type { BarcodeResult, Food, LogEntry, NewCustomFood, Slot } from './types';

// Calls our API with the signed-in session. Native apps have no cookie jar, so the
// session cookie Better Auth keeps in SecureStore is attached by hand.
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (Platform.OS !== 'web') {
    const cookie = await authClient.getCookie();
    if (cookie) headers.set('Cookie', cookie);
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: Platform.OS === 'web' ? 'include' : 'omit',
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message && message.length < 200 ? message : `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const api = {
  searchFoods: (q: string) => apiFetch<Food[]>(`/api/foods/search?q=${encodeURIComponent(q)}`),
  searchOpenFoodFacts: (q: string) => apiFetch<Food[]>(`/api/foods/search-off?q=${encodeURIComponent(q)}`),
  recentFoods: () => apiFetch<Food[]>('/api/foods/recent'),
  food: (id: string) => apiFetch<Food>(`/api/foods/${id}`),
  barcode: (code: string) => apiFetch<BarcodeResult>(`/api/foods/barcode/${code}`),
  createFood: (food: NewCustomFood) => apiFetch<Food>('/api/foods', json('POST', food)),

  dayLog: (date: string) => apiFetch<LogEntry[]>(`/api/log?date=${date}`),
  logFood: (entry: { date: string; slot: Slot; foodId: string; grams: number }) =>
    apiFetch<LogEntry>('/api/log', json('POST', entry)),
  quickAdd: (entry: {
    date: string;
    slot: Slot;
    quick: { name?: string; kcal: number; protein: number; carbs: number; fat: number };
  }) => apiFetch<LogEntry>('/api/log', json('POST', entry)),
  updateEntry: (id: string, changes: { slot?: Slot; grams?: number }) =>
    apiFetch<LogEntry>(`/api/log/${id}`, json('PATCH', changes)),
  deleteEntry: (id: string) => apiFetch<void>(`/api/log/${id}`, { method: 'DELETE' }),
};
