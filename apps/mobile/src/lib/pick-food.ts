import { router } from 'expo-router';

import type { Food } from './types';

// Lets a screen ask "which food?" and await the answer from the picker screen, without
// putting the editor's unsaved state into route params.
let pending: ((food: Food | null) => void) | null = null;

export function pickFood(): Promise<Food | null> {
  // A stale request (picker closed without choosing) resolves empty
  pending?.(null);
  return new Promise((resolve) => {
    pending = resolve;
    router.push('/foods/pick');
  });
}

export function resolvePick(food: Food | null) {
  pending?.(food);
  pending = null;
}
