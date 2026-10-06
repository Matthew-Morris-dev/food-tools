import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './api';
import type { LogEntry } from './types';

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

// Refreshes the day and the recent list after any change to the log
function useLogMutation<TArgs>(fn: (args: TArgs) => Promise<LogEntry | void>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['log'] });
      void client.invalidateQueries({ queryKey: ['foods', 'recent'] });
    },
  });
}

export const useLogFood = () => useLogMutation(api.logFood);
export const useQuickAdd = () => useLogMutation(api.quickAdd);
export const useUpdateEntry = () =>
  useLogMutation(({ id, ...changes }: { id: string } & Parameters<typeof api.updateEntry>[1]) =>
    api.updateEntry(id, changes),
  );
export const useDeleteEntry = () => useLogMutation(api.deleteEntry);
