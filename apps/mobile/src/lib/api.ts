import { Platform } from 'react-native';

import { authClient } from './auth-client';
import { API_URL } from './config';
import type { Draft } from './recipe-draft';
import type {
  BarcodeResult,
  DayTargets,
  Food,
  Goal,
  ExerciseActivity,
  ExerciseEntry,
  GoalPlan,
  LogEntry,
  NewCustomFood,
  NewPlanEntry,
  PlanDay,
  PlanEntry,
  PlanWeek,
  PlannerSettings,
  Profile,
  Progress,
  ProgressRange,
  Recipe,
  RecipeInput,
  RecipeListItem,
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

  exercise: (date: string) => apiFetch<ExerciseEntry[]>(`/api/exercise?date=${date}`),
  estimateExercise: (p: { date: string; activity: ExerciseActivity; minutes: number }) =>
    apiFetch<{ kcal: number | null }>(`/api/exercise/estimate?date=${p.date}&activity=${p.activity}&minutes=${p.minutes}`),
  addExercise: (entry: { date: string; activity: ExerciseActivity; minutes: number; kcal?: number }) =>
    apiFetch<ExerciseEntry>('/api/exercise', json('POST', entry)),
  deleteExercise: (id: string) => apiFetch<void>(`/api/exercise/${id}`, { method: 'DELETE' }),

  recipes: (params: { q?: string; tag?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.tag) query.set('tag', params.tag);
    return apiFetch<RecipeListItem[]>(`/api/recipes?${query}`);
  },
  recipeTags: () => apiFetch<string[]>('/api/recipes/tags'),
  recipe: (id: string) => apiFetch<Recipe>(`/api/recipes/${id}`),
  createRecipe: (recipe: RecipeInput) => apiFetch<Recipe>('/api/recipes', json('POST', recipe)),
  updateRecipe: ({ id, ...recipe }: RecipeInput & { id: string }) =>
    apiFetch<Recipe>(`/api/recipes/${id}`, json('PUT', recipe)),
  deleteRecipe: (id: string) => apiFetch<void>(`/api/recipes/${id}`, { method: 'DELETE' }),
  logRecipe: ({ id, ...body }: { id: string; date: string; slot: Slot } & ({ servings: number } | { grams: number })) =>
    apiFetch<LogEntry>(`/api/recipes/${id}/log`, json('POST', body)),
  importOptions: () => apiFetch<{ claude: boolean }>('/api/recipes/import-options'),
  importRecipe: (source: ({ url: string } | { text: string }) & { useClaude?: boolean }) =>
    apiFetch<Draft>('/api/recipes/import', json('POST', source)),

  plan: (date: string) => apiFetch<PlanWeek>(`/api/plan?date=${date}`),
  planDay: (date: string) => apiFetch<PlanEntry[]>(`/api/plan/day/${date}`),
  addPlanEntry: (entry: NewPlanEntry) => apiFetch<PlanEntry>('/api/plan/entries', json('POST', entry)),
  updatePlanEntry: ({ id, ...changes }: { id: string; date?: string; slot?: Slot; servings?: number; grams?: number; locked?: boolean }) =>
    apiFetch<PlanEntry>(`/api/plan/entries/${id}`, json('PATCH', changes)),
  deletePlanEntry: (id: string) => apiFetch<void>(`/api/plan/entries/${id}`, { method: 'DELETE' }),
  deletePlanEntries: (ids: string[]) => apiFetch<{ deleted: number }>('/api/plan/entries/delete', json('POST', { ids })),
  fitPlanDay: (date: string) => apiFetch<{ day: PlanDay; clamped: boolean }>(`/api/plan/days/${date}/fit`, { method: 'POST' }),
  logPlanEntry: ({ id, ...overrides }: { id: string; slot?: Slot; servings?: number; grams?: number }) =>
    apiFetch<LogEntry>(`/api/plan/entries/${id}/log`, json('POST', overrides)),
  logPlanDay: (date: string) => apiFetch<LogEntry[]>(`/api/plan/days/${date}/log`, { method: 'POST' }),
  plannerSettings: () => apiFetch<PlannerSettings & { presets: { id: string; label: string }[] }>('/api/plan/settings'),
  savePlannerSettings: (settings: PlannerSettings) => apiFetch<PlannerSettings>('/api/plan/settings', json('PUT', settings)),
  autofillPlan: (body: { date: string; slots: Slot[]; leftovers: boolean; replace: boolean }) =>
    apiFetch<{
      ids: string[];
      added: number;
      leftovers: number;
      replaced: number;
      skipped: { date: string; slot: Slot; reason: string }[];
      excluded: { incomplete: number; disliked: number; diet: number };
    }>('/api/plan/autofill', json('POST', body)),
  planTemplates: () => apiFetch<{ id: string; name: string; entries: number }[]>('/api/plan/templates'),
  saveTemplate: (body: { name: string; date: string }) => apiFetch<{ id: string; name: string; entries: number }>('/api/plan/templates', json('POST', body)),
  deleteTemplate: (id: string) => apiFetch<void>(`/api/plan/templates/${id}`, { method: 'DELETE' }),
  applyTemplate: ({ id, ...body }: { id: string; date: string; replace: boolean }) =>
    apiFetch<{ ids: string[]; added: number; skipped: number; replaced: number }>(`/api/plan/templates/${id}/apply`, json('POST', body)),
};
