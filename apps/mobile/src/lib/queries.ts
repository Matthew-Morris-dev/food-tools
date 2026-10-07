import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './api';
import type { ExerciseActivity, LogEntry, ProgressRange, SetupInput } from './types';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export const useDayLog = (date: string) => useQuery({ queryKey: ['log', date], queryFn: () => api.dayLog(date) });

export const useFood = (id: string) => useQuery({ queryKey: ['food', id], queryFn: () => api.food(id) });

export const useRecentFoods = () => useQuery({ queryKey: ['foods', 'recent'], queryFn: api.recentFoods });

export const useFoodSearch = (q: string) =>
  useQuery({ queryKey: ['foods', 'search', q], queryFn: () => api.searchFoods(q), enabled: q.length > 0 });

// Open Food Facts limits searches, so this only runs when the user asks for it
export const useOpenFoodFactsSearch = (q: string, enabled: boolean) =>
  useQuery({
    queryKey: ['foods', 'off', q],
    queryFn: () => api.searchOpenFoodFacts(q),
    enabled: enabled && q.length > 1,
    staleTime: Infinity,
  });

export const useSavedMeals = () => useQuery({ queryKey: ['saved-meals'], queryFn: api.savedMeals });

// Refreshes the day and the recent list after any change to the log
function useLogMutation<TArgs>(fn: (args: TArgs) => Promise<LogEntry | LogEntry[] | void>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['log'] });
      void client.invalidateQueries({ queryKey: ['foods', 'recent'] });
      // Logging a meal changes the order of the saved meals list
      void client.invalidateQueries({ queryKey: ['saved-meals'] });
    },
  });
}

function useSavedMealMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void client.invalidateQueries({ queryKey: ['saved-meals'] }),
  });
}

export const useCreateSavedMeal = () => useSavedMealMutation(api.createSavedMeal);
export const useRenameSavedMeal = () =>
  useSavedMealMutation(({ id, name }: { id: string; name: string }) => api.renameSavedMeal(id, name));
export const useDeleteSavedMeal = () => useSavedMealMutation(api.deleteSavedMeal);
export const useLogSavedMeal = () =>
  useLogMutation(({ id, ...target }: { id: string } & Parameters<typeof api.logSavedMeal>[1]) =>
    api.logSavedMeal(id, target),
  );

export const useLogFood = () => useLogMutation(api.logFood);
export const useQuickAdd = () => useLogMutation(api.quickAdd);
export const useUpdateEntry = () =>
  useLogMutation(({ id, ...changes }: { id: string } & Parameters<typeof api.updateEntry>[1]) =>
    api.updateEntry(id, changes),
  );
export const useDeleteEntry = () => useLogMutation(api.deleteEntry);

export const useProfile = () => useQuery({ queryKey: ['profile'], queryFn: api.profile, staleTime: 5 * 60_000 });

export const useUnits = () => {
  const { data } = useProfile();
  return { weightUnit: data?.weightUnit ?? 'kg', heightUnit: data?.heightUnit ?? 'cm' } as const;
};

export const useCurrentGoal = (date: string) =>
  useQuery({ queryKey: ['goal', 'current', date], queryFn: () => api.currentGoal(date) });

export const useDayTargets = (date: string) =>
  useQuery({ queryKey: ['day-targets', date], queryFn: () => api.dayTargets(date) });

export const useGoalPreview = (input: SetupInput | null) =>
  useQuery({
    queryKey: ['goal', 'preview', input],
    queryFn: () => api.previewGoal(input!),
    enabled: input !== null,
    staleTime: Infinity,
    placeholderData: (previous) => previous,
  });

// Goals feed Today, Progress and the profile, so refresh all of them
function invalidateGoalData(client: ReturnType<typeof useQueryClient>) {
  for (const key of ['profile', 'goal', 'day-targets', 'progress', 'weights']) {
    void client.invalidateQueries({ queryKey: [key] });
  }
}

export const useSaveGoal = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: api.saveGoal, onSuccess: () => invalidateGoalData(client) });
};

export const useSetUnits = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: api.setUnits, onSuccess: () => invalidateGoalData(client) });
};

export const useSetTrainingDay = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ date, trainingDay }: { date: string; trainingDay: boolean | null }) =>
      api.setTrainingDay(date, trainingDay),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['day-targets'] }),
  });
};

export const useProgress = (date: string, range: ProgressRange) =>
  useQuery({ queryKey: ['progress', date, range], queryFn: () => api.progress(date, range) });

export const useWeights = () => useQuery({ queryKey: ['weights'], queryFn: api.weights });

function useWeightMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['weights'] });
      void client.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export const useSaveWeight = () => useWeightMutation(api.saveWeight);
export const useDeleteWeight = () => useWeightMutation(api.deleteWeight);

export const useSubmitCheckIn = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: api.submitCheckIn, onSuccess: () => invalidateGoalData(client) });
};

export const useExercise = (date: string) => useQuery({ queryKey: ['exercise', date], queryFn: () => api.exercise(date) });

export const useExerciseEstimate = (date: string, activity: ExerciseActivity, minutes: number | null) =>
  useQuery({
    queryKey: ['exercise', 'estimate', date, activity, minutes],
    queryFn: () => api.estimateExercise({ date, activity, minutes: minutes! }),
    enabled: minutes !== null && minutes > 0 && minutes <= 600 && Number.isInteger(minutes),
    staleTime: 5 * 60_000,
  });

function useExerciseMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['exercise'] });
      // Exercise can change the day's allowance
      void client.invalidateQueries({ queryKey: ['day-targets'] });
    },
  });
}

export const useAddExercise = () => useExerciseMutation(api.addExercise);
export const useDeleteExercise = () => useExerciseMutation(api.deleteExercise);

export const useRecipes = (q = '', tag = '') =>
  useQuery({ queryKey: ['recipes', 'list', q, tag], queryFn: () => api.recipes({ q, tag }) });

export const useRecipeTags = () => useQuery({ queryKey: ['recipes', 'tags'], queryFn: api.recipeTags });

export const useRecipe = (id: string) => useQuery({ queryKey: ['recipes', 'one', id], queryFn: () => api.recipe(id) });

function useRecipeMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void client.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

export const useCreateRecipe = () => useRecipeMutation(api.createRecipe);
export const useUpdateRecipe = () => useRecipeMutation(api.updateRecipe);
export const useDeleteRecipe = () => useRecipeMutation(api.deleteRecipe);
export const useLogRecipe = () => useLogMutation(api.logRecipe);

export const usePlan = (date: string) => useQuery({ queryKey: ['plan', 'week', date], queryFn: () => api.plan(date) });
export const usePlanDay = (date: string) => useQuery({ queryKey: ['plan', 'day', date], queryFn: () => api.planDay(date) });

// Planning changes the grid and Today's planned block; logging also changes the diary
function usePlanMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, alsoDiary = false) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['plan'] });
      if (alsoDiary) {
        void client.invalidateQueries({ queryKey: ['log'] });
        void client.invalidateQueries({ queryKey: ['foods', 'recent'] });
      }
    },
  });
}

export const useAddPlanEntry = () => usePlanMutation(api.addPlanEntry);
export const useUpdatePlanEntry = () => usePlanMutation(api.updatePlanEntry);
export const useDeletePlanEntry = () => usePlanMutation(api.deletePlanEntry);
export const useDeletePlanEntries = () => usePlanMutation(api.deletePlanEntries);
export const useFitPlanDay = () => usePlanMutation(api.fitPlanDay);
export const useLogPlanEntry = () => usePlanMutation(api.logPlanEntry, true);
export const useLogPlanDay = () => usePlanMutation(api.logPlanDay, true);

export const usePlannerSettings = () => useQuery({ queryKey: ['plan', 'settings'], queryFn: api.plannerSettings });
export const useSavePlannerSettings = () => usePlanMutation(api.savePlannerSettings);
