import { Platform } from 'react-native';

import { authClient } from './auth-client';
import { API_URL } from './config';
import type {
  BarcodeResult,
  DayTargets,
  Food,
  Goal,
  GoalPlan,
  LogEntry,
  NewCustomFood,
  Profile,
  Progress,
  ProgressRange,
  SavedMeal,
  SetupInput,
  Slot,
  WeightPoint,
} from './types';

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

  savedMeals: () => apiFetch<SavedMeal[]>('/api/saved-meals'),
  createSavedMeal: (meal: { name: string; entryIds: string[] }) =>
    apiFetch<SavedMeal>('/api/saved-meals', json('POST', meal)),
  renameSavedMeal: (id: string, name: string) => apiFetch<SavedMeal>(`/api/saved-meals/${id}`, json('PATCH', { name })),
  deleteSavedMeal: (id: string) => apiFetch<void>(`/api/saved-meals/${id}`, { method: 'DELETE' }),
  logSavedMeal: (id: string, target: { date: string; slot: Slot }) =>
    apiFetch<LogEntry[]>(`/api/saved-meals/${id}/log`, json('POST', target)),

  profile: () => apiFetch<Profile | null>('/api/profile'),
  setUnits: (units: Partial<Pick<Profile, 'weightUnit' | 'heightUnit'>>) =>
    apiFetch<Profile>('/api/profile/units', json('PATCH', units)),
  currentGoal: (date: string) => apiFetch<Goal | null>(`/api/goals/current?date=${date}`),
  previewGoal: (input: SetupInput) => apiFetch<GoalPlan>('/api/goals/preview', json('POST', input)),
  saveGoal: (input: SetupInput) => apiFetch<{ goal: Goal; plan: GoalPlan }>('/api/goals', json('POST', input)),
  dayTargets: (date: string) => apiFetch<DayTargets | null>(`/api/goals/day/${date}`),
  setTrainingDay: (date: string, trainingDay: boolean | null) =>
    apiFetch<void>(`/api/goals/day/${date}/training`, json('PUT', { trainingDay })),

  weights: () => apiFetch<WeightPoint[]>('/api/weights'),
  saveWeight: ({ date, weightKg }: { date: string; weightKg: number }) =>
    apiFetch<{ date: string; weightKg: number }>(`/api/weights/${date}`, json('PUT', { weightKg })),
  deleteWeight: (date: string) => apiFetch<void>(`/api/weights/${date}`, { method: 'DELETE' }),
  progress: (date: string, range: ProgressRange) => apiFetch<Progress>(`/api/progress?date=${date}&range=${range}`),
  submitCheckIn: (body: { date: string; accept: boolean }) => apiFetch<void>('/api/check-in', json('POST', body)),
};
